import * as vscode from 'vscode';
import { getWebviewHtml } from './webview';
import { TokenTracker } from './tokenTracker';

const STATE_KEYS = {
  credits: 'quematokens.credits',
  record: 'quematokens.record',
  betIndex: 'quematokens.betIndex',
  totalSpins: 'quematokens.totalSpins',
  totalTokensSpent: 'quematokens.totalTokensSpent',
  jackpot: 'quematokens.jackpot',
  gameStats: 'quematokens.gameStats',
} as const;

const DEFAULT_GAME_STATS = {
  wins: 0, losses: 0, biggestWin: 0,
  jackpotsWon: 0, streak: 0, bestStreak: 0,
  totalBet: 0, totalWon: 0,
};

let tokenTracker: TokenTracker | undefined;
let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
  console.log('QuemaTokens se activó 🎰');
  const state = context.globalState;
  let panel: vscode.WebviewPanel | undefined;

  outputChannel = vscode.window.createOutputChannel('QuemaTokens');
  context.subscriptions.push(outputChannel);

  tokenTracker = new TokenTracker(outputChannel);
  tokenTracker.initContext(
    context,
    (key: string, defaultValue?: any) => state.get(key, defaultValue),
    (key: string, value: any) => state.update(key, value)
  );

  // Feed AI tokens into jackpot (no auto-spin)
  tokenTracker.onChange((trackerState) => {
    if (!panel) { return; }
    panel.webview.postMessage({
      command: 'updateTokenStats',
      todayUsage: trackerState.todayUsage,
      allTimeTotal: trackerState.allTimeTotal,
    });

    // Feed real tokens to jackpot
    const outTokens = trackerState.todayUsage.totalOutput || 0;
    if (outTokens > 0) {
      panel.webview.postMessage({ command: 'aiTokensFed', tokens: outTokens });
    }

    const total = (trackerState.allTimeTotal.inputTokens || 0) + (trackerState.allTimeTotal.outputTokens || 0);
    panel.title = `🎰 QuemaTokens — Bote: ${state.get<number>(STATE_KEYS.jackpot, 500).toLocaleString()}`;
  });

  tokenTracker.start();

  // ── Commands ──

  context.subscriptions.push(
    vscode.commands.registerCommand('quematokens.reset', async () => {
      await state.update(STATE_KEYS.credits, 1000);
      await state.update(STATE_KEYS.record, 0);
      await state.update(STATE_KEYS.betIndex, 0);
      await state.update(STATE_KEYS.totalSpins, 0);
      await state.update(STATE_KEYS.totalTokensSpent, 0);
      await state.update(STATE_KEYS.jackpot, 500);
      await state.update(STATE_KEYS.gameStats, { ...DEFAULT_GAME_STATS });
      vscode.window.showInformationMessage('QuemaTokens: ¡reiniciado! 🎰');
      if (panel) { panel.webview.postMessage({ command: 'reset' }); }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('quematokens.spin', () => {
      if (panel) { panel.webview.postMessage({ command: 'spin' }); }
      else { vscode.window.showInformationMessage('QuemaTokens: abre primero la máquina'); }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('quematokens.stats', () => {
      if (!tokenTracker) { return; }
      const stats = tokenTracker.getStatsString();
      outputChannel.show();
      outputChannel.appendLine('\n' + stats + '\n');
      vscode.window.showInformationMessage(stats);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('quematokens.exportUsage', async () => {
      if (!tokenTracker) { return; }
      const doc = await vscode.workspace.openTextDocument({ content: tokenTracker.getExportData(), language: 'json' });
      await vscode.window.showTextDocument(doc);
    })
  );

  // ── Open panel ──
  context.subscriptions.push(
    vscode.commands.registerCommand('quematokens.open', () => {
      if (panel) {
        panel.reveal();
        if (tokenTracker) {
          panel.webview.postMessage({
            command: 'updateTokenStats',
            todayUsage: tokenTracker.getTodayUsage(),
            allTimeTotal: tokenTracker.getAllTimeTotal(),
          });
        }
        return;
      }

      panel = vscode.window.createWebviewPanel('quematokens', '🎰 QuemaTokens', vscode.ViewColumn.Beside, {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')],
      });

      panel.webview.html = getWebviewHtml(context.extensionUri, panel.webview);

      // Send initial state
      panel.webview.postMessage({
        command: 'init',
        credits: state.get<number>(STATE_KEYS.credits, 1000),
        record: state.get<number>(STATE_KEYS.record, 0),
        betIndex: state.get<number>(STATE_KEYS.betIndex, 0),
        totalSpins: state.get<number>(STATE_KEYS.totalSpins, 0),
        totalTokensSpent: state.get<number>(STATE_KEYS.totalTokensSpent, 0),
        jackpot: state.get<number>(STATE_KEYS.jackpot, 500),
        gameStats: state.get<any>(STATE_KEYS.gameStats, { ...DEFAULT_GAME_STATS }),
      });

      if (tokenTracker) {
        panel.webview.postMessage({
          command: 'updateTokenStats',
          todayUsage: tokenTracker.getTodayUsage(),
          allTimeTotal: tokenTracker.getAllTimeTotal(),
        });
      }

      // Handle webview messages
      panel.webview.onDidReceiveMessage(async (message) => {
        switch (message.command) {
          case 'saveState':
            await state.update(STATE_KEYS.credits, message.credits);
            await state.update(STATE_KEYS.record, message.record);
            await state.update(STATE_KEYS.betIndex, message.betIndex);
            await state.update(STATE_KEYS.totalSpins, message.totalSpins);
            await state.update(STATE_KEYS.totalTokensSpent, message.totalTokensSpent);
            await state.update(STATE_KEYS.jackpot, message.jackpot);
            await state.update(STATE_KEYS.gameStats, message.gameStats);
            if (panel) {
              panel.title = `🎰 QuemaTokens — Bote: ${Number(message.jackpot).toLocaleString()}`;
            }
            break;
          case 'updateStatus':
            if (panel) { panel.title = `🎰 QuemaTokens — ${message.tokens} tokens`; }
            break;
          case 'resetTokenStats':
            if (tokenTracker) { tokenTracker.resetStats(); }
            break;
        }
      }, undefined, context.subscriptions);

      panel.onDidDispose(() => { panel = undefined; });
    })
  );

  // ── Chat Participant ──
  try {
    const participant = vscode.chat.createChatParticipant('quematokens', async (request, _ctx, _stream, _token) => {
      if (!tokenTracker) { return; }
      const prompt = request.prompt.toLowerCase();
      if (request.command === 'stats' || prompt.includes('stats') || prompt.includes('tokens')) {
        request.chatResponse.sendMarkdownText('```\n' + tokenTracker.getStatsString() + '\n```');
      } else if (request.command === 'reset' || prompt.includes('reset')) {
        tokenTracker.resetStats();
        request.chatResponse.sendMarkdownText('✅ Stats reseteados.');
      } else if (request.command === 'export' || prompt.includes('export')) {
        request.chatResponse.sendMarkdownText('```json\n' + tokenTracker.getExportData().slice(0, 3000) + '\n```');
      } else {
        const today = tokenTracker.getTodayUsage();
        const allTime = tokenTracker.getAllTimeTotal();
        request.chatResponse.sendMarkdownText(
          `**🎰 QuemaTokens** — Hoy: ${(today.totalInput + today.totalOutput).toLocaleString()} tokens | Total: ${(allTime.inputTokens + allTime.outputTokens).toLocaleString()} tokens\n\n_Comandos: /stats, /reset, /export_`
        );
      }
    });
    participant.icon = vscode.Uri.joinPath(context.extensionUri, 'icons', 'icon16.png');
    context.subscriptions.push(participant);
  } catch { /* chat API may not be available */ }
}

export function deactivate() {
  if (tokenTracker) { tokenTracker.dispose(); }
}
