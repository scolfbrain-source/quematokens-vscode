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

function getState(state: vscode.Memento) {
  return {
    credits: state.get<number>(STATE_KEYS.credits, 1000),
    record: state.get<number>(STATE_KEYS.record, 0),
    betIndex: state.get<number>(STATE_KEYS.betIndex, 0),
    totalSpins: state.get<number>(STATE_KEYS.totalSpins, 0),
    totalTokensSpent: state.get<number>(STATE_KEYS.totalTokensSpent, 0),
    jackpot: state.get<number>(STATE_KEYS.jackpot, 500),
    gameStats: state.get<any>(STATE_KEYS.gameStats, { ...DEFAULT_GAME_STATS }),
  };
}

function setupWebviewMessages(webview: vscode.Webview, state: vscode.Memento, panel?: vscode.WebviewPanel) {
  webview.onDidReceiveMessage(async (message) => {
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
  });
}

function sendInitState(webview: vscode.Webview, state: vscode.Memento) {
  const s = getState(state);
  webview.postMessage({ command: 'init', ...s });
  if (tokenTracker) {
    webview.postMessage({
      command: 'updateTokenStats',
      todayUsage: tokenTracker.getTodayUsage(),
      allTimeTotal: tokenTracker.getAllTimeTotal(),
    });
  }
}

function setupTokenFeed(webview: vscode.Webview, state: vscode.Memento) {
  if (!tokenTracker) { return; }
  tokenTracker.onChange((trackerState) => {
    webview.postMessage({
      command: 'updateTokenStats',
      todayUsage: trackerState.todayUsage,
      allTimeTotal: trackerState.allTimeTotal,
    });
    const outTokens = trackerState.todayUsage.totalOutput || 0;
    if (outTokens > 0) {
      webview.postMessage({ command: 'aiTokensFed', tokens: outTokens });
    }
  });
}

export function activate(context: vscode.ExtensionContext) {
  const state = context.globalState;
  outputChannel = vscode.window.createOutputChannel('QuemaTokens');
  context.subscriptions.push(outputChannel);

  tokenTracker = new TokenTracker(outputChannel);
  tokenTracker.initContext(
    context,
    (key: string, defaultValue?: any) => state.get(key, defaultValue),
    (key: string, value: any) => state.update(key, value)
  );
  tokenTracker.start();

  // ── Activity Bar Webview View (sidebar icon) ──
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('quematokens-main', {
      resolveWebviewView(webviewView) {
        webviewView.webview.options = {
          enableScripts: true,
        };
        webviewView.webview.html = getWebviewHtml(context.extensionUri, webviewView.webview);
        setupWebviewMessages(webviewView.webview, state);
        sendInitState(webviewView.webview, state);
        setupTokenFeed(webviewView.webview, state);
      }
    }, { webviewOptions: { retainContextWhenHidden: true } })
  );

  // ── Commands ──

  context.subscriptions.push(
    vscode.commands.registerCommand('quematokens.open', () => {
      const panel = vscode.window.createWebviewPanel('quematokens', '🎰 QuemaTokens', vscode.ViewColumn.Beside, {
        enableScripts: true,
        retainContextWhenHidden: true,
      });
      panel.webview.html = getWebviewHtml(context.extensionUri, panel.webview);
      setupWebviewMessages(panel.webview, state, panel);
      sendInitState(panel.webview, state);
      setupTokenFeed(panel.webview, state);
    })
  );

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
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('quematokens.spin', () => {
      vscode.window.showInformationMessage('QuemaTokens: usa la palanca en el panel 🎰');
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
    context.subscriptions.push(participant);
  } catch { /* chat API may not be available */ }
}

export function deactivate() {
  if (tokenTracker) { tokenTracker.dispose(); }
}
