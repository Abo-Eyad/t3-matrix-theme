# T3 Code — Matrix Rain Animated Theme Mod

An animated **Matrix Digital Rain** theme and UI mod for **T3 Code**, inspired by [`bad1dea/lively_matrix`](https://github.com/bad1dea/lively_matrix).

## Features

- **HiDPI Lively Matrix Digital Rain Canvas**:
  - Uses the Katakana + numeric glyph set (`゠アイウエオ...0123456789`) and drop trail algorithm from [`bad1dea/lively_matrix`](https://github.com/bad1dea/lively_matrix), scaled by `devicePixelRatio` for sharp rendering on high-DPI displays.
  - Multiple **Glyph Sets** (*Katakana*, *Binary 01*, *Hex 0-F*, *Cyberpunk*, *ASCII*) and optional **Depth Parallax** (per-column speed & brightness variation).
  - Auto-pauses the canvas loop when T3 Code is hidden or minimized to save CPU/battery, and throttles DOM observation via `requestAnimationFrame`.
  - Supports `livelyPropertyListener(name, val)` (`matrixColor`, `rainBow`, `rainbowSpeed`, `matrixSpeed`, `backgroundColor`, `enabled`, `chatGlass`, `chatGlassOpacity`, `glyphSet`, `depthMode`).
- **Glassy Chat Readability Window**:
  - Adds a frosted, theme-tinted glass backdrop behind the centered chat timeline (`--chat-content-max-width`) so messages stay crisp over the rain while keeping the rain visible in the side margins.
  - Automatically matches your active symbol color / rainbow wave and background color with a subtle animated glass sheen & rim glow, plus an on/off toggle, **Chat Glass Tint**, and **Chat Glass Blur** sliders.
- **Customizable Colors, Rain & Lead Glow**:
  - Live color pickers for **Symbol Color** (default `#00FF46`) and **Background Color** (default `#000000`), plus **Rainbow Wave Mode**, **Rainbow Speed**, and 6 instant presets (*Matrix Green*, *Lively Violet*, *Cyber Cyan*, *Red Pill*, *Amber CRT*, *Ghost White*).
  - Full live sliders for **Animation Delay**, **Glyph Size**, **Rain Intensity**, **Trail Fade**, **Phosphor Lead Glow** (tinted to match the active drop color), **UI Surface Opacity**, and **Reset defaults**.
- **Matching Neon Splitters**:
  - Automatically styles T3 Code splitters & resize handles (`[data-slot="sidebar-rail"]`, vertical panel splitters `.cursor-col-resize`, horizontal terminal drawer splitters `.cursor-row-resize`) with configurable neon glow, color sync, and core thickness without affecting decorative menu or page separators.
- **Flexible Controls**:
  - Toggle via the floating **`[ ｱ Matrix ON ]`** pill in the bottom-right corner (can be hidden in settings; press `Esc` or click outside to close), the injected **Settings → Appearance** card, or **`Ctrl+Shift+M`**.

## Files

| File | Description |
| --- | --- |
| [`matrix-rain-mod.js`](matrix-rain-mod.js) | Self-contained Matrix Rain canvas, chat glass window, neon splitters CSS, floating controller widget, and Settings → Appearance integration. |
| [`matrix-rain.theme.json`](matrix-rain.theme.json) | Importable T3 Code v1 static dark theme JSON (`Matrix Rain`). |
| [`install.mjs`](install.mjs) / [`install.ps1`](install.ps1) | Installer, `--status` checker, `-Restart` auto-relaunch helper, and uninstaller (`--remove`) for T3 Code runtime, `server.asar`, and `app.asar`. |
| [`uninstall-matrix.cmd`](uninstall-matrix.cmd) | Removes the mod. Double-click with T3 Code closed. |
| [`preview.html`](preview.html) | Standalone interactive T3 Code UI preview with live controls and draggable neon splitters. |

## Installation

### 1. Run the Installer Script
Clone or download this repo, close T3 Code Desktop (so `server.asar` is unlocked), and run from the repo folder:

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

Or close, patch, and relaunch T3 Code in one command:

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1 -Restart
```

Check whether your current T3 Code installation is patched and up to date (safe while T3 Code is running):

```powershell
node install.mjs --status
# or: powershell -ExecutionPolicy Bypass -File .\install.ps1 -Status
```

Or run Node directly with T3 Code closed:

```powershell
node install.mjs
```

**T3 Code updates replace its app files and remove the mod.** Run `.\install.ps1 -Restart` (or `node install.mjs`) again after each update.

### Uninstalling

Quit T3 Code first, then double-click `uninstall-matrix.cmd` (or run `node install.mjs --remove` / `.\install.ps1 -Remove -Restart`). This restores T3's original files.

Removing Matrix Rain doesn't remove the "Matrix Rain" entry the mod added to T3's theme list. If you no longer want it, delete it in **Settings → Appearance**.

### 2. Import Static Theme Palette (Optional)
In T3 Code, go to **Settings → Appearance → Colors & themes** and import [`matrix-rain.theme.json`](matrix-rain.theme.json).

## Credits

The Matrix rain animation is based on [**lively_matrix**](https://github.com/bad1dea/lively_matrix) by [**bad1dea**](https://github.com/bad1dea). The Katakana/numeric glyph set, the drop-trail loop and the rainbow color wave are adapted from its `script.js`. All credit for those parts goes to the original author.

## License

[MIT](LICENSE) for this repo's own code. The parts adapted from lively_matrix stay the work of their original author and are not covered by this license, because that project publishes no license of its own.
