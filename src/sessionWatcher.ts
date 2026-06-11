import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as readline from 'readline';
import * as vscode from 'vscode';
import { identifyProvider, ProviderDef } from './providers';

// ── Types ──

export interface TokenEvent {
  requestId: string;
  provider: ProviderDef;
  model: string;
  inputTokens: number;
  outputTokens: number;
  timestamp: number;
  source: 'session' | 'heuristic';
}

type TokenEventHandler = (event: TokenEvent) => void;

// ── Session File Watcher ──

export class SessionWatcher {
  private watchers: Map<string, fs.FSWatcher> = new Map();
  private eventHandlers: TokenEventHandler[] = [];
  private knownSessionIds: Set<string> = new Set();
  private knownRequestIds: Set<string> = new Set();
  private disposables: vscode.Disposable[] = [];
  private _outputChannel: vscode.OutputChannel;
  private _sessionBasePath: string | undefined;
  private tailPositions: Map<string, number> = new Map();

  constructor(outputChannel: vscode.OutputChannel) {
    this._outputChannel = outputChannel;
  }

  get sessionBasePath(): string | undefined {
    return this._sessionBasePath;
  }

  onTokenEvent(handler: TokenEventHandler): void {
    this.eventHandlers.push(handler);
  }

  private emit(event: TokenEvent): void {
    // Dedup by requestId
    if (this.knownRequestIds.has(event.requestId)) return;
    this.knownRequestIds.add(event.requestId);

    // Keep dedup set from growing unbounded
    if (this.knownRequestIds.size > 10000) {
      const toRemove = Array.from(this.knownRequestIds).slice(0, 5000);
      toRemove.forEach(id => this.knownRequestIds.delete(id));
    }

    this._outputChannel.appendLine(
      `[QuemaTokens] ${event.source === 'session' ? '📊' : '🔢'} ${event.provider.name} (${event.model}): ` +
      `+${event.outputTokens} out / +${event.inputTokens} in`
    );

    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch (e) {
        console.error('[QuemaTokens] Event handler error:', e);
      }
    }
  }

  async start(): Promise<void> {
    const config = vscode.workspace.getConfiguration('quematokens');

    // Start all watchers in parallel — don't block one on another
    const promises: Promise<void>[] = [];

    // Copilot watcher
    const trackCopilot = config.get<boolean>('trackCopilot', true);
    if (trackCopilot) {
      promises.push(this.startCopilotWatcher());
    } else {
      this._outputChannel.appendLine('[QuemaTokens] Copilot session tracking disabled');
    }

    // Claude Code watcher
    const trackClaudeCode = config.get<boolean>('trackClaudeCode', true);
    if (trackClaudeCode) {
      promises.push(this.watchClaudeCodeSessions());
    } else {
      this._outputChannel.appendLine('[QuemaTokens] Claude Code tracking disabled');
    }

    // Codex CLI watcher
    const trackCodex = config.get<boolean>('trackCodex', true);
    if (trackCodex) {
      promises.push(this.watchCodexSessions());
    } else {
      this._outputChannel.appendLine('[QuemaTokens] Codex CLI tracking disabled');
    }

    await Promise.allSettled(promises);
  }

  // ── Copilot Session Watcher ──

  private async startCopilotWatcher(): Promise<void> {
    const config = vscode.workspace.getConfiguration('quematokens');
    const customPath = config.get<string>('copilotSessionPath', '');
    const homeDir = os.homedir();

    // Build a list of candidate paths to search
    const candidatePaths: string[] = [];

    if (customPath) {
      candidatePaths.push(customPath);
    } else {
      // Original path
      candidatePaths.push(path.join(homeDir, '.copilot', 'session-state'));
      // VSCode globalStorage paths (Linux)
      candidatePaths.push(path.join(homeDir, '.config', 'Code', 'User', 'globalStorage', 'github.copilot'));
      candidatePaths.push(path.join(homeDir, '.config', 'Code - Insiders', 'User', 'globalStorage', 'github.copilot'));
      // VSCode globalStorage paths (macOS)
      candidatePaths.push(path.join(homeDir, 'Library', 'Application Support', 'Code', 'User', 'globalStorage', 'github.copilot'));
      // VSCode globalStorage paths (Windows)
      const appData = process.env.APPDATA || '';
      if (appData) {
        candidatePaths.push(path.join(appData, 'Code', 'User', 'globalStorage', 'github.copilot'));
      }
    }

    // Try each candidate path
    for (const candidate of candidatePaths) {
      try {
        const exists = await fs.promises.access(candidate).then(() => true).catch(() => false);
        if (exists) {
          this._sessionBasePath = candidate;
          await this.scanExistingSessions();
          this.watchSessionDir();
          this._outputChannel.appendLine(`[QuemaTokens] Watching Copilot sessions at: ${this._sessionBasePath}`);
          return;
        }
      } catch {
        // try next
      }
    }

    this._outputChannel.appendLine(
      `[QuemaTokens] No Copilot session path found. Tried:\n  ${candidatePaths.join('\n  ')}`
    );
  }

  private async scanExistingSessions(): Promise<void> {
    try {
      const entries = await fs.promises.readdir(this._sessionBasePath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const sessionId = entry.name;
          const eventsFile = path.join(this._sessionBasePath, sessionId, 'events.jsonl');
          try {
            const stat = await fs.promises.stat(eventsFile);
            if (stat.isFile()) {
              this.knownSessionIds.add(sessionId);
              this.tailPositions.set(eventsFile, stat.size); // start from end
              this.tailFile(eventsFile, sessionId);
            }
          } catch {
            // events.jsonl may not exist for this session
          }
        }
      }
    } catch (e) {
      this._outputChannel.appendLine(`[QuemaTokens] Error scanning sessions: ${e}`);
    }
  }

  private watchSessionDir(): void {
    try {
      const watcher = fs.watch(this._sessionBasePath!, { persistent: false }, async (eventType, filename) => {
        if (!filename) return;
        try {
          const fullPath = path.join(this._sessionBasePath!, filename);
          const stat = await fs.promises.stat(fullPath);
          if (stat.isDirectory()) {
            if (!this.knownSessionIds.has(filename)) {
              this.knownSessionIds.add(filename);
              const eventsFile = path.join(fullPath, 'events.jsonl');
              try {
                await fs.promises.access(eventsFile);
                this.tailPositions.set(eventsFile, 0);
                this.tailFile(eventsFile, filename);
              } catch {
                // wait for events.jsonl to appear
                this.waitForEventsFile(eventsFile, filename);
              }
            }
          }
        } catch {
          // ignore
        }
      });
      watcher.on('error', (e) => {
        this._outputChannel.appendLine(`[QuemaTokens] Session dir watcher error: ${e}`);
      });
      this.watchers.set(this._sessionBasePath!, watcher);
    } catch (e) {
      this._outputChannel.appendLine(`[QuemaTokens] Cannot watch session dir: ${e}`);
    }
  }

  private waitForEventsFile(eventsFile: string, sessionId: string): void {
    const checkInterval = setInterval(async () => {
      try {
        await fs.promises.access(eventsFile);
        clearInterval(checkInterval);
        this.tailPositions.set(eventsFile, 0);
        this.tailFile(eventsFile, sessionId);
      } catch {
        // file not yet created
      }
    }, 2000);

    // Stop after 60 seconds
    setTimeout(() => clearInterval(checkInterval), 60000);
  }

  private tailFile(eventsFile: string, sessionId: string): void {
    const startPos = this.tailPositions.get(eventsFile) ?? 0;

    const fileStream = fs.createReadStream(eventsFile, {
      start: startPos,
      encoding: 'utf-8',
    });

    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    let lastFilePos = startPos;

    rl.on('line', (line) => {
      try {
        if (!line.trim()) return;
        const event = JSON.parse(line);
        this.processSessionEvent(event, sessionId);
        // Track position
        lastFilePos += Buffer.byteLength(line + '\n', 'utf-8');
      } catch {
        // skip malformed lines
      }
    });

    rl.on('close', () => {
      this.tailPositions.set(eventsFile, lastFilePos);

      // Watch for new lines
      try {
        const watchFile = fs.watch(eventsFile, { persistent: false }, () => {
          // Re-tail the file from last position
          try {
            fs.stat(eventsFile, (err, stat) => {
              if (err) return;
              const currentPos = this.tailPositions.get(eventsFile) ?? lastFilePos;
              if (stat.size >= currentPos) {
                this.tailFile(eventsFile, sessionId);
              }
            });
          } catch {
            // ignore
          }
        });
        watchFile.on('error', () => { /* ignore */ });
        this.watchers.set(eventsFile, watchFile);
      } catch {
        // ignore
      }
    });

    rl.on('error', () => {
      // ignore stream errors
    });
  }

  private processSessionEvent(event: any, _sessionId: string): void {
    try {
      // Handle assistant.message events
      if (event.type === 'assistant' && event.subtype === 'message') {
        const model = event.model || event.modelId || '';
        const outputTokens = event.outputTokens || 0;
        const inputTokens = event.inputTokens || 0;
        const requestId = event.requestId || event.turnId || `${Date.now()}-${Math.random()}`;

        if (outputTokens > 0 || inputTokens > 0) {
          const provider = identifyProvider(model) || this.fallbackProvider(model);
          this.emit({
            requestId,
            provider,
            model,
            inputTokens,
            outputTokens,
            timestamp: event.timestamp || Date.now(),
            source: 'session',
          });
        }
      }

      // Handle session.shutdown with modelMetrics
      if (event.type === 'session' && event.subtype === 'shutdown' && event.modelMetrics) {
        for (const [modelName, metrics] of Object.entries(event.modelMetrics)) {
          const m = metrics as any;
          const provider = identifyProvider(modelName) || this.fallbackProvider(modelName);
          this.emit({
            requestId: `shutdown-${modelName}-${Date.now()}`,
            provider,
            model: modelName,
            inputTokens: m.inputTokens || 0,
            outputTokens: m.outputTokens || 0,
            timestamp: event.timestamp || Date.now(),
            source: 'session',
          });
        }
      }

      // Handle generic events that might contain token info
      if (event.outputTokens && !event.type) {
        const model = event.model || event.modelId || event.modelName || 'unknown';
        const provider = identifyProvider(model) || this.fallbackProvider(model);
        this.emit({
          requestId: event.requestId || event.id || `${Date.now()}-${Math.random()}`,
          provider,
          model,
          inputTokens: event.inputTokens || 0,
          outputTokens: event.outputTokens || 0,
          timestamp: event.timestamp || Date.now(),
          source: 'session',
        });
      }
    } catch (e) {
      // skip unparseable events
    }
  }

  private fallbackProvider(model: string): ProviderDef {
    // Default to OpenAI for unknown models (most Copilot models are OpenAI-based)
    return {
      id: 'unknown',
      name: model || 'Unknown',
      color: '#888888',
      icon: 'codex.png',
      tokenCountMethod: 'local',
      modelPatterns: [],
    };
  }

  // ── Claude Code Session Watcher ──

  private async watchClaudeCodeSessions(): Promise<void> {
    const homeDir = os.homedir();
    const claudeProjectsDir = path.join(homeDir, '.claude', 'projects');

    // 1. Watch the stats-cache.json for aggregated totals
    this.watchClaudeStatsCache(path.join(homeDir, '.claude', 'stats-cache.json'));

    // 2. Watch the projects directory for session JSONL files
    try {
      const exists = await fs.promises.access(claudeProjectsDir).then(() => true).catch(() => false);
      if (!exists) {
        this._outputChannel.appendLine(`[QuemaTokens] Claude Code projects dir not found: ${claudeProjectsDir}`);
        return;
      }

      this._outputChannel.appendLine(`[QuemaTokens] Watching Claude Code sessions at: ${claudeProjectsDir}`);
      await this.scanClaudeCodeSessions(claudeProjectsDir);
      this.watchClaudeCodeDir(claudeProjectsDir);
    } catch (e) {
      this._outputChannel.appendLine(`[QuemaTokens] Claude Code watcher error: ${e}`);
    }
  }

  private watchClaudeStatsCache(statsFile: string): void {
    try {
      // Read initial state
      this.readClaudeStatsCache(statsFile);

      // Watch for changes
      const watcher = fs.watch(statsFile, { persistent: false }, () => {
        this.readClaudeStatsCache(statsFile);
      });
      watcher.on('error', () => { /* ignore */ });
      this.watchers.set(`claude-stats-${statsFile}`, watcher);
      this._outputChannel.appendLine(`[QuemaTokens] Watching Claude Code stats cache: ${statsFile}`);
    } catch {
      // file may not exist yet — that's fine
    }
  }

  private claudeStatsLastEntryIndex: number = 0;

  private readClaudeStatsCache(statsFile: string): void {
    try {
      const content = fs.readFileSync(statsFile, 'utf-8');
      const data = JSON.parse(content);
      const entries: any[] = data.entries || [];

      // Process only new entries
      for (let i = this.claudeStatsLastEntryIndex; i < entries.length; i++) {
        const entry = entries[i];
        const model = entry.model || 'claude';
        const inputTokens = entry.input_tokens || 0;
        const outputTokens = entry.output_tokens || 0;

        if (inputTokens > 0 || outputTokens > 0) {
          const provider = this.findProviderById('claude-code') || identifyProvider(model) || this.fallbackProvider(model);
          this.emit({
            requestId: `claude-stats-${i}-${entry.timestamp || Date.now()}`,
            provider,
            model,
            inputTokens,
            outputTokens,
            timestamp: entry.timestamp ? new Date(entry.timestamp).getTime() : Date.now(),
            source: 'session',
          });
        }
      }

      this.claudeStatsLastEntryIndex = entries.length;
    } catch {
      // ignore parse errors
    }
  }

  private async scanClaudeCodeSessions(baseDir: string): Promise<void> {
    try {
      await this.scanClaudeCodeDirRecursive(baseDir);
    } catch (e) {
      this._outputChannel.appendLine(`[QuemaTokens] Error scanning Claude Code sessions: ${e}`);
    }
  }

  private async scanClaudeCodeDirRecursive(dir: string): Promise<void> {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await this.scanClaudeCodeDirRecursive(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
        try {
          const stat = await fs.promises.stat(fullPath);
          const key = `claude-${fullPath}`;
          if (!this.tailPositions.has(key)) {
            this.tailPositions.set(key, stat.size); // start from end for existing files
            this.tailClaudeCodeFile(fullPath, key);
          }
        } catch {
          // skip
        }
      }
    }
  }

  private watchClaudeCodeDir(baseDir: string): void {
    try {
      const watcher = fs.watch(baseDir, { persistent: false, recursive: true }, async (eventType, filename) => {
        if (!filename) return;
        try {
          const fullPath = path.join(baseDir, filename);
          const stat = await fs.promises.stat(fullPath);
          if (stat.isFile() && filename.endsWith('.jsonl')) {
            const key = `claude-${fullPath}`;
            if (!this.tailPositions.has(key)) {
              this.tailPositions.set(key, 0);
              this.tailClaudeCodeFile(fullPath, key);
            }
          }
        } catch {
          // ignore
        }
      });
      watcher.on('error', (e) => {
        this._outputChannel.appendLine(`[QuemaTokens] Claude Code dir watcher error: ${e}`);
      });
      this.watchers.set(`claude-dir-${baseDir}`, watcher);
    } catch (e) {
      this._outputChannel.appendLine(`[QuemaTokens] Cannot watch Claude Code dir: ${e}`);
    }
  }

  private tailClaudeCodeFile(filePath: string, key: string): void {
    const startPos = this.tailPositions.get(key) ?? 0;

    const fileStream = fs.createReadStream(filePath, {
      start: startPos,
      encoding: 'utf-8',
    });

    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    let lastFilePos = startPos;

    rl.on('line', (line) => {
      try {
        if (!line.trim()) return;
        const entry = JSON.parse(line);

        // Claude Code JSONL: look for assistant messages with usage
        if (entry.type === 'assistant' && entry.usage) {
          const usage = entry.usage;
          const inputTokens = usage.input_tokens || 0;
          const outputTokens = usage.output_tokens || 0;

          // Skip streaming placeholders: only count entries where input_tokens > 1 OR output_tokens > 0
          if (inputTokens <= 1 && outputTokens <= 0) {
            lastFilePos += Buffer.byteLength(line + '\n', 'utf-8');
            return;
          }

          const model = entry.model || 'claude';
          const cacheReadTokens = usage.cache_read_input_tokens || 0;
          const cacheCreationTokens = usage.cache_creation_input_tokens || 0;
          // Include cache tokens in input total
          const totalInput = inputTokens + cacheReadTokens + cacheCreationTokens;

          const provider = this.findProviderById('claude-code') || identifyProvider(model) || this.fallbackProvider(model);
          this.emit({
            requestId: `claude-${path.basename(filePath)}-${lastFilePos}`,
            provider,
            model,
            inputTokens: totalInput,
            outputTokens,
            timestamp: entry.timestamp ? new Date(entry.timestamp).getTime() : Date.now(),
            source: 'session',
          });
        }

        // Track position
        lastFilePos += Buffer.byteLength(line + '\n', 'utf-8');
      } catch {
        // skip malformed lines
      }
    });

    rl.on('close', () => {
      this.tailPositions.set(key, lastFilePos);

      // Watch for new lines
      try {
        const watchFile = fs.watch(filePath, { persistent: false }, () => {
          try {
            fs.stat(filePath, (err, stat) => {
              if (err) return;
              const currentPos = this.tailPositions.get(key) ?? lastFilePos;
              if (stat.size >= currentPos) {
                this.tailClaudeCodeFile(filePath, key);
              }
            });
          } catch {
            // ignore
          }
        });
        watchFile.on('error', () => { /* ignore */ });
        this.watchers.set(`claude-file-${key}`, watchFile);
      } catch {
        // ignore
      }
    });

    rl.on('error', () => {
      // ignore stream errors
    });
  }

  // ── Codex CLI Session Watcher ──

  private async watchCodexSessions(): Promise<void> {
    const homeDir = os.homedir();
    const codexHome = process.env.CODEX_HOME || path.join(homeDir, '.codex');
    const sessionsDir = path.join(codexHome, 'sessions');

    // Also check archived sessions
    const archivedDir = path.join(codexHome, 'archived_sessions');

    const dirsToWatch: string[] = [];

    try {
      const exists = await fs.promises.access(sessionsDir).then(() => true).catch(() => false);
      if (exists) {
        dirsToWatch.push(sessionsDir);
      }
    } catch { /* ignore */ }

    try {
      const exists = await fs.promises.access(archivedDir).then(() => true).catch(() => false);
      if (exists) {
        dirsToWatch.push(archivedDir);
      }
    } catch { /* ignore */ }

    if (dirsToWatch.length === 0) {
      this._outputChannel.appendLine(
        `[QuemaTokens] Codex CLI sessions dir not found at: ${sessionsDir} or ${archivedDir}`
      );
      return;
    }

    this._outputChannel.appendLine(`[QuemaTokens] Watching Codex CLI sessions at: ${dirsToWatch.join(', ')}`);

    for (const dir of dirsToWatch) {
      try {
        await this.scanCodexSessions(dir);
        this.watchCodexDir(dir);
      } catch (e) {
        this._outputChannel.appendLine(`[QuemaTokens] Codex CLI watcher error for ${dir}: ${e}`);
      }
    }
  }

  private async scanCodexSessions(baseDir: string): Promise<void> {
    try {
      await this.scanCodexDirRecursive(baseDir);
    } catch (e) {
      this._outputChannel.appendLine(`[QuemaTokens] Error scanning Codex sessions: ${e}`);
    }
  }

  private async scanCodexDirRecursive(dir: string): Promise<void> {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await this.scanCodexDirRecursive(fullPath);
      } else if (entry.isFile() && entry.name.startsWith('rollout-') && entry.name.endsWith('.jsonl')) {
        try {
          const stat = await fs.promises.stat(fullPath);
          const key = `codex-${fullPath}`;
          if (!this.tailPositions.has(key)) {
            this.tailPositions.set(key, stat.size); // start from end
            this.tailCodexFile(fullPath, key);
          }
        } catch {
          // skip
        }
      }
    }
  }

  private watchCodexDir(baseDir: string): void {
    try {
      const watcher = fs.watch(baseDir, { persistent: false, recursive: true }, async (eventType, filename) => {
        if (!filename) return;
        try {
          const fullPath = path.join(baseDir, filename);
          const stat = await fs.promises.stat(fullPath);
          if (stat.isFile() && filename.startsWith('rollout-') && filename.endsWith('.jsonl')) {
            const key = `codex-${fullPath}`;
            if (!this.tailPositions.has(key)) {
              this.tailPositions.set(key, 0);
              this.tailCodexFile(fullPath, key);
            }
          }
        } catch {
          // ignore
        }
      });
      watcher.on('error', (e) => {
        this._outputChannel.appendLine(`[QuemaTokens] Codex dir watcher error: ${e}`);
      });
      this.watchers.set(`codex-dir-${baseDir}`, watcher);
    } catch (e) {
      this._outputChannel.appendLine(`[QuemaTokens] Cannot watch Codex dir: ${e}`);
    }
  }

  private tailCodexFile(filePath: string, key: string): void {
    const startPos = this.tailPositions.get(key) ?? 0;

    const fileStream = fs.createReadStream(filePath, {
      start: startPos,
      encoding: 'utf-8',
    });

    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    let lastFilePos = startPos;
    let currentModel = '';

    rl.on('line', (line) => {
      try {
        if (!line.trim()) return;
        const entry = JSON.parse(line);

        // Track model from turn_context
        if (entry.turn_context?.model) {
          currentModel = entry.turn_context.model;
        }

        // Look for token_count payload events
        if (entry.payload?.type === 'token_count') {
          const payload = entry.payload;
          const inputTokens = payload.input_tokens || 0;
          const outputTokens = payload.output_tokens || 0;
          const cachedTokens = payload.cached_input_tokens || 0;
          const reasoningTokens = payload.reasoning_tokens || 0;
          const totalInput = inputTokens + cachedTokens;

          if (inputTokens > 0 || outputTokens > 0) {
            const model = currentModel || 'codex';
            const provider = this.findProviderById('codex-cli') || identifyProvider(model) || this.fallbackProvider(model);
            this.emit({
              requestId: `codex-${path.basename(filePath)}-${lastFilePos}`,
              provider,
              model,
              inputTokens: totalInput,
              outputTokens: outputTokens + reasoningTokens,
              timestamp: entry.timestamp ? new Date(entry.timestamp).getTime() : Date.now(),
              source: 'session',
            });
          }
        }

        // Track position
        lastFilePos += Buffer.byteLength(line + '\n', 'utf-8');
      } catch {
        // skip malformed lines
      }
    });

    rl.on('close', () => {
      this.tailPositions.set(key, lastFilePos);

      // Watch for new lines
      try {
        const watchFile = fs.watch(filePath, { persistent: false }, () => {
          try {
            fs.stat(filePath, (err, stat) => {
              if (err) return;
              const currentPos = this.tailPositions.get(key) ?? lastFilePos;
              if (stat.size >= currentPos) {
                this.tailCodexFile(filePath, key);
              }
            });
          } catch {
            // ignore
          }
        });
        watchFile.on('error', () => { /* ignore */ });
        this.watchers.set(`codex-file-${key}`, watchFile);
      } catch {
        // ignore
      }
    });

    rl.on('error', () => {
      // ignore stream errors
    });
  }

  // ── Utility ──

  private findProviderById(id: string): ProviderDef | undefined {
    // Import PROVIDERS lazily to avoid circular dependency issues
    try {
      const { PROVIDERS } = require('./providers');
      return PROVIDERS.find(p => p.id === id);
    } catch {
      return undefined;
    }
  }

  dispose(): void {
    for (const [, watcher] of this.watchers) {
      watcher.close();
    }
    this.watchers.clear();
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];
  }
}
