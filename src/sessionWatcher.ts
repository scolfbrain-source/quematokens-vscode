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
    const trackCopilot = config.get<boolean>('trackCopilot', true);
    if (!trackCopilot) {
      this._outputChannel.appendLine('[QuemaTokens] Copilot session tracking disabled');
      return;
    }

    const customPath = config.get<string>('copilotSessionPath', '');
    if (customPath) {
      this._sessionBasePath = customPath;
    } else {
      // Cross-platform: Linux/Mac = ~/.copilot/, Windows = %USERPROFILE%\.copilot\
      const homeDir = os.homedir();
      this._sessionBasePath = path.join(homeDir, '.copilot', 'session-state');
    }

    try {
      const exists = await fs.promises.access(this._sessionBasePath).then(() => true).catch(() => false);
      if (!exists) {
        this._outputChannel.appendLine(`[QuemaTokens] Session path not found: ${this._sessionBasePath}`);
        return;
      }

      await this.scanExistingSessions();
      this.watchSessionDir();
      this._outputChannel.appendLine(`[QuemaTokens] Watching Copilot sessions at: ${this._sessionBasePath}`);
    } catch (e) {
      this._outputChannel.appendLine(`[QuemaTokens] Error starting session watcher: ${e}`);
    }
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
