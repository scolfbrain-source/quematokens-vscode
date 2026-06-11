# 🎰 QuemaTokens — VSCode Extension

Tragaperras clásica de palanca para VSCode. Juega mientras quemas tokens de IA.

## Funcionalidades

- 🎰 **Máquina tragaperras completa** — 3 carretes, 10 símbolos de modelos de IA
- 💰 **Bote progresivo** — Inicia en 500, crece con cada apuesta (10%) y con los tokens reales de tu IA
- 🎯 **Sistema de apuestas** — 5, 10, 25, 50 o 100 créditos por tirada
- 🔄 **Free refill** — Si te quedas sin créditos, recibes 100 gratis
- 🏆 **3× Claude = JACKPOT** — Tres Claude en línea central paga el bote completo
- 📊 **Stats en tiempo real** — Tiradas, victorias, RTP%, racha, jackpots ganados
- 🔊 **Sonidos sintéticos** — Web Audio API, muteable
- 💾 **Persistencia** — Créditos, récord y estado guardados entre sesiones
- 📋 **Tabla de premios** — Consulta los premios escalados por apuesta
- 🤖 **Panel de proveedores** — Ve qué modelos de IA están alimentando tu bote

## Símbolos (de mayor a menor premio)

| Símbolo | 3× en línea | Frecuencia |
|---------|-------------|------------|
| Claude  | JACKPOT     | 1×         |
| Codex   | ×150        | 1×         |
| Gemini  | ×100        | 1×         |
| xAI     | ×75         | 1×         |
| DeepSeek| ×60         | 2×         |
| Qwen    | ×40         | 2×         |
| zAI     | ×30         | 2×         |
| MiniMax | ×20         | 2×         |
| NVIDIA  | ×15         | 3×         |
| Mistral | ×10         | 5×         |

### Premios parciales (Mistral = comodín parcial)
- 2× Mistral → ×5
- 1× Mistral → ×2

## Uso

1. Busca el icono 🎰 en la barra lateral izquierda (Activity Bar)
2. O abre el Command Palette (`Ctrl+Shift+P`) → "QuemaTokens: Abrir máquina"
3. Arrastra la palanca hacia abajo o pulsa el botón ▶ para girar
4. ¡Los tokens de tu IA alimentan el bote progresivo!

## Comandos

| Comando | Descripción |
|---------|-------------|
| `QuemaTokens: Abrir máquina` | Abre el panel de la tragaperras |
| `QuemaTokens: Tirar` | Activa un giro |
| `QuemaTokens: Reiniciar` | Resetea todo (1000 créditos) |
| `QuemaTokens: Stats` | Muestra estadísticas |
| `QuemaTokens: Exportar uso` | Exporta datos JSON |

## Instalación

### Desde VSIX
```bash
code --install-extension quematokens-1.3.0.vsix
```

### Desde source
```bash
cd quematokens-vscode
npm install
npm run build
npx @vscode/vsce package
code --install-extension quematokens-1.3.0.vsix
```

## Inspiración

Inspirado en [TragaTokens Chrome](https://github.com/686f6c61/tragatokens-chrome) por 686f6c61.
Logos de modelos de IA pertenecen a sus respectivos creadores.
