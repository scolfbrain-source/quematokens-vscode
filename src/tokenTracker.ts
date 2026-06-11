import * as vscode from 'vscode';
import { SessionWatcher, TokenEvent } from './sessionWatcher';
import { PROVIDERS, identifyProvider, ProviderDef } from './providers';

// ── Types ──

export interface DailyUsage {
  date: string; // YYYY-MM-DD
  providers: Record<string, ProviderUsage>;
  totalInput: number;
  totalOutput: number;
}

export interface ProviderUsage {
  providerId: string;
  providerName: string;
  color: string;
  icon: string;
  models: Record<string, ModelUsage>;
  totalInput: number;
  totalOutput: number;
}

export interface ModelUsage {
  inputTokens: number;
  outputTokens: number;
  requestCount: number;
}

export interface TokenTrackerState {
  todayUsage: DailyUsage;
  allTimeTotal: { inputTokens: number; outputTokens: number };
}

// ── Main Token Tracker ──

export class TokenTracker {
  private sessionWatcher: SessionWatcher;
  private dailyUsage: Map<string, DailyUsage> = new Map();
  private allTimeTotal = { inputTokens: 0, outputTokens: 0 };
  private _outputChannel: vscode.OutputChannel;
  private changeHandlers: ((state: TokenTrackerState) => void)[] = [];
  private _isRunning = false;
  private debounceTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  constructor(outputChannel: vscode.OutputChannel) {
    this._outputChannel = outputChannel;
    this.sessionWatcher = new SessionWatcher(outputChannel);
  }

  get isRunning(): boolean {
    return this._isRunning;
  }

  async start(): Promise<void> {
    if (this._isRunning) return;
    this._isRunning = true;

    // Load persisted state
    await this.loadState();

    // Start session file watcher
    this.sessionWatcher.onTokenEvent((event) => this.handleTokenEvent(event));
    await this.sessionWatcher.start();

    // Set up chat heuristic (Layer 3)
    this.setupChatHeuristic();

    this._outputChannel.appendLine('[QuemaTokens] Token tracker started');
    this.emitState();
  }

  onChange(handler: (state: TokenTrackerState) => void): void {
    this.changeHandlers.push(handler);
  }

  private emitState(): void {
    const today = this.getTodayKey();
    const todayUsage = this.dailyUsage.get(today) || this.createEmptyDay(today);
    const state: TokenTrackerState = {
      todayUsage,
      allTimeTotal: { ...this.allTimeTotal },
    };
    for (const handler of this.changeHandlers) {
      try {
        handler(state);
      } catch (e) {
        console.error('[QuemaTokens] Change handler error:', e);
      }
    }
  }

  private handleTokenEvent(event: TokenEvent): void {
    const dateKey = this.getDateKey(event.timestamp);
    let day = this.dailyUsage.get(dateKey);
    if (!day) {
      day = this.createEmptyDay(dateKey);
      this.dailyUsage.set(dateKey, day);
    }

    let prov = day.providers[event.provider.id];
    if (!prov) {
      prov = {
        providerId: event.provider.id,
        providerName: event.provider.name,
        color: event.provider.color,
        icon: event.provider.icon,
        models: {},
        totalInput: 0,
        totalOutput: 0,
      };
      day.providers[event.provider.id] = prov;
    }

    let model = prov.models[event.model];
    if (!model) {
      model = { inputTokens: 0, outputTokens: 0, requestCount: 0 };
      prov.models[event.model] = model;
    }

    model.inputTokens += event.inputTokens;
    model.outputTokens += event.outputTokens;
    model.requestCount += 1;
    prov.totalInput += event.inputTokens;
    prov.totalOutput += event.outputTokens;
    day.totalInput += event.inputTokens;
    day.totalOutput += event.outputTokens;
    this.allTimeTotal.inputTokens += event.inputTokens;
    this.allTimeTotal.outputTokens += event.outputTokens;

    // Debounce state emission
    const debKey = `emit-${dateKey}`;
    const timer = this.debounceTimers.get(debKey);
    if (timer) clearTimeout(timer);
    this.debounceTimers.set(debKey, setTimeout(() => {
      this.saveState();
      this.emitState();
    }, 500));
  }

  // ── Layer 3: Chat Heuristic ──

  private setupChatHeuristic(): void {
    vscode.workspace.onDidChangeTextDocument((e) => {
      const uri = e.document.uri.toString();
      const scheme = e.document.uri.scheme;

      // Skip real files and git diffs — only track virtual/chat documents
      if (scheme === 'file' || scheme === 'git' || scheme === 'private') return;
      // Skip untitled docs that have a real file path (user just opened an unsaved file)
      if (scheme === 'untitled' && e.document.uri.fsPath) return;

      // Skip if no content changes
      if (e.contentChanges.length === 0) return;

      const addedText = e.contentChanges.map(c => c.text).join('');
      if (addedText.length < 20) return;

      const estimatedTokens = Math.ceil(addedText.length / 4);
      const provider = this.guessProviderFromUri(uri) || this.guessProviderFromContent(addedText);

      this.handleTokenEvent({
        requestId: `heuristic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        provider,
        model: this.guessModel(addedText, uri),
        inputTokens: Math.ceil(addedText.length / 6),
        outputTokens: estimatedTokens,
        timestamp: Date.now(),
        source: 'heuristic',
      });
    });
  }

  private guessProviderFromUri(uri: string): ProviderDef {
    const lower = uri.toLowerCase();
    if (lower.includes('claude') || lower.includes('anthropic')) {
      return PROVIDERS.find(p => p.id === 'anthropic')!;
    }
    if (lower.includes('gemini') || lower.includes('google')) {
      return PROVIDERS.find(p => p.id === 'google')!;
    }
    if (lower.includes('deepseek')) {
      return PROVIDERS.find(p => p.id === 'deepseek')!;
    }
    if (lower.includes('mistral') || lower.includes('mixtral') || lower.includes('codestral')) {
      return PROVIDERS.find(p => p.id === 'mistral')!;
    }
    if (lower.includes('grok') || lower.includes('xai')) {
      return PROVIDERS.find(p => p.id === 'xai')!;
    }
    if (lower.includes('qwen')) {
      return PROVIDERS.find(p => p.id === 'qwen')!;
    }
    if (lower.includes('glm') || lower.includes('chatglm') || lower.includes('z.ai')) {
      return PROVIDERS.find(p => p.id === 'zhipu')!;
    }
    if (lower.includes('minimax') || lower.includes('abab')) {
      return PROVIDERS.find(p => p.id === 'minimax')!;
    }
    if (lower.includes('nvidia') || lower.includes('nemotron')) {
      return PROVIDERS.find(p => p.id === 'nvidia')!;
    }
    // Default to OpenAI (Copilot default)
    return PROVIDERS.find(p => p.id === 'openai')!;
  }

  private guessProviderFromContent(text: string): ProviderDef {
    const lower = text.toLowerCase();
    if (lower.includes('claude') || lower.includes('anthropic')) return PROVIDERS.find(p => p.id === 'anthropic')!;
    if (lower.includes('gemini') || lower.includes('google')) return PROVIDERS.find(p => p.id === 'google')!;
    if (lower.includes('deepseek')) return PROVIDERS.find(p => p.id === 'deepseek')!;
    if (lower.includes('mistral') || lower.includes('mixtral') || lower.includes('codestral')) return PROVIDERS.find(p => p.id === 'mistral')!;
    if (lower.includes('grok') || lower.includes('xai')) return PROVIDERS.find(p => p.id === 'xai')!;
    if (lower.includes('qwen')) return PROVIDERS.find(p => p.id === 'qwen')!;
    if (lower.includes('glm') || lower.includes('chatglm') || lower.includes('z.ai')) return PROVIDERS.find(p => p.id === 'zhipu')!;
    if (lower.includes('minimax') || lower.includes('abab')) return PROVIDERS.find(p => p.id === 'minimax')!;
    if (lower.includes('nvidia') || lower.includes('nemotron')) return PROVIDERS.find(p => p.id === 'nvidia')!;
    return PROVIDERS.find(p => p.id === 'openai')!;
  }

  private guessModel(text: string, uri: string): string {
    // Try to extract model name from content or URI
    const combined = (text + ' ' + uri).toLowerCase();
    const patterns: RegExp[] = [
      /(?:gpt-4o(?:-mini)?(?:-\d{4}-\d{2}-\d{2})?)/i,
      /(?:claude[- ]?(?:sonnet|opus|haiku)[- ]?[\d.]*(?:-\d{4}-\d{2}-\d{2})?)/i,
      /(?:gemini[- ]?[\d.]+(?:-\w+)?)/i,
      /(?:deepseek[- ][\w.]+)/i,
      /(?:o[134](?:-mini)?(?:-\d{4}-\d{2}-\d{2})?)/i,
      /(?:mistral[- ][\w.]+)/i,
      /(?:nemotron[- ][\w.]+)/i,
    ];
    for (const p of patterns) {
      const m = combined.match(p);
      if (m && m[0]) return m[0].trim();
    }
    // Fallback: guess from provider context in URI
    if (uri.includes('claude')) return 'claude';
    if (uri.includes('gemini')) return 'gemini';
    if (uri.includes('gpt') || uri.includes('codex') || uri.includes('copilot')) return 'gpt-4o';
    return 'estimated';
  }

  // ── State Persistence ──

  private async loadState(): Promise<void> {
    try {
      const stored = this.readGlobalState();
      if (stored) {
        this.dailyUsage.clear();
        for (const [key, day] of Object.entries(stored.dailyUsage || {})) {
          this.dailyUsage.set(key, day as DailyUsage);
        }
        this.allTimeTotal = stored.allTimeTotal || { inputTokens: 0, outputTokens: 0 };
      }
    } catch (e) {
      this._outputChannel.appendLine(`[QuemaTokens] Error loading state: ${e}`);
    }
  }

  private async saveState(): Promise<void> {
    try {
      const data = {
        dailyUsage: Object.fromEntries(this.dailyUsage),
        allTimeTotal: this.allTimeTotal,
      };
      await this.writeGlobalState(data);
    } catch (e) {
      this._outputChannel.appendLine(`[QuemaTokens] Error saving state: ${e}`);
    }
  }

  // These will be set by the extension on init
  private _context: vscode.ExtensionContext | undefined;
  private _getState: (<T>(key: string, defaultValue?: T) => T | undefined) | undefined;
  private _updateState: ((key: string, value: any) => Thenable<void>) | undefined;

  initContext(
    context: vscode.ExtensionContext,
    getState: <T>(key: string, defaultValue?: T) => T | undefined,
    updateState: (key: string, value: any) => Thenable<void>
  ): void {
    this._context = context;
    this._getState = getState;
    this._updateState = updateState;
  }

  private readGlobalState(): any {
    if (this._getState) {
      return this._getState('tokenTrackerState');
    }
    return undefined;
  }

  private async writeGlobalState(data: any): Promise<void> {
    if (this._updateState) {
      await this._updateState('tokenTrackerState', data);
    }
  }

  // ── Public API ──

  getTodayUsage(): DailyUsage {
    const today = this.getTodayKey();
    return this.dailyUsage.get(today) || this.createEmptyDay(today);
  }

  getAllTimeTotal(): { inputTokens: number; outputTokens: number } {
    return { ...this.allTimeTotal };
  }

  getProviderBreakdown(): Array<{ provider: ProviderDef; usage: ProviderUsage }> {
    const today = this.getTodayUsage();
    const result: Array<{ provider: ProviderDef; usage: ProviderUsage }> = [];

    for (const [providerId, usage] of Object.entries(today.providers)) {
      const def = PROVIDERS.find(p => p.id === providerId);
      if (def) {
        result.push({ provider: def, usage });
      } else {
        result.push({
          provider: {
            id: usage.providerId,
            name: usage.providerName,
            color: usage.color,
            icon: usage.icon,
            tokenCountMethod: 'local',
            modelPatterns: [],
          },
          usage,
        });
      }
    }

    // Add providers with zero usage for display
    const seenIds = new Set(Object.keys(today.providers));
    for (const def of PROVIDERS) {
      if (!seenIds.has(def.id)) {
        result.push({
          provider: def,
          usage: {
            providerId: def.id,
            providerName: def.name,
            color: def.color,
            icon: def.icon,
            models: {},
            totalInput: 0,
            totalOutput: 0,
          },
        });
      }
    }

    return result;
  }

  getStatsString(): string {
    const today = this.getTodayUsage();
    const allTime = this.allTimeTotal;
    const lines = [
      `📊 QuemaTokens Usage Stats`,
      ``,
      `🕐 Today (${today.date}):`,
      `  Input:  ${today.totalInput.toLocaleString()} tokens`,
      `  Output: ${today.totalOutput.toLocaleString()} tokens`,
      `  Total:  ${(today.totalInput + today.totalOutput).toLocaleString()} tokens`,
      ``,
      `🌍 All Time:`,
      `  Input:  ${allTime.inputTokens.toLocaleString()} tokens`,
      `  Output: ${allTime.outputTokens.toLocaleString()} tokens`,
      `  Total:  ${(allTime.inputTokens + allTime.outputTokens).toLocaleString()} tokens`,
    ];

    const providers = Object.entries(today.providers);
    if (providers.length > 0) {
      lines.push('');
      lines.push('📋 By Provider (today):');
      for (const [, usage] of providers.sort((a, b) => (b[1].totalOutput - a[1].totalOutput))) {
        lines.push(`  ${usage.providerName}: ${usage.totalOutput.toLocaleString()} out / ${usage.totalInput.toLocaleString()} in`);
      }
    }

    return lines.join('\n');
  }

  getExportData(): string {
    const data = {
      exportedAt: new Date().toISOString(),
      allTimeTotal: this.allTimeTotal,
      dailyUsage: Object.fromEntries(this.dailyUsage),
    };
    return JSON.stringify(data, null, 2);
  }

  resetStats(): void {
    this.dailyUsage.clear();
    this.allTimeTotal = { inputTokens: 0, outputTokens: 0 };
    this.saveState();
    this.emitState();
  }

  // ── Utilities ──

  private getTodayKey(): string {
    return this.getDateKey(Date.now());
  }

  private getDateKey(timestamp: number): string {
    const d = new Date(timestamp);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private createEmptyDay(date: string): DailyUsage {
    return { date, providers: {}, totalInput: 0, totalOutput: 0 };
  }

  dispose(): void {
    this._isRunning = false;
    this.sessionWatcher.dispose();
    for (const [, timer] of this.debounceTimers) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
  }
}
