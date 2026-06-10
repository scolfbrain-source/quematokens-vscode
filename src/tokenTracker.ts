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
    const config = vscode.workspace.getConfiguration('quematokens');

    vscode.workspace.onDidChangeTextDocument((e) => {
      const uri = e.document.uri.toString();
      if (!uri.includes('vscode-chat') && !uri.includes('copilot') && !uri.includes('inline-chat')) {
        return;
      }

      // If we already have session data, don't double-count
      if (this.sessionWatcher.sessionBasePath) {
        return;
      }

      // Heuristic: estimate ~4 chars/token from the diff
      const autoSpin = config.get<boolean>('autoSpin', true);
      if (!autoSpin) return;

      const text = e.document.getText();
      if (!text || text.length < 10) return;

      // Only count text that appears to be assistant responses
      // (longer chunks in chat are likely model outputs)
      if (e.contentChanges.length > 0) {
        const addedText = e.contentChanges
          .map(c => c.text)
          .join('');
        if (addedText.length > 50) {
          const estimatedTokens = Math.ceil(addedText.length / 4);
          const provider = this.guessProviderFromUri(uri);
          this.handleTokenEvent({
            requestId: `heuristic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            provider,
            model: 'estimated',
            inputTokens: Math.ceil(addedText.length / 6),
            outputTokens: estimatedTokens,
            timestamp: Date.now(),
            source: 'heuristic',
          });
        }
      }
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
    // Default to OpenAI (Copilot default)
    return PROVIDERS.find(p => p.id === 'openai')!;
  }

  // ── State Persistence ──

  private async loadState(): Promise<void> {
    try {
      const stored = await this.readGlobalState();
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
