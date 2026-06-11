import * as vscode from 'vscode';
import * as https from 'https';

// ── Provider Definitions ──

export interface ProviderDef {
  id: string;
  name: string;
  color: string;
  icon: string;           // filename in media/
  tokenCountMethod: 'tiktoken' | 'anthropic' | 'gemini' | 'zhipu' | 'local';
  modelPatterns: RegExp[];  // regex patterns to identify model names
  settingKey?: string;      // optional VSCode setting key for API key
}

export const PROVIDERS: ProviderDef[] = [
  {
    id: 'copilot',
    name: 'Copilot',
    color: '#6e40c9',
    icon: 'codex.png',
    tokenCountMethod: 'local',
    modelPatterns: [/copilot/i, /codex/i],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    color: '#10a37f',
    icon: 'codex.png',
    tokenCountMethod: 'tiktoken',
    modelPatterns: [/gpt-4o/i, /gpt-4\.1/i, /gpt-4-turbo/i, /gpt-3\.5/i, /codex/i, /o1/i, /o3/i, /o4-mini/i],
    settingKey: 'openaiApiKey',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    color: '#d4a574',
    icon: 'claude.png',
    tokenCountMethod: 'anthropic',
    modelPatterns: [/claude/i],
    settingKey: 'anthropicApiKey',
  },
  {
    id: 'google',
    name: 'Google',
    color: '#4285f4',
    icon: 'gemini.png',
    tokenCountMethod: 'gemini',
    modelPatterns: [/gemini/i],
    settingKey: 'geminiApiKey',
  },
  {
    id: 'xai',
    name: 'xAI',
    color: '#ffffff',
    icon: 'xai.png',
    tokenCountMethod: 'tiktoken',
    modelPatterns: [/grok/i],
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    color: '#4d6bfe',
    icon: 'deepseek.png',
    tokenCountMethod: 'local',
    modelPatterns: [/deepseek/i],
  },
  {
    id: 'qwen',
    name: 'Qwen',
    color: '#6f42c1',
    icon: 'qwen.png',
    tokenCountMethod: 'tiktoken',
    modelPatterns: [/qwen/i],
  },
  {
    id: 'zhipu',
    name: 'Z.AI',
    color: '#00bfa5',
    icon: 'zai.png',
    tokenCountMethod: 'zhipu',
    modelPatterns: [/glm/i, /chatglm/i, /z\.ai/i],
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    color: '#e74c3c',
    icon: 'minimax.png',
    tokenCountMethod: 'local',
    modelPatterns: [/minimax/i, /abab/i],
  },
  {
    id: 'nvidia',
    name: 'NVIDIA',
    color: '#76b900',
    icon: 'nvidia.png',
    tokenCountMethod: 'tiktoken',
    modelPatterns: [/nvidia/i, /nemotron/i],
  },
  {
    id: 'mistral',
    name: 'Mistral',
    color: '#ff7000',
    icon: 'mistral.png',
    tokenCountMethod: 'tiktoken',
    modelPatterns: [/mistral/i, /mixtral/i, /codestral/i],
  },
];

// ── Provider Lookup ──

export function identifyProvider(modelName: string): ProviderDef | undefined {
  for (const provider of PROVIDERS) {
    for (const pattern of provider.modelPatterns) {
      if (pattern.test(modelName)) {
        return provider;
      }
    }
  }
  return undefined;
}

// ── Token Counting Methods ──

// Lazy-load tiktoken
let tiktokenEncode: ((text: string) => number[]) | undefined;
let tiktokenLoading = false;
let tiktokenFailed = false;

async function getTiktokenEncoder(): Promise<((text: string) => number[]) | undefined> {
  if (tiktokenFailed) return undefined;
  if (tiktokenEncode) return tiktokenEncode;
  if (tiktokenLoading) {
    // Wait for load
    return new Promise((resolve) => {
      const check = setInterval(() => {
        if (tiktokenEncode || tiktokenFailed) {
          clearInterval(check);
          resolve(tiktokenEncode);
        }
      }, 100);
    });
  }

  tiktokenLoading = true;
  try {
    const tiktoken = await import('js-tiktoken');
    const encoding = tiktoken.encodingForModel('gpt-4o') || tiktoken.getEncoding('cl100k_base');
    tiktokenEncode = encoding.encode.bind(encoding);
  } catch {
    console.warn('[QuemaTokens] Failed to load js-tiktoken, using heuristic fallback');
    tiktokenFailed = true;
  }
  tiktokenLoading = false;
  return tiktokenEncode;
}

function heuristicTokenCount(text: string): number {
  // Rough estimate: ~4 chars per token for English/code
  return Math.ceil(text.length / 4);
}

export async function countTokens(provider: ProviderDef, text: string, apiKey?: string): Promise<number> {
  if (!text) return 0;

  try {
    switch (provider.tokenCountMethod) {
      case 'tiktoken': {
        const encoder = await getTiktokenEncoder();
        if (encoder) {
          return encoder(text).length;
        }
        return heuristicTokenCount(text);
      }

      case 'anthropic': {
        if (!apiKey) return heuristicTokenCount(text);
        return countAnthropicTokens(text, apiKey);
      }

      case 'gemini': {
        if (!apiKey) return heuristicTokenCount(text);
        return countGeminiTokens(text, apiKey);
      }

      case 'zhipu': {
        if (!apiKey) return heuristicTokenCount(text);
        return countZhipuTokens(text, apiKey);
      }

      case 'local':
      default:
        return heuristicTokenCount(text);
    }
  } catch {
    return heuristicTokenCount(text);
  }
}

// ── API-based Token Counters ──

function httpsPost(url: URL, body: string, headers: Record<string, string>): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method: 'POST', headers }, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(5000, () => { req.destroy(); reject(new Error('timeout')); });
    req.write(body);
    req.end();
  });
}

async function countAnthropicTokens(text: string, apiKey: string): Promise<number> {
  const url = new URL('https://api.anthropic.com/v1/messages/count_tokens');
  const body = JSON.stringify({ model: 'claude-sonnet-4-20250514', messages: [{ role: 'user', content: text }] });
  const result = await httpsPost(url, body, {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true',
  });
  const parsed = JSON.parse(result);
  return parsed.input_tokens ?? heuristicTokenCount(text);
}

async function countGeminiTokens(text: string, apiKey: string): Promise<number> {
  const url = new URL(`https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:countTokens?key=${apiKey}`);
  const body = JSON.stringify({ contents: [{ parts: [{ text }] }] });
  const result = await httpsPost(url, body, { 'Content-Type': 'application/json' });
  const parsed = JSON.parse(result);
  return parsed.totalTokens ?? heuristicTokenCount(text);
}

async function countZhipuTokens(text: string, apiKey: string): Promise<number> {
  const url = new URL('https://api.z.ai/api/paas/v4/tokenizer');
  const body = JSON.stringify({ prompt: text });
  const result = await httpsPost(url, body, {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  });
  const parsed = JSON.parse(result);
  return parsed.data?.token_count ?? parsed.token_count ?? heuristicTokenCount(text);
}
