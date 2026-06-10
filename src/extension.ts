import * as vscode from 'vscode';
import * as path from 'path';
import { getWebviewHtml } from './webview';

const STATE_KEYS = {
  credits: 'quematokens.credits',
  record: 'quematokens.record',
  betIndex: 'quematokens.betIndex',
  totalSpins: 'quematokens.totalSpins',
  totalTokensSpent: 'quematokens.totalTokensSpent',
} as const;

export function activate(context: vscode.ExtensionContext) {
  console.log('QuemaTokens se activó 🎰');

  const state = context.globalState;
  let panel: vscode.WebviewPanel | undefined;

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

  // Open panel command
  context.subscriptions.push(
    vscode.commands.registerCommand('quematokens.open', () => {
      if (panel) {
        panel.reveal();
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

  // ── Auto-spin on Copilot/Inline Chat ──
  // Listen for text document changes that happen in chat input or copilot
  // We use onDidChangeTextDocument and detect chat-related URIs
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (!panel) return;
      // Detect chat input changes (VSCode chat sessions have specific URI schemes)
      const uri = e.document.uri.toString();
      if (uri.includes('vscode-chat') || uri.includes('copilot') || uri.includes('inline-chat')) {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          panel?.webview.postMessage({ command: 'spin' });
        }, 500);
      }
    })
  );

  // Also register a code action / completion provider that detects chat submissions
  // This catches the GitHub Copilot Chat submit action
  context.subscriptions.push(
    vscode.languages.onDidChangeDiagnostics(() => {
      // Diagnostics change frequently; we use a heavier debounce
      // This is a fallback for inline chat detection
      if (!panel) return;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        // Only auto-spin if user hasn't explicitly disabled it
        const autoSpin = vscode.workspace.getConfiguration('quematokens').get<boolean>('autoSpin', true);
        if (autoSpin) {
          // We don't actually spin on every diagnostic change — too noisy
          // The real trigger is the text document change above
        }
      }, 2000);
    })
  );
}

export function deactivate() {
  console.log('QuemaTokens se desactivó 👋');
}
