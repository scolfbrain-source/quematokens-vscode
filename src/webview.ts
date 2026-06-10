import * as vscode from 'vscode';
import * as path from 'path';

export function getWebviewHtml(extensionUri: vscode.Uri, webview: vscode.Webview): string {
  // Helper to convert file paths to webview URIs
  const mediaUri = (fileName: string) =>
    webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', fileName));

  const symbolImages: Record<string, string> = {
    claude: mediaUri('claude.png'),
    codex: mediaUri('codex.png'),
    gemini: mediaUri('gemini.png'),
    xai: mediaUri('xai.png'),
    deepseek: mediaUri('deepseek.png'),
    qwen: mediaUri('qwen.png'),
    zai: mediaUri('zai.png'),
    minimax: mediaUri('minimax.png'),
    nvidia: mediaUri('nvidia.png'),
    mistral: mediaUri('mistral.png'),
  };

  const imgMapJson = JSON.stringify(symbolImages);

  return /*html*/ `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src ${webview.cspSource}; script-src 'unsafe-inline';">
  <title>QuemaTokens</title>
  <style>${getCSS()}</style>
</head>
<body>
  <div class="maquina">
    <div class="marquesina">
      <div class="luces" id="luces"></div>
      <h1>QUEMATOKENS</h1>
      <div class="luces" id="luces2"></div>
    </div>

    <div class="token-counter">
      <span class="etiqueta">TOKENS QUEMADOS</span>
      <span class="valor" id="tokens-quemados">0</span>
    </div>

    <div class="cuerpo">
      <div class="panel-carretes">
        <div class="ventana">
          <div class="carrete" id="carrete-0"><div class="tira"></div></div>
          <div class="carrete" id="carrete-1"><div class="tira"></div></div>
          <div class="carrete" id="carrete-2"><div class="tira"></div></div>
          <div class="linea-premio"></div>
        </div>
      </div>

      <div class="palanca-zona">
        <div class="palanca" id="palanca">
          <div class="brazo" id="brazo">
            <div class="vara"></div>
            <div class="bola"></div>
          </div>
          <div class="base-palanca"></div>
        </div>
      </div>
    </div>

    <div class="panel-inferior">
      <div class="display">
        <span class="etiqueta">TOKENS</span>
        <span class="valor" id="creditos">--</span>
      </div>
      <div class="mensaje" id="mensaje">Tira de la palanca</div>
      <div class="display premio">
        <span class="etiqueta">RÉCORD</span>
        <span class="valor" id="record">0</span>
      </div>
    </div>

    <div class="controles">
      <div class="control-apuesta">
        <button class="boton-control" id="apuesta-menos">&minus;</button>
        <div class="display compacto">
          <span class="etiqueta">APUESTA</span>
          <span class="valor" id="apuesta">5</span>
        </div>
        <button class="boton-control" id="apuesta-mas">+</button>
      </div>
      <button class="boton-control ancho" id="recargar">+100</button>
      <button class="boton-control" id="info" title="Ver tabla de premios">i</button>
      <button class="boton-control" id="silencio" title="Activar o quitar sonido">
        <svg viewBox="0 0 24 24" width="18" height="18">
          <path d="M4 9 h4 l5 -5 v16 l-5 -5 H4 z" fill="currentColor"/>
          <path class="ondas" d="M16 8 q3 4 0 8 M18.5 6 q4.5 6 0 12" fill="none"
                stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <path class="tachado oculto" d="M16 9 l6 6 M22 9 l-6 6" fill="none"
                stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
    </div>

    <div class="tabla-pagos oculto" id="tabla-pagos">
      <div class="tabla-cabecera">
        <span id="tabla-titulo">Premios</span>
        <button class="boton-control" id="cerrar-tabla">&times;</button>
      </div>
      <div class="tabla-filas" id="tabla-filas"></div>
      <p class="tabla-nota">A mayor apuesta, mayor premio. Quema con cabeza.</p>
    </div>

    <!-- Provider Usage Panel -->
    <div class="providers-panel" id="providers-panel">
      <div class="providers-header" id="providers-toggle">
        <span>📊 Live Token Tracking</span>
        <span class="providers-arrow" id="providers-arrow">▼</span>
      </div>
      <div class="providers-body" id="providers-body">
        <div class="providers-summary">
          <div class="providers-stat">
            <span class="providers-stat-label">Today</span>
            <span class="providers-stat-value" id="stat-today-total">0</span>
          </div>
          <div class="providers-stat">
            <span class="providers-stat-label">All Time</span>
            <span class="providers-stat-value" id="stat-alltime-total">0</span>
          </div>
          <div class="providers-stat">
            <span class="providers-stat-label">In / Out</span>
            <span class="providers-stat-value" id="stat-today-inout">0 / 0</span>
          </div>
        </div>
        <div class="providers-list" id="providers-list"></div>
        <div class="providers-footer">
          <span id="providers-source">Watching Copilot sessions…</span>
        </div>
      </div>
    </div>
  </div>

  <script>${getScript(imgMapJson)}</script>
</body>
</html>`;
}

function getCSS(): string {
  return `
:root {
  --rojo: #b3202c;
  --rojo-oscuro: #7e1019;
  --dorado: #e8b94a;
  --dorado-claro: #f6dd9a;
  --crema: #f7efe0;
  --sombra: rgba(0, 0, 0, 0.45);
  --alto-celda: 78px;
  --purple: #7c3aed;
  --purple-oscuro: #5b21b6;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
  background: #1a1423;
  font-family: Georgia, "Times New Roman", serif;
  user-select: none;
  padding: 8px;
}

.maquina {
  position: relative;
  background: linear-gradient(180deg, var(--rojo) 0%, var(--rojo-oscuro) 100%);
  border: 6px solid var(--dorado);
  border-radius: 18px;
  padding: 10px 12px 14px;
  box-shadow: inset 0 2px 8px rgba(255,255,255,0.25), 0 8px 22px var(--sombra);
}

/* Token Counter */
.token-counter {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--purple);
  border: 2px solid var(--dorado);
  border-radius: 10px;
  padding: 5px 12px;
  margin-bottom: 8px;
}

.token-counter .etiqueta {
  color: var(--dorado-claro);
  font-size: 10px;
  letter-spacing: 2px;
}

.token-counter .valor {
  color: #ffd9d9;
  font-family: "Courier New", monospace;
  font-size: 20px;
  font-weight: bold;
}

/* Marquesina */
.marquesina {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  background: var(--rojo-oscuro);
  border: 3px solid var(--dorado);
  border-radius: 12px;
  padding: 6px 10px;
  margin-bottom: 8px;
  overflow: hidden;
}

.marquesina h1 {
  flex: 1;
  min-width: 0;
  text-align: center;
  color: var(--dorado-claro);
  font-size: 17px;
  letter-spacing: 3px;
  text-shadow: 0 2px 3px var(--sombra);
  white-space: nowrap;
  overflow: hidden;
}

.luces { display: flex; gap: 5px; flex-shrink: 0; }

.luz {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #5a4a20;
}

.luz.encendida {
  background: var(--dorado-claro);
  box-shadow: 0 0 7px var(--dorado-claro);
}

/* Cuerpo: carretes + palanca */
.cuerpo {
  display: flex;
  align-items: center;
  gap: 8px;
}

.panel-carretes {
  flex: 1;
  background: var(--dorado);
  border-radius: 12px;
  padding: 8px;
  box-shadow: inset 0 -3px 6px rgba(0,0,0,0.3);
}

.ventana {
  position: relative;
  display: flex;
  gap: 6px;
  background: #111;
  border-radius: 8px;
  padding: 6px;
  height: calc(var(--alto-celda) + 12px);
  overflow: hidden;
}

.carrete {
  flex: 1;
  position: relative;
  overflow: hidden;
  background: linear-gradient(180deg, #cfc8b8 0%, var(--crema) 25%, #fff 50%, var(--crema) 75%, #cfc8b8 100%);
  border-radius: 5px;
  height: var(--alto-celda);
}

.tira {
  position: absolute;
  left: 0;
  width: 100%;
  will-change: transform;
}

.celda {
  height: var(--alto-celda);
  display: flex;
  align-items: center;
  justify-content: center;
}

.celda img { width: 52px; height: 52px; object-fit: contain; }

.linea-premio {
  position: absolute;
  left: 4px;
  right: 4px;
  top: 50%;
  height: 2px;
  background: rgba(179, 32, 44, 0.55);
  pointer-events: none;
}

/* Palanca */
.palanca-zona {
  width: 58px;
  display: flex;
  justify-content: center;
}

.palanca {
  position: relative;
  height: 130px;
  width: 44px;
  cursor: grab;
}

.palanca.bloqueada { cursor: not-allowed; opacity: 0.75; }

.brazo {
  position: absolute;
  bottom: 26px;
  left: 50%;
  width: 12px;
  height: 88px;
  margin-left: -6px;
  transform-origin: bottom center;
  transition: transform 0.12s ease-out;
}

.brazo.soltada { transition: transform 0.45s cubic-bezier(0.2, 1.6, 0.4, 1); }

.vara {
  position: absolute;
  bottom: 0;
  left: 3px;
  width: 6px;
  height: 100%;
  background: linear-gradient(90deg, #888, #ddd, #888);
  border-radius: 3px;
}

.bola {
  position: absolute;
  top: -18px;
  left: -8px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #e96a6a, var(--rojo) 60%, var(--rojo-oscuro));
  box-shadow: 0 3px 6px var(--sombra);
}

.base-palanca {
  position: absolute;
  bottom: 0;
  left: 50%;
  width: 34px;
  height: 30px;
  margin-left: -17px;
  background: linear-gradient(180deg, #c9a23a, #8a6c20);
  border-radius: 8px 8px 4px 4px;
  box-shadow: 0 3px 5px var(--sombra);
}

/* Panel inferior */
.panel-inferior {
  display: flex;
  align-items: stretch;
  gap: 8px;
  margin-top: 10px;
}

.display {
  background: #111;
  border: 2px solid var(--dorado);
  border-radius: 8px;
  padding: 5px 10px;
  text-align: center;
  min-width: 86px;
}

.display .etiqueta {
  display: block;
  color: var(--dorado);
  font-size: 9px;
  letter-spacing: 2px;
}

.display .valor {
  display: block;
  color: #ffd9d9;
  font-family: "Courier New", monospace;
  font-size: 22px;
  font-weight: bold;
}

.display.premio .valor { color: #7CFC8a; }

.mensaje {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--dorado-claro);
  font-size: 14px;
  font-style: italic;
  text-align: center;
}

.mensaje.gano {
  color: #ffe98a;
  font-style: normal;
  font-weight: bold;
  animation: parpadeo 0.4s steps(2) 6;
}

@keyframes parpadeo {
  from { opacity: 1; }
  to { opacity: 0.25; }
}

/* Controles */
.controles {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 10px;
}

.control-apuesta {
  display: flex;
  align-items: center;
  gap: 6px;
}

.display.compacto {
  min-width: 70px;
  padding: 3px 8px;
}

.display.compacto .valor { font-size: 18px; }

.boton-control {
  background: var(--dorado);
  border: none;
  border-radius: 8px;
  min-width: 34px;
  height: 34px;
  font-family: inherit;
  font-size: 17px;
  font-weight: bold;
  color: var(--rojo-oscuro);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.boton-control:hover { background: var(--dorado-claro); }
.boton-control:disabled { opacity: 0.45; cursor: not-allowed; }
.boton-control.ancho { padding: 0 16px; }

/* Tabla de premios */
.tabla-pagos {
  position: absolute;
  inset: 8px;
  background: rgba(17, 10, 12, 0.96);
  border: 3px solid var(--dorado);
  border-radius: 12px;
  padding: 10px 14px;
  display: flex;
  flex-direction: column;
  z-index: 10;
}

.tabla-pagos.oculto { display: none; }

.tabla-cabecera {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--dorado-claro);
  font-size: 16px;
  font-weight: bold;
  letter-spacing: 1px;
  margin-bottom: 8px;
}

.tabla-cabecera .boton-control { min-width: 28px; height: 28px; font-size: 15px; }

.tabla-filas {
  flex: 1;
  overflow-y: auto;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px 14px;
  align-content: start;
}

.fila-pago {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  background: rgba(255,255,255,0.06);
  border-radius: 6px;
  padding: 3px 8px;
}

.fila-pago .combo { display: flex; align-items: center; gap: 2px; }

.fila-pago img {
  width: 17px;
  height: 17px;
  object-fit: contain;
  background: var(--crema);
  border-radius: 3px;
  padding: 1px;
}

.fila-pago .importe {
  color: #7CFC8a;
  font-family: "Courier New", monospace;
  font-size: 14px;
  font-weight: bold;
}

.fila-pago.gordo {
  border: 1px solid var(--dorado);
  background: rgba(232, 185, 74, 0.16);
}

.fila-pago.gordo .importe { color: var(--dorado-claro); }

.fila-pago.segundo {
  border: 1px solid #9a9a9a;
  background: rgba(200, 200, 200, 0.12);
}

.fila-pago.segundo .importe { color: #dcdcdc; }

.tabla-nota {
  margin-top: 8px;
  color: var(--dorado);
  font-size: 11px;
  font-style: italic;
  text-align: center;
}

.oculto { display: none; }

/* ── Provider Usage Panel ── */
.providers-panel {
  margin-top: 10px;
  background: #111;
  border: 2px solid var(--dorado);
  border-radius: 10px;
  overflow: hidden;
}

.providers-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 12px;
  background: var(--purple);
  color: var(--dorado-claro);
  font-size: 12px;
  font-weight: bold;
  letter-spacing: 1px;
  cursor: pointer;
  user-select: none;
}

.providers-arrow {
  font-size: 10px;
  transition: transform 0.2s ease;
}

.providers-arrow.collapsed {
  transform: rotate(-90deg);
}

.providers-body {
  padding: 8px 10px;
  transition: max-height 0.3s ease;
}

.providers-body.collapsed {
  display: none;
}

.providers-summary {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.providers-stat {
  flex: 1;
  background: rgba(255,255,255,0.04);
  border-radius: 6px;
  padding: 4px 6px;
  text-align: center;
}

.providers-stat-label {
  display: block;
  color: var(--dorado);
  font-size: 9px;
  letter-spacing: 1px;
}

.providers-stat-value {
  display: block;
  color: #ffd9d9;
  font-family: "Courier New", monospace;
  font-size: 14px;
  font-weight: bold;
}

.providers-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 200px;
  overflow-y: auto;
}

.provider-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 3px 6px;
  border-radius: 6px;
  background: rgba(255,255,255,0.03);
}

.provider-row:hover {
  background: rgba(255,255,255,0.06);
}

.provider-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.provider-icon {
  width: 18px;
  height: 18px;
  object-fit: contain;
  flex-shrink: 0;
}

.provider-name {
  flex: 1;
  color: #ccc;
  font-size: 11px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.provider-tokens {
  color: var(--dorado-claro);
  font-family: "Courier New", monospace;
  font-size: 12px;
  font-weight: bold;
  text-align: right;
  flex-shrink: 0;
}

.provider-tokens .out { color: #7CFC8a; }
.provider-tokens .in { color: #888; font-size: 10px; }

.providers-footer {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid rgba(255,255,255,0.08);
  color: #666;
  font-size: 10px;
  text-align: center;
  font-style: italic;
}
`;
}

function getScript(imgMapJson: string): string {
  return `
// ── Game Logic (identical to Chrome extension) ──
const SYMBOLS = [
  'mistral', 'nvidia', 'minimax', 'zai', 'qwen',
  'deepseek', 'xai', 'gemini', 'codex', 'claude'
];

const APUESTAS = [5, 10, 25, 50];
const START_CREDITS = 100;
const APUESTA_BASE = APUESTAS[0];

const FRECUENCIA = {
  mistral: 5, nvidia: 3, minimax: 2, zai: 2, qwen: 2,
  deepseek: 2, xai: 1, gemini: 1, codex: 1, claude: 1
};

const IMG = ${imgMapJson};

// Provider color map (keyed by provider ID for webview use)
const PROVIDER_COLORS = {
  openai: '#10a37f', anthropic: '#d4a574', google: '#4285f4',
  xai: '#ffffff', deepseek: '#4d6bfe', qwen: '#6f42c1',
  zhipu: '#00bfa5', minimax: '#e74c3c', nvidia: '#76b900',
  mistral: '#ff7000', unknown: '#888888'
};

const PROVIDER_ICONS = {
  openai: 'codex', anthropic: 'claude', google: 'gemini',
  xai: 'xai', deepseek: 'deepseek', qwen: 'qwen',
  zhipu: 'zai', minimax: 'minimax', nvidia: 'nvidia',
  mistral: 'mistral', unknown: 'codex'
};

function construirTira(orden) {
  const tira = [];
  for (const simbolo of orden) {
    for (let i = 0; i < FRECUENCIA[simbolo]; i++) tira.push(simbolo);
  }
  return tira;
}

function mezclar(tira, semilla) {
  const copia = [...tira];
  let estado = semilla;
  for (let i = copia.length - 1; i > 0; i--) {
    estado = (estado * 1103515245 + 12345) % 2147483648;
    const j = estado % (i + 1);
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

const REELS = [
  construirTira(['mistral', 'nvidia', 'minimax', 'zai', 'qwen', 'deepseek', 'xai', 'gemini', 'codex', 'claude']),
  construirTira(['nvidia', 'mistral', 'qwen', 'minimax', 'claude', 'zai', 'gemini', 'deepseek', 'codex', 'xai']),
  construirTira(['minimax', 'qwen', 'mistral', 'deepseek', 'nvidia', 'zai', 'codex', 'xai', 'gemini', 'claude'])
];

REELS.forEach((tira, i) => {
  REELS[i] = mezclar(tira, 7 + i * 13);
});

function doSpin(rng = Math.random) {
  return REELS.map((tira) => Math.floor(rng() * tira.length));
}

const TABLA_TRES = {
  claude: 250, codex: 150, gemini: 100, xai: 75, deepseek: 60,
  qwen: 40, zai: 30, minimax: 20, nvidia: 15, mistral: 10
};

function calcPayout(simbolos, apuesta = APUESTA_BASE) {
  const multiplicador = apuesta / APUESTA_BASE;
  const [a, b, c] = simbolos;
  if (a === b && b === c) return TABLA_TRES[a] * multiplicador;
  const mistrales = simbolos.filter((s) => s === 'mistral').length;
  if (mistrales === 2) return 5 * multiplicador;
  if (mistrales === 1) return 2 * multiplicador;
  return 0;
}

// ── Sound (WebAudio synthetic) ──
let audioCtx = null;
let silenciado = false;

function getAudioCtx() {
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function tono(frecuencia, duracion, tipo = 'square', volumen = 0.06, retardo = 0) {
  if (silenciado) return;
  try {
    const ac = getAudioCtx();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    const t0 = ac.currentTime + retardo;
    osc.type = tipo;
    osc.frequency.value = frecuencia;
    gain.gain.setValueAtTime(volumen, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duracion);
    osc.connect(gain).connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + duracion);
  } catch(e) {}
}

function sonidoPalanca() {
  tono(180, 0.08, 'square', 0.08);
  tono(110, 0.12, 'square', 0.08, 0.06);
}

function sonidoParada() {
  tono(320, 0.06, 'triangle', 0.09);
}

function sonidoPremio(importe) {
  const notas = importe >= 100
    ? [523, 659, 784, 1047, 784, 1047, 1319]
    : [523, 659, 784, 1047];
  notas.forEach((f, i) => tono(f, 0.18, 'triangle', 0.09, i * 0.12));
}

function sonidoFallo() {
  tono(150, 0.2, 'sawtooth', 0.04);
}

// ── Slot Machine UI ──
const ALTO_CELDA = 78;
const REPETICIONES = 7;
const VUELTAS = [2, 3, 4];
const DURACIONES = [1100, 1600, 2100];

const $ = (id) => document.getElementById(id);
const tiras = [...document.querySelectorAll('.tira')];
const brazo = $('brazo');
const palanca = $('palanca');
const mensaje = $('mensaje');
const displayCreditos = $('creditos');
const displayRecord = $('record');
const displayApuesta = $('apuesta');
const displayTokensQuemados = $('tokens-quemados');
const botonMenos = $('apuesta-menos');
const botonMas = $('apuesta-mas');
const botonRecargar = $('recargar');
const botonSilencio = $('silencio');
const tablaPagos = $('tabla-pagos');

let creditos = START_CREDITS;
let record = 0;
let indiceApuesta = 0;
let girando = false;
let indices = [0, 0, 0];
let totalSpins = 0;
let totalTokensSpent = 0;

const apuesta = () => APUESTAS[indiceApuesta];

function montarCarretes() {
  tiras.forEach((tira, i) => {
    const celdas = [];
    for (let r = 0; r < REPETICIONES; r++) {
      for (const simbolo of REELS[i]) {
        celdas.push('<div class="celda"><img src="' + IMG[simbolo] + '" alt="' + simbolo + '"></div>');
      }
    }
    tira.innerHTML = celdas.join('');
    colocar(tira, indices[i]);
  });
}

function colocar(tira, indice) {
  tira.style.transition = 'none';
  tira.style.transform = 'translateY(' + (-indice * ALTO_CELDA) + 'px)';
}

function girarCarrete(numero, destino, duracion) {
  return new Promise((resolver) => {
    const tira = tiras[numero];
    const largo = REELS[numero].length;
    const actual = indices[numero];
    const avance = VUELTAS[numero] * largo + ((destino - actual + largo) % largo);
    const final = actual + avance;

    tira.getBoundingClientRect();
    tira.style.transition = 'transform ' + duracion + 'ms cubic-bezier(0.15, 0.6, 0.25, 1)';
    tira.style.transform = 'translateY(' + (-final * ALTO_CELDA) + 'px)';

    tira.addEventListener('transitionend', () => {
      indices[numero] = destino;
      colocar(tira, destino);
      sonidoParada();
      resolver();
    }, { once: true });
  });
}

async function tirar() {
  if (girando) return;
  if (creditos < apuesta()) {
    mensaje.textContent = 'Sin tokens: recarga con +100';
    return;
  }

  girando = true;
  palanca.classList.add('bloqueada');
  botonMenos.disabled = true;
  botonMas.disabled = true;
  mensaje.classList.remove('gano');
  mensaje.textContent = 'Girando...';

  creditos -= apuesta();
  totalTokensSpent += apuesta();
  totalSpins++;
  pintarMarcadores();
  sonidoPalanca();

  const resultado = doSpin();
  await Promise.all(resultado.map((destino, i) => girarCarrete(i, destino, DURACIONES[i])));

  const simbolos = resultado.map((idx, i) => REELS[i][idx]);
  const premio = calcPayout(simbolos, apuesta());

  if (premio > 0) {
    creditos += premio;
    if (premio > record) {
      record = premio;
      mensaje.textContent = '¡RÉCORD! +' + premio;
    } else {
      mensaje.textContent = '¡PREMIO! +' + premio;
    }
    mensaje.classList.add('gano');
    sonidoPremio(premio);
    parpadearLuces();
  } else {
    mensaje.textContent = 'Otra vez será...';
    sonidoFallo();
  }

  pintarMarcadores();
  saveState();

  girando = false;
  palanca.classList.remove('bloqueada');
  botonMenos.disabled = false;
  botonMas.disabled = false;

  if (creditos < apuesta()) {
    mensaje.textContent = 'Sin tokens: recarga con +100';
  }
}

function pintarMarcadores() {
  displayCreditos.textContent = String(creditos);
  displayRecord.textContent = String(record);
  displayApuesta.textContent = String(apuesta());
  displayTokensQuemados.textContent = String(totalTokensSpent);
}

// ── State persistence via VSCode extension host ──
function saveState() {
  if (typeof acquireVsCodeApi !== 'undefined') {
    vscode.postMessage({
      command: 'saveState',
      credits: creditos,
      record: record,
      betIndex: indiceApuesta,
      totalSpins: totalSpins,
      totalTokensSpent: totalTokensSpent,
    });
    vscode.postMessage({
      command: 'updateStatus',
      tokens: totalTokensSpent,
    });
  }
}

// ── Lever interaction ──
let arrastrando = false;
let yInicio = 0;
let progreso = 0;

function pintarBrazo(p) {
  brazo.style.transform = 'scaleY(' + (1 - 2 * p) + ')';
}

palanca.addEventListener('pointerdown', (e) => {
  if (girando) return;
  arrastrando = true;
  yInicio = e.clientY;
  brazo.classList.remove('soltada');
  palanca.setPointerCapture(e.pointerId);
});

palanca.addEventListener('pointermove', (e) => {
  if (!arrastrando) return;
  progreso = Math.min(1, Math.max(0, (e.clientY - yInicio) / 80));
  pintarBrazo(progreso);
});

palanca.addEventListener('pointerup', () => {
  if (!arrastrando) return;
  arrastrando = false;
  const fueClic = progreso < 0.15;
  soltarPalanca(fueClic);
});

function soltarPalanca(fueClic) {
  const accionar = () => {
    brazo.classList.add('soltada');
    pintarBrazo(0);
    tirar();
  };
  if (fueClic && !girando) {
    brazo.classList.add('soltada');
    pintarBrazo(1);
    setTimeout(accionar, 250);
  } else if (progreso > 0.55) {
    accionar();
  } else {
    brazo.classList.add('soltada');
    pintarBrazo(0);
  }
  progreso = 0;
}

// ── Marquee lights ──
function montarLuces() {
  for (const lado of ['luces', 'luces2']) {
    $(lado).innerHTML = '<div class="luz"></div>'.repeat(5);
  }
  let fase = 0;
  setInterval(() => {
    fase = 1 - fase;
    document.querySelectorAll('.luz').forEach((luz, i) => {
      luz.classList.toggle('encendida', i % 2 === fase);
    });
  }, 600);
}

function parpadearLuces() {
  const luces = document.querySelectorAll('.luz');
  let ciclos = 0;
  const id = setInterval(() => {
    luces.forEach((luz) => luz.classList.toggle('encendida'));
    if (++ciclos > 9) clearInterval(id);
  }, 120);
}

// ── Controls ──
function cambiarApuesta(paso) {
  if (girando) return;
  const nuevo = indiceApuesta + paso;
  if (nuevo < 0 || nuevo >= APUESTAS.length) return;
  indiceApuesta = nuevo;
  pintarMarcadores();
  if (!tablaPagos.classList.contains('oculto')) montarTablaPagos();
  saveState();
}

botonMenos.addEventListener('click', () => cambiarApuesta(-1));
botonMas.addEventListener('click', () => cambiarApuesta(1));

botonRecargar.addEventListener('click', () => {
  creditos += 100;
  pintarMarcadores();
  if (!girando) mensaje.textContent = 'Tokens recargados';
  saveState();
});

function pintarSilencio() {
  botonSilencio.querySelector('.ondas').classList.toggle('oculto', silenciado);
  botonSilencio.querySelector('.tachado').classList.toggle('oculto', !silenciado);
}

botonSilencio.addEventListener('click', () => {
  silenciado = !silenciado;
  pintarSilencio();
});

// ── Payout table ──
function montarTablaPagos() {
  $('tabla-titulo').textContent = 'Premios con apuesta ' + apuesta();
  const filas = [...SYMBOLS]
    .map((s) => ({ simbolo: s, premio: calcPayout([s, s, s], apuesta()), veces: 3 }))
    .sort((a, b) => b.premio - a.premio);
  filas.push(
    { simbolo: 'mistral', premio: calcPayout(['mistral', 'mistral', 'nvidia'], apuesta()), veces: 2 },
    { simbolo: 'mistral', premio: calcPayout(['mistral', 'nvidia', 'qwen'], apuesta()), veces: 1 }
  );
  $('tabla-filas').innerHTML = filas.map(({ simbolo, premio, veces }, i) => {
    const imagenes = '<img src="' + IMG[simbolo] + '" alt="' + simbolo + '">'.repeat(veces);
    const destacado = i === 0 ? ' gordo' : i === 1 ? ' segundo' : '';
    return '<div class="fila-pago' + destacado + '"><span class="combo">' + imagenes + '</span><span class="importe">' + premio + '</span></div>';
  }).join('');
}

$('info').addEventListener('click', () => {
  montarTablaPagos();
  tablaPagos.classList.remove('oculto');
});

$('cerrar-tabla').addEventListener('click', () => {
  tablaPagos.classList.add('oculto');
});

// ── Provider Panel Toggle ──
$('providers-toggle').addEventListener('click', () => {
  const body = $('providers-body');
  const arrow = $('providers-arrow');
  body.classList.toggle('collapsed');
  arrow.classList.toggle('collapsed');
});

// ── Provider Panel Rendering ──
function formatNumber(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
}

function renderProviderPanel(todayUsage, allTimeTotal) {
  const todayTotal = (todayUsage.totalInput || 0) + (todayUsage.totalOutput || 0);
  const allTimeTotalVal = (allTimeTotal.inputTokens || 0) + (allTimeTotal.outputTokens || 0);

  $('stat-today-total').textContent = formatNumber(todayTotal);
  $('stat-alltime-total').textContent = formatNumber(allTimeTotalVal);
  $('stat-today-inout').textContent = formatNumber(todayUsage.totalInput || 0) + ' / ' + formatNumber(todayUsage.totalOutput || 0);

  const providers = todayUsage.providers || {};
  const list = $('providers-list');

  // Sort by output tokens descending
  const sorted = Object.entries(providers).sort((a, b) => (b[1].totalOutput || 0) - (a[1].totalOutput || 0));

  if (sorted.length === 0) {
    list.innerHTML = '<div style="color:#666;font-size:11px;text-align:center;padding:8px;">No token activity detected yet. Use Copilot Chat or @quematokens to see stats here.</div>';
    return;
  }

  list.innerHTML = sorted.map(([id, usage]) => {
    const color = PROVIDER_COLORS[id] || '#888';
    const iconKey = PROVIDER_ICONS[id] || 'codex';
    const iconUrl = IMG[iconKey] || '';
    const outTotal = usage.totalOutput || 0;
    const inTotal = usage.totalInput || 0;
    const total = outTotal + inTotal;
    if (total === 0) return '';

    return '<div class="provider-row">' +
      '<div class="provider-dot" style="background:' + color + ';box-shadow:0 0 4px ' + color + '"></div>' +
      (iconUrl ? '<img class="provider-icon" src="' + iconUrl + '" alt="' + id + '">' : '') +
      '<span class="provider-name">' + (usage.providerName || id) + '</span>' +
      '<span class="provider-tokens">' +
        '<span class="out">' + formatNumber(outTotal) + '</span>' +
        (inTotal > 0 ? ' <span class="in">(' + formatNumber(inTotal) + ')</span>' : '') +
      '</span>' +
    '</div>';
  }).filter(Boolean).join('');
}

// ── VSCode Message handling ──
const vscode = typeof acquireVsCodeApi !== 'undefined' ? acquireVsCodeApi() : null;

window.addEventListener('message', (event) => {
  const msg = event.data;
  if (!msg || !msg.command) return;
  switch (msg.command) {
    case 'init':
      if (typeof msg.credits === 'number') creditos = msg.credits;
      if (typeof msg.record === 'number') record = msg.record;
      if (typeof msg.betIndex === 'number' && msg.betIndex >= 0 && msg.betIndex < APUESTAS.length) {
        indiceApuesta = msg.betIndex;
      }
      if (typeof msg.totalSpins === 'number') totalSpins = msg.totalSpins;
      if (typeof msg.totalTokensSpent === 'number') totalTokensSpent = msg.totalTokensSpent;
      pintarMarcadores();
      if (creditos < apuesta()) mensaje.textContent = 'Sin tokens: recarga con +100';
      montarCarretes();
      montarLuces();
      pintarBrazo(0);
      break;
    case 'spin':
      tirar();
      break;
    case 'reset':
      creditos = START_CREDITS;
      record = 0;
      indiceApuesta = 0;
      totalSpins = 0;
      totalTokensSpent = 0;
      pintarMarcadores();
      montarCarretes();
      mensaje.textContent = 'Tokens reiniciados';
      break;
    case 'updateTokenStats':
      renderProviderPanel(msg.todayUsage || {}, msg.allTimeTotal || {});
      break;
  }
});

// ── Init (standalone fallback if no VSCode API) ──
if (!vscode) {
  pintarMarcadores();
  montarCarretes();
  montarLuces();
  pintarBrazo(0);
}
`;
}
