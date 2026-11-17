# T3 Code — Matrix Rain Animated Theme Mod

An animated **Matrix Digital Rain** theme and UI mod for **T3 Code**, inspired by [`bad1dea/lively_matrix`](https://github.com/bad1dea/lively_matrix).

## Features

- **Authentic Lively Matrix Digital Rain Canvas**:
  - Uses the Katakana + numeric glyph set (`゠アイウエオ...0123456789`) and drop trail algorithm from [`bad1dea/lively_matrix`](https://github.com/bad1dea/lively_matrix).
  - Supports `livelyPropertyListener(name, val)` (`matrixColor`, `rainBow`, `rainbowSpeed`, `matrixSpeed`, `backgroundColor`, `enabled`).
- **Customizable Background & Symbol Colors**:
  - Live color pickers for **Symbol (Font) Color** (default `#00FF46`) and **Background Color** (default `#000000`).
  - Includes **Rainbow Wave Mode** & **Rainbow Speed** slider from `lively_matrix`, plus 6 instant presets (*Matrix Green*, *Lively Violet*, *Cyber Cyan*, *Red Pill*, *Amber CRT*, *Ghost White*).
- **Adjustable Animation Speed & Glass Opacity**:
  - Control the drop tick interval (`12 ms` fast to `140 ms` slow, default `50 ms`) and T3 panel translucency (`UI Surface Opacity`).
- **Matching Neon Splitters**:
  - Automatically styles all T3 Code splitters & resize handles (`[data-slot="sidebar-rail"]`, vertical panel splitters `[role="separator"][aria-orientation="vertical"]`, horizontal terminal drawer splitters `.cursor-row-resize`) with a glowing neon core line and bloom that matches your active Matrix symbol color (or a custom override color).
- **Turn On / Off Anytime**:
  - Toggle via the floating **`[ ｱ Matrix ON ]`** pill in the bottom-right corner, the injected **Settings → Appearance** card, or the **`Ctrl+Shift+M`** keyboard shortcut.

## Files

| File | Description |
| --- | --- |
| [`matrix-rain-mod.js`](matrix-rain-mod.js) | Self-contained Matrix Rain canvas, neon splitters CSS, floating controller widget, and Settings → Appearance integration. |
| [`matrix-rain.theme.json`](matrix-rain.theme.json) | Importable T3 Code v1 static dark theme JSON (`Matrix Rain`). |
| [`install.mjs`](install.mjs) / [`install.ps1`](install.ps1) | Installer & uninstaller (`--remove`) for the T3 Code runtime, `server.asar` and `app.asar`. |
| [`uninstall-matrix.cmd`](uninstall-matrix.cmd) | Removes the mod. Double-click with T3 Code closed. |
| [`preview.html`](preview.html) | Standalone interactive T3 Code UI preview with live controls and draggable neon splitters. |

## Installation

### 1. Run the Installer Script
Clone or download this repo, close T3 Code Desktop (so `server.asar` is unlocked), and run from the repo folder:

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

Or directly with Node:

```powershell
node install.mjs
```

**T3 Code updates replace its app files and remove the mod.** Run the installer again after each update.

### Uninstalling

Quit T3 Code first, then double-click `uninstall-matrix.cmd` (or run `node install.mjs --remove`). This restores T3's original files.

Removing Matrix Rain doesn't remove the "Matrix Rain" entry the mod added to T3's theme list. If you no longer want it, delete it in **Settings → Appearance**.

### 2. Import Static Theme Palette (Optional)
In T3 Code, go to **Settings → Appearance → Colors & themes** and import [`matrix-rain.theme.json`](matrix-rain.theme.json).

## Credits

The Matrix rain animation is based on [**lively_matrix**](https://github.com/bad1dea/lively_matrix) by [**bad1dea**](https://github.com/bad1dea). The Katakana/numeric glyph set, the drop-trail loop and the rainbow color wave are adapted from its `script.js`. All credit for those parts goes to the original author.

## License

[MIT](LICENSE) for this repo's own code. The parts adapted from lively_matrix stay the work of their original author and are not covered by this license, because that project publishes no license of its own.
