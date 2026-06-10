import * as vscode from 'vscode';
import * as path from 'path';
import { getWebviewHtml } from './webview';
import { TokenTracker } from './tokenTracker';
import { PROVIDERS } from './providers';

const STATE_KEYS = {
  credits: 'quematokens.credits',
  record: 'quematokens.record',
  betIndex: 'quematokens.betIndex',
  totalSpins: 'quematokens.totalSpins',
  totalTokensSpent: 'quematokens.totalTokensSpent',
} as const;

let tokenTracker: TokenTracker | undefined;
let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
  console.log('QuemaTokens se activó 🎰');

  const state = context.globalState;
  let panel: vscode.WebviewPanel | undefined;

  // ── Output Channel ──
  outputChannel = vscode.window.createOutputChannel('QuemaTokens');
  context.subscriptions.push(outputChannel);

  // ── Token Tracker (Layer 1 + Layer 2 + Layer 3) ──
  tokenTracker = new TokenTracker(outputChannel);
  tokenTracker.initContext(
    context,
    (key: string, defaultValue?: any) => state.get(key, defaultValue),
    (key: string, value: any) => state.update(key, value)
  );

  // When tokens are counted, update webview and optionally auto-spin
  tokenTracker.onChange((trackerState) => {
    if (panel) {
      panel.webview.postMessage({
        command: 'updateTokenStats',
        todayUsage: trackerState.todayUsage,
        allTimeTotal: trackerState.allTimeTotal,
      });

      // Auto-spin on new token data
      const config = vscode.workspace.getConfiguration('quematokens');
      const autoSpin = config.get<boolean>('autoSpin', true);
      if (autoSpin && trackerState.todayUsage.totalOutput > 0) {
        panel.webview.postMessage({ command: 'spin' });
      }

      // Update panel title
      const total = trackerState.allTimeTotal.inputTokens + trackerState.allTimeTotal.outputTokens;
      if (panel) {
        panel.title = `🎰 QuemaTokens — ${total.toLocaleString()} tokens`;
      }
    }
  });

  // Start tracking
  tokenTracker.start();

  // Reset command
  context.subscriptions.push(
    vscode.commands.registerCommand('quematokens.reset', async () => {
      await state.update(STATE_KEYS.credits, 100);
      await state.update(STATE_KEYS.record, 0);
      await state.update(STATE_KEYS.betIndex, 0);
      await state.update(STATE_KEYS.totalSpins, 0);
      await state.update(STATE_KEYS.totalTokensSpent, 0);
      vscode.window.showInformationMessage('QuemaTokens: créditos reiniciados a 100 🎰');
      if (panel) {
        panel.webview.postMessage({ command: 'reset' });
      }
    })
  );

  // Spin command
  context.subscriptions.push(
    vscode.commands.registerCommand('quematokens.spin', () => {
      if (panel) {
        panel.webview.postMessage({ command: 'spin' });
      } else {
        vscode.window.showInformationMessage('QuemaTokens: abre primero la máquina con QuemaTokens: Abrir máquina');
      }
    })
  );

  // Stats command
  context.subscriptions.push(
    vscode.commands.registerCommand('quematokens.stats', () => {
      if (!tokenTracker) {
        vscode.window.showInformationMessage('QuemaTokens: Tracker not initialized');
        return;
      }
      const stats = tokenTracker.getStatsString();
      outputChannel.show();
      outputChannel.appendLine('\n' + stats + '\n');
      vscode.window.showInformationMessage(stats);
    })
  );

  // Export command
  context.subscriptions.push(
    vscode.commands.registerCommand('quematokens.exportUsage', async () => {
      if (!tokenTracker) {
        vscode.window.showInformationMessage('QuemaTokens: Tracker not initialized');
        return;
      }
      const exportData = tokenTracker.getExportData();
      const doc = await vscode.workspace.openTextDocument({
        content: exportData,
        language: 'json',
      });
      await vscode.window.showTextDocument(doc);
    })
  );

  // Open panel command
  context.subscriptions.push(
    vscode.commands.registerCommand('quematokens.open', () => {
      if (panel) {
        panel.reveal();
        // Send current stats on re-open
        if (tokenTracker) {
          const state_data = {
            command: 'updateTokenStats' as const,
            todayUsage: tokenTracker.getTodayUsage(),
            allTimeTotal: tokenTracker.getAllTimeTotal(),
          };
          panel.webview.postMessage(state_data);
        }
        return;
      }

      panel = vscode.window.createWebviewPanel(
        'quematokens',
        '🎰 QuemaTokens',
        vscode.ViewColumn.Beside,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [
            vscode.Uri.joinPath(context.extensionUri, 'media'),
          ],
        }
      );

      panel.webview.html = getWebviewHtml(context.extensionUri, panel.webview);

      // Send initial state
      const credits = state.get<number>(STATE_KEYS.credits, 100);
      const record = state.get<number>(STATE_KEYS.record, 0);
      const betIndex = state.get<number>(STATE_KEYS.betIndex, 0);
      const totalSpins = state.get<number>(STATE_KEYS.totalSpins, 0);
      const totalTokensSpent = state.get<number>(STATE_KEYS.totalTokensSpent, 0);

      panel.webview.postMessage({
        command: 'init',
        credits,
        record,
        betIndex,
        totalSpins,
        totalTokensSpent,
      });

      // Send initial token stats if tracker is ready
      if (tokenTracker) {
        panel.webview.postMessage({
          command: 'updateTokenStats',
          todayUsage: tokenTracker.getTodayUsage(),
          allTimeTotal: tokenTracker.getAllTimeTotal(),
        });
      }

      // Handle messages from webview
      panel.webview.onDidReceiveMessage(
        async (message) => {
          switch (message.command) {
            case 'saveState': {
              await state.update(STATE_KEYS.credits, message.credits);
              await state.update(STATE_KEYS.record, message.record);
              await state.update(STATE_KEYS.betIndex, message.betIndex);
              await state.update(STATE_KEYS.totalSpins, message.totalSpins);
              await state.update(STATE_KEYS.totalTokensSpent, message.totalTokensSpent);
              break;
            }
            case 'updateStatus': {
              // Update panel title with token count
              if (panel) {
                panel.title = `🎰 QuemaTokens — ${message.tokens} tokens`;
              }
              break;
            }
            case 'resetTokenStats': {
              if (tokenTracker) {
                tokenTracker.resetStats();
              }
              break;
            }
          }
        },
        undefined,
        context.subscriptions
      );

      panel.onDidDispose(() => {
        panel = undefined;
      });
    })
  );

  // ── Auto-spin on Copilot/Inline Chat (Layer 3 fallback) ──
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (!panel) return;
      const uri = e.document.uri.toString();
      if (uri.includes('vscode-chat') || uri.includes('copilot') || uri.includes('inline-chat')) {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          panel?.webview.postMessage({ command: 'spin' });
        }, 500);
      }
    })
  );

  // ── Chat Participant: @quematokens ──
  const chatParticipant = vscode.chat.createChatParticipant('quematokens', async (request, _context, _stream, _token) => {
    if (!tokenTracker) {
      request.chatResponse.sendMarkdownText('QuemaTokens tracker is not initialized yet.');
      return;
    }

    const prompt = request.prompt.toLowerCase();

    if (request.command === 'stats' || prompt.includes('stats') || prompt.includes('usage') || prompt.includes('tokens')) {
      const stats = tokenTracker.getStatsString();
      request.chatResponse.sendMarkdownText(
        '```\n' + stats + '\n```\n\n' +
        '_Use `@quematokens /reset` to clear stats or `@quematokens /export` to download data._'
      );
    } else if (request.command === 'reset' || prompt.includes('reset')) {
      tokenTracker.resetStats();
      request.chatResponse.sendMarkdownText('✅ Token usage statistics have been reset.');
    } else if (request.command === 'export' || prompt.includes('export')) {
      const data = tokenTracker.getExportData();
      request.chatResponse.sendMarkdownText(
        '```\n' + data.slice(0, 3000) + (data.length > 3000 ? '\n... (truncated)' : '') + '\n```'
      );
    } else {
      // Default: show brief stats
      const today = tokenTracker.getTodayUsage();
      const allTime = tokenTracker.getAllTimeTotal();
      const todayTotal = today.totalInput + today.totalOutput;
      const allTimeTotal = allTime.inputTokens + allTime.outputTokens;
      request.chatResponse.sendMarkdownText(
        `**🎰 QuemaTokens** — Real-time AI token tracker\n\n` +
        `🕐 **Today:** ${todayTotal.toLocaleString()} tokens (${today.totalInput.toLocaleString()} in, ${today.totalOutput.toLocaleString()} out)\n` +
        `🌍 **All Time:** ${allTimeTotal.toLocaleString()} tokens\n\n` +
        `_Try \`/stats\` for full breakdown, \`/reset\` to clear, or \`/export\` for JSON data._`
      );
    }
  });

  // Set up chat participant icon
  chatParticipant.icon = vscode.Uri.joinPath(context.extensionUri, 'icons', 'icon16.png');

  context.subscriptions.push(chatParticipant);
}

export function deactivate() {
  if (tokenTracker) {
    tokenTracker.dispose();
  }
  console.log('QuemaTokens se desactivó 👋');
}
