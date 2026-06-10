# 🎰 QuemaTokens — VSCode Extension

Tragaperras clásica de palanca adaptada a VSCode. Cada vez que usas Copilot o el chat inline, ¡se giran los carretes!

## Funcionalidades

- 🎰 **Máquina tragaperras completa** con 3 carretes, 10 símbolos de modelos de IA
- 🎯 **Auto-spin**: Se activa automáticamente al usar Copilot Chat / Inline Chat
- 🔊 **Sonidos sintéticos** generados con WebAudio (sin archivos de audio)
- 💰 **Contador de tokens**: Lleva la cuenta de cuántos tokens imaginarios has quemado
- 💾 **Persistencia**: Créditos, récord y estado guardados entre sesiones
- 📊 **Tabla de premios**: Consulta los premios escalados por apuesta

## Símbolos (de mayor a menor premio)

| Símbolo | Premio (×3) | Frecuencia |
|---------|-------------|------------|
| Claude  | 250         | 1×         |
| Codex   | 150         | 1×         |
| Gemini  | 100         | 1×         |
| xAI     | 75          | 1×         |
| DeepSeek| 60          | 2×         |
| Qwen    | 40          | 2×         |
| zAI     | 30          | 2×         |
| MiniMax | 20          | 2×         |
| NVIDIA  | 15          | 3×         |
| Mistral | 10          | 5×         |

### Premios parciales (Mistral)
- 2× Mistral → 5 × (apuesta/5)
- 1× Mistral → 2 × (apuesta/5)

## Comandos

| Comando | Descripción |
|---------|-------------|
| `QuemaTokens: Abrir máquina` | Abre el panel de la tragaperras |
| `QuemaTokens: Tirar` | Activa un giro de los carretes |
| `QuemaTokens: Reiniciar créditos` | Resetea todo a 100 tokens |

## Instalación

### Desde VSIX
```bash
code --install-extension quematokens-1.0.0.vsix
```

### Desde source
```bash
cd quematokens-vscode
npm install
npm run build
npx @vscode/vsce package
code --install-extension quematokens-1.0.0.vsix
```

## Uso

1. Abre el comando palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. Ejecuta "QuemaTokens: Abrir máquina"
3. ¡Tira de la palanca o usa Copilot Chat para girar!

## Créditos

Basado en la extensión Chrome [TragaTokens](https://github.com/nousresearch/tragatokens-chrome).
Logos de modelos de IA pertenecen a sus respectivos creadores.
