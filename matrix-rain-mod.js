/**
 * T3 Code — Matrix Rain Animated Theme Mod
 * Rain glyphs, drop-trail loop and rainbow wave adapted from lively_matrix by bad1dea:
 * https://github.com/bad1dea/lively_matrix (original author's work; see LICENSE).
 * Everything else: MIT, see LICENSE.
 *
 * Features:
 * - Fullscreen HTML5 Canvas Matrix Katakana + numeric digital rain in T3 Code
 * - Dual Render Mode: "Screen Glow + Glass UI" (guaranteed visible across all panels/themes) or "Behind Glass UI"
 * - Live customizable Background Color & Symbol (Font) Color
 * - Rainbow Wave Mode & Rainbow Speed (from bad1dea/lively_matrix)
 * - Adjustable Animation Speed (interval ms), Font Size, Rain Intensity, Trail Fade & Surface Glass Opacity
 * - Matching Neon Color & Glow for all T3 Code Splitters (Sidebar rail, Right panel splitter, Terminal splitter)
 * - Master On/Off Toggle (UI pill, Settings -> Appearance integration, and Ctrl+Shift+M shortcut)
 * - Full support for livelyPropertyListener(name, val) and window.T3MatrixRain API
 */
(() => {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window.T3MatrixRain && typeof window.T3MatrixRain.destroy === "function") {
    window.T3MatrixRain.destroy();
  }

  const STORAGE_KEY = "t3code:matrix-rain-settings:v1";
  const CUSTOM_THEMES_STORAGE_KEY = "t3code:themes:v1";

  // Characters from https://github.com/bad1dea/lively_matrix/blob/master/script.js
  const KONKANI_CHARS =
    "゠アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレワヰヱヲンヺ・ーヽヿ0123456789";
  const CHARACTERS = KONKANI_CHARS.split("");

  const DEFAULT_SETTINGS = {
    enabled: true,
    backgroundColor: "#000000",
    matrixColor: "#00FF46", // Default from LivelyProperties.json (#00FF46)
    rainBow: false, // Default from LivelyProperties.json
    rainbowSpeed: 50, // 0..100 slider (mapped to /100 = 0.5 in script.js)
    matrixSpeed: 50, // Default from script.js (50ms interval)
    fontSize: 14, // Default from script.js (14px)
    trailOpacity: 0.06, // Translucent BG alpha to show rain trail
    headHighlight: true, // Subtle bright phosphor lead glyph on each drop
    uiOpacity: 0.75, // Translucent T3 Code panels so Matrix rain is visible behind UI
    rainOpacity: 0.85, // Overall canvas opacity (0.15..1.0)
    overlayBlend: true, // Screen-blend overlay so rain is guaranteed visible even over opaque inner containers
    splitterMatchSymbol: true, // Automatically match splitter neon color to symbol/rainbow color
    splitterColor: "#00FF46", // Custom splitter neon color when splitterMatchSymbol is false
    splitterGlowIntensity: 100, // 0..150% neon bloom intensity
    splitterThickness: 2, // 1..4px visible neon core thickness
    readabilityVersion: 1,
    panelOpen: false, // Floating customizer popover state
  };

  const COLOR_PRESETS = [
    { name: "Matrix Green", symbol: "#00FF46", bg: "#000000" },
    { name: "Lively Violet", symbol: "#7D34FD", bg: "#04010A" },
    { name: "Cyber Cyan", symbol: "#00F0FF", bg: "#01060A" },
    { name: "Red Pill", symbol: "#FF1E42", bg: "#080103" },
    { name: "Amber CRT", symbol: "#FFB000", bg: "#080500" },
    { name: "Ghost White", symbol: "#E2FFEA", bg: "#020403" },
  ];

  function hexToRgb(hex) {
    if (typeof hex !== "string") return { r: 0, g: 255, b: 70 };
    const clean = hex.trim().replace(/^#/, "");
    const normalized =
      clean.length === 3
        ? clean
            .split("")
            .map((c) => c + c)
            .join("")
        : clean.slice(0, 6);
    const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(normalized);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : { r: 0, g: 255, b: 70 };
  }

  function rgbToHex({ r, g, b }) {
    const clamp = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
    return `#${clamp(r)}${clamp(g)}${clamp(b)}`.toUpperCase();
  }

  function loadSettings() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT_SETTINGS };
      const parsed = JSON.parse(raw);
      const settings = { ...DEFAULT_SETTINGS, ...(typeof parsed === "object" && parsed ? parsed : {}) };
      // Upgrade existing low-opacity preferences once; later slider choices still persist.
      if (!parsed.readabilityVersion) {
        settings.uiOpacity = Math.max(0.75, Number(settings.uiOpacity) || 0.75);
        settings.readabilityVersion = 1;
        saveSettings(settings);
      }
      return settings;
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  function saveSettings(settings) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {}
  }

  // Ensure the static "Matrix Rain" theme exists in T3 Code's custom theme library
  function ensureT3ThemeRegistered(settings) {
    try {
      const raw = window.localStorage.getItem(CUSTOM_THEMES_STORAGE_KEY);
      const list = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(list)) return;
      const sym = settings.matrixColor || "#00FF46";
      const bg = settings.backgroundColor || "#000000";
      const matrixTheme = {
        id: "matrix-rain",
        label: "Matrix Rain",
        appearance: "dark",
        colors: {
          canvas: bg,
          chrome: bg,
          toolbar: bg,
          surface: bg,
          surfaceRaised: "#07130b",
          surfaceOverlay: "#0a1a0f",
          text: "#e2ffea",
          textMuted: "#6ca87d",
          border: `${sym}40`,
          input: "#09180e",
          focus: sym,
          accent: sym,
          accentForeground: "#020804",
          sidebar: bg,
          sidebarForeground: "#d8ffe2",
          sidebarBorder: `${sym}55`,
          sidebarRowHover: "#091d10",
          sidebarRowActive: "#0d2917",
          sidebarRowSelected: "#10331c",
          terminalBackground: bg,
          terminalForeground: sym,
          terminalCursor: sym,
          terminalSelection: `${sym}38`,
          codeBackground: "#030804",
        },
      };
      const idx = list.findIndex((t) => t && t.id === "matrix-rain");
      if (idx === -1) {
        list.push(matrixTheme);
        window.localStorage.setItem(CUSTOM_THEMES_STORAGE_KEY, JSON.stringify(list));
      }
    } catch {}
  }

  const state = {
    settings: loadSettings(),
    canvas: null,
    ctx: null,
    styleEl: null,
    widgetEl: null,
    appearanceCardEl: null,
    observer: null,
    timerId: null,
    drops: [],
    columns: 0,
    hue: -0.01,
    hueFw: false,
    currentNeonHex: "#00FF46",
    mounted: false,
  };

  function computeActiveNeonRgb() {
    if (!state.settings.splitterMatchSymbol) {
      return hexToRgb(state.settings.splitterColor);
    }
    if (state.settings.rainBow) {
      const speed = (state.settings.rainbowSpeed ?? 50) / 100;
      const rr = Math.floor(127 * Math.sin(speed * state.hue + 0) + 128);
      const rg = Math.floor(127 * Math.sin(speed * state.hue + 2) + 128);
      const rb = Math.floor(127 * Math.sin(speed * state.hue + 4) + 128);
      return { r: rr, g: rg, b: rb };
    }
    return hexToRgb(state.settings.matrixColor);
  }

  function updateCssVariables() {
    const root = document.documentElement;
    if (!root) return;
    const s = state.settings;
    const bgRgb = hexToRgb(s.backgroundColor);
    const symRgb = hexToRgb(s.matrixColor);
    const neonRgb = computeActiveNeonRgb();
    const neonHex = rgbToHex(neonRgb);
    state.currentNeonHex = neonHex;

    const glowScale = Math.max(0, Math.min(2, (s.splitterGlowIntensity ?? 100) / 100));
    const corePx = Math.max(1, Math.min(6, Number(s.splitterThickness) || 2));
    const glassAlpha = Math.max(0.1, Math.min(0.96, Number(s.uiOpacity) ?? 0.68));
    const sidebarAlpha = 1; // Sidebar stays solid regardless of chat opacity.
    const rainAlpha = Math.max(0.15, Math.min(1, Number(s.rainOpacity) ?? 0.85));

    root.toggleAttribute("data-t3-matrix-rain", Boolean(s.enabled));
    root.toggleAttribute("data-t3-matrix-overlay", Boolean(s.enabled && s.overlayBlend));
    root.style.setProperty("--matrix-bg-color", s.backgroundColor);
    root.style.setProperty("--matrix-bg-rgb", `${bgRgb.r}, ${bgRgb.g}, ${bgRgb.b}`);
    root.style.setProperty("--matrix-symbol-color", s.matrixColor);
    root.style.setProperty("--matrix-symbol-rgb", `${symRgb.r}, ${symRgb.g}, ${symRgb.b}`);
    root.style.setProperty("--matrix-neon-color", neonHex);
    root.style.setProperty("--matrix-neon-rgb", `${neonRgb.r}, ${neonRgb.g}, ${neonRgb.b}`);
    root.style.setProperty("--matrix-splitter-width", `${corePx}px`);
    root.style.setProperty("--matrix-ui-alpha", String(glassAlpha));
    root.style.setProperty("--matrix-sidebar-alpha", String(sidebarAlpha));
    root.style.setProperty("--matrix-rain-opacity", String(rainAlpha));
    root.style.setProperty(
      "--matrix-splitter-shadow",
      glowScale > 0
        ? `0 0 ${Math.round(6 * glowScale)}px rgba(${neonRgb.r}, ${neonRgb.g}, ${neonRgb.b}, ${0.88 * glowScale}), ` +
            `0 0 ${Math.round(14 * glowScale)}px rgba(${neonRgb.r}, ${neonRgb.g}, ${neonRgb.b}, ${0.6 * glowScale}), ` +
            `0 0 ${Math.round(24 * glowScale)}px rgba(${neonRgb.r}, ${neonRgb.g}, ${neonRgb.b}, ${0.35 * glowScale})`
        : "none"
    );
    root.style.setProperty(
      "--matrix-splitter-shadow-Strong",
      glowScale > 0
        ? `0 0 ${Math.round(8 * glowScale)}px rgba(${neonRgb.r}, ${neonRgb.g}, ${neonRgb.b}, 1), ` +
            `0 0 ${Math.round(18 * glowScale)}px rgba(${neonRgb.r}, ${neonRgb.g}, ${neonRgb.b}, 0.92), ` +
            `0 0 ${Math.round(32 * glowScale)}px rgba(${neonRgb.r}, ${neonRgb.g}, ${neonRgb.b}, 0.7)`
        : "none"
    );
  }

  function buildStylesheet() {
    return `
      #t3-matrix-rain-canvas {
        position: fixed !important;
        inset: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        pointer-events: none !important;
        z-index: 0 !important;
        opacity: 0;
        transition: opacity 260ms ease;
        display: block !important;
      }

      html[data-t3-matrix-rain] #t3-matrix-rain-canvas {
        opacity: var(--matrix-rain-opacity, 0.85);
      }

      /* Keep screen blending behind surfaces so it cannot paint over sidebar or chat text. */
      html[data-t3-matrix-rain][data-t3-matrix-overlay] #t3-matrix-rain-canvas {
        z-index: 0 !important;
        mix-blend-mode: screen !important;
        opacity: calc(var(--matrix-rain-opacity, 0.85) * (1.12 - var(--matrix-ui-alpha, 0.68) * 0.65)) !important;
      }

      /* Base surface transparency so the Matrix canvas behind #root shines through */
      html[data-t3-matrix-rain],
      html[data-t3-matrix-rain] body {
        background-color: var(--matrix-bg-color, #000000) !important;
      }

      html[data-t3-matrix-rain] #root {
        position: relative;
        z-index: 1;
        background-color: transparent !important;
      }

      /* Make T3 Code's root theme tokens translucent when Matrix Rain is active */
      html[data-t3-matrix-rain],
      html[data-t3-matrix-rain][data-theme-id]:not([data-theme-id=""]) {
        --background: rgba(var(--matrix-bg-rgb, 0, 0, 0), var(--matrix-ui-alpha, 0.68)) !important;
        --app-theme-canvas: rgba(var(--matrix-bg-rgb, 0, 0, 0), var(--matrix-ui-alpha, 0.68)) !important;
        --app-chrome-background: rgba(var(--matrix-bg-rgb, 0, 0, 0), var(--matrix-sidebar-alpha, 1)) !important;
        --app-theme-chrome: rgba(var(--matrix-bg-rgb, 0, 0, 0), var(--matrix-sidebar-alpha, 1)) !important;
        --toolbar-background: rgba(var(--matrix-bg-rgb, 0, 0, 0), 0.62) !important;
        --app-theme-toolbar: rgba(var(--matrix-bg-rgb, 0, 0, 0), 0.62) !important;
        --sidebar: rgba(var(--matrix-bg-rgb, 0, 0, 0), var(--matrix-sidebar-alpha, 1)) !important;
        --app-theme-sidebar: rgba(var(--matrix-bg-rgb, 0, 0, 0), var(--matrix-sidebar-alpha, 1)) !important;
      }

      /* Prevent nested .bg-background wrappers inside sidebar-inset from stacking multiple opaque layers */
      html[data-t3-matrix-rain] [data-slot="sidebar-wrapper"],
      html[data-t3-matrix-rain] [data-slot="sidebar"],
      html[data-t3-matrix-rain] [data-slot="sidebar-container"] {
        background-color: transparent !important;
      }

      html[data-t3-matrix-rain] [data-slot="sidebar-inner"] {
        background-color: rgba(var(--matrix-bg-rgb, 0, 0, 0), var(--matrix-sidebar-alpha, 1)) !important;
        border-right-color: rgba(var(--matrix-neon-rgb, 0, 255, 70), 0.35) !important;
      }

      html[data-t3-matrix-rain] main[data-slot="sidebar-inset"],
      html[data-t3-matrix-rain] .t3-matrix-main-pane {
        background-color: rgba(var(--matrix-bg-rgb, 0, 0, 0), var(--matrix-ui-alpha, 0.68)) !important;
      }

      html[data-t3-matrix-rain] main[data-slot="sidebar-inset"] > .bg-background,
      html[data-t3-matrix-rain] main[data-slot="sidebar-inset"] [data-chat-column] > .bg-background,
      html[data-t3-matrix-rain] main[data-slot="sidebar-inset"] [data-chat-column] {
        background-color: transparent !important;
      }

      html[data-t3-matrix-rain] [data-chat-header],
      html[data-t3-matrix-rain] header {
        background-color: rgba(var(--matrix-bg-rgb, 0, 0, 0), 0.58) !important;
        border-bottom-color: rgba(var(--matrix-neon-rgb, 0, 255, 70), 0.28) !important;
      }

      /* =====================================================================
       * NEON SPLITTERS FOR T3 CODE
       * Matches Sidebar Rail, Right Panel Resize Handle, Terminal Drawer
       * Horizontal Handle, Browser Viewport Handles, and Demo Splitters
       * ===================================================================== */

      /* 1. Sidebar Rail Splitter ([data-slot="sidebar-rail"] / [data-sidebar="rail"]) */
      html[data-t3-matrix-rain] [data-slot="sidebar-rail"],
      html[data-t3-matrix-rain] [data-sidebar="rail"] {
        opacity: 1 !important;
        z-index: 60 !important;
      }

      html[data-t3-matrix-rain] [data-slot="sidebar-rail"]::after,
      html[data-t3-matrix-rain] [data-sidebar="rail"]::after {
        background-color: var(--matrix-neon-color, #00FF46) !important;
        width: var(--matrix-splitter-width, 2px) !important;
        box-shadow: var(--matrix-splitter-shadow) !important;
        opacity: 0.92 !important;
        transition: box-shadow 150ms ease, width 150ms ease, opacity 150ms ease !important;
      }

      html[data-t3-matrix-rain] [data-slot="sidebar-rail"]:hover::after,
      html[data-t3-matrix-rain] [data-slot="sidebar-rail"]:active::after,
      html[data-t3-matrix-rain] [data-sidebar="rail"]:hover::after,
      html[data-t3-matrix-rain] [data-sidebar="rail"]:active::after {
        width: calc(var(--matrix-splitter-width, 2px) + 1px) !important;
        box-shadow: var(--matrix-splitter-shadow-Strong) !important;
        opacity: 1 !important;
      }

      /* 2. Vertical Panel Splitters (RightPanelResizeHandle / role="separator" / cursor-col-resize / cursor-ew-resize) */
      html[data-t3-matrix-rain] [role="separator"][aria-orientation="vertical"],
      html[data-t3-matrix-rain] .cursor-col-resize,
      html[data-t3-matrix-rain] .cursor-ew-resize,
      html[data-t3-matrix-rain] .t3-matrix-splitter-vertical {
        z-index: 60 !important;
      }

      html[data-t3-matrix-rain] [role="separator"][aria-orientation="vertical"] > span,
      html[data-t3-matrix-rain] .cursor-col-resize > span,
      html[data-t3-matrix-rain] .t3-matrix-splitter-vertical > span {
        background-color: var(--matrix-neon-color, #00FF46) !important;
        width: var(--matrix-splitter-width, 2px) !important;
        box-shadow: var(--matrix-splitter-shadow) !important;
        opacity: 0.92 !important;
        transition: box-shadow 150ms ease, width 150ms ease, opacity 150ms ease !important;
      }

      html[data-t3-matrix-rain] [role="separator"][aria-orientation="vertical"]:hover > span,
      html[data-t3-matrix-rain] [role="separator"][aria-orientation="vertical"]:active > span,
      html[data-t3-matrix-rain] .cursor-col-resize:hover > span,
      html[data-t3-matrix-rain] .cursor-col-resize:active > span,
      html[data-t3-matrix-rain] .t3-matrix-splitter-vertical:hover > span,
      html[data-t3-matrix-rain] .t3-matrix-splitter-vertical:active > span {
        width: calc(var(--matrix-splitter-width, 2px) + 1px) !important;
        box-shadow: var(--matrix-splitter-shadow-Strong) !important;
        opacity: 1 !important;
      }

      /* Fallback pseudo-line for vertical splitters without an inner <span> */
      html[data-t3-matrix-rain] .cursor-col-resize:not(:has(> span))::after,
      html[data-t3-matrix-rain] .cursor-ew-resize:not(:has(> span))::after,
      html[data-t3-matrix-rain] .t3-matrix-splitter-vertical:not(:has(> span))::after {
        content: "";
        position: absolute;
        top: 0;
        bottom: 0;
        left: 50%;
        transform: translateX(-50%);
        width: var(--matrix-splitter-width, 2px);
        background-color: var(--matrix-neon-color, #00FF46);
        box-shadow: var(--matrix-splitter-shadow);
        pointer-events: none;
        transition: box-shadow 150ms ease, width 150ms ease;
      }

      html[data-t3-matrix-rain] .cursor-col-resize:not(:has(> span)):hover::after,
      html[data-t3-matrix-rain] .cursor-ew-resize:not(:has(> span)):hover::after,
      html[data-t3-matrix-rain] .t3-matrix-splitter-vertical:not(:has(> span)):hover::after {
        width: calc(var(--matrix-splitter-width, 2px) + 1px);
        box-shadow: var(--matrix-splitter-shadow-Strong);
      }

      /* 3. Horizontal Panel Splitters (Terminal Drawer .cursor-row-resize / .cursor-ns-resize / role="separator"[aria-orientation="horizontal"]) */
      html[data-t3-matrix-rain] [role="separator"][aria-orientation="horizontal"],
      html[data-t3-matrix-rain] .cursor-row-resize,
      html[data-t3-matrix-rain] .cursor-ns-resize,
      html[data-t3-matrix-rain] .t3-matrix-splitter-horizontal {
        z-index: 60 !important;
      }

      html[data-t3-matrix-rain] [role="separator"][aria-orientation="horizontal"]::after,
      html[data-t3-matrix-rain] .cursor-row-resize::after,
      html[data-t3-matrix-rain] .cursor-ns-resize::after,
      html[data-t3-matrix-rain] .t3-matrix-splitter-horizontal::after {
        content: "";
        position: absolute;
        left: 0;
        right: 0;
        top: 50%;
        transform: translateY(-50%);
        height: var(--matrix-splitter-width, 2px);
        background-color: var(--matrix-neon-color, #00FF46);
        box-shadow: var(--matrix-splitter-shadow);
        pointer-events: none;
        opacity: 0.92;
        transition: box-shadow 150ms ease, height 150ms ease, opacity 150ms ease;
      }

      html[data-t3-matrix-rain] [role="separator"][aria-orientation="horizontal"]:hover::after,
      html[data-t3-matrix-rain] .cursor-row-resize:hover::after,
      html[data-t3-matrix-rain] .cursor-ns-resize:hover::after,
      html[data-t3-matrix-rain] .t3-matrix-splitter-horizontal:hover::after {
        height: calc(var(--matrix-splitter-width, 2px) + 1px);
        box-shadow: var(--matrix-splitter-shadow-Strong);
        opacity: 1;
      }

      /* =====================================================================
       * FLOATING MATRIX CONTROLLER WIDGET & APPEARANCE SETTINGS CARD
       * ===================================================================== */
      #t3-matrix-controller {
        position: fixed;
        right: 16px;
        bottom: 16px;
        z-index: 9999;
        font-family: -apple-system, BlinkMacSystemFont, "Inter Variable", "Segoe UI", system-ui, sans-serif;
        font-size: 12px;
        color: #e2ffea;
        user-select: none;
      }

      #t3-matrix-pill {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        height: 32px;
        padding: 0 12px;
        border-radius: 999px;
        background: rgba(5, 12, 7, 0.92);
        border: 1px solid rgba(var(--matrix-neon-rgb, 0, 255, 70), 0.65);
        box-shadow: 0 4px 18px rgba(0, 0, 0, 0.7), 0 0 12px rgba(var(--matrix-neon-rgb, 0, 255, 70), 0.35);
        color: #e2ffea;
        cursor: pointer;
        backdrop-filter: blur(10px);
        transition: all 160ms ease;
      }

      #t3-matrix-pill:hover {
        border-color: var(--matrix-neon-color, #00FF46);
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.85), 0 0 16px rgba(var(--matrix-neon-rgb, 0, 255, 70), 0.6);
      }

      #t3-matrix-pill-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--matrix-neon-color, #00FF46);
        box-shadow: 0 0 8px var(--matrix-neon-color, #00FF46);
        transition: all 150ms ease;
      }

      #t3-matrix-controller[data-enabled="false"] #t3-matrix-pill-dot {
        background: #52525b;
        box-shadow: none;
      }

      #t3-matrix-controller[data-enabled="false"] #t3-matrix-pill {
        border-color: rgba(255, 255, 255, 0.16);
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.45);
      }

      #t3-matrix-popover {
        position: absolute;
        right: 0;
        bottom: 42px;
        width: min(360px, calc(100vw - 32px));
        box-sizing: border-box;
        max-height: calc(100vh - 80px);
        overflow-y: auto;
        padding: 14px;
        border-radius: 14px;
        background: rgba(6, 12, 8, 0.96);
        border: 1px solid rgba(var(--matrix-neon-rgb, 0, 255, 70), 0.5);
        box-shadow: 0 16px 40px rgba(0, 0, 0, 0.8), 0 0 22px rgba(var(--matrix-neon-rgb, 0, 255, 70), 0.24);
        backdrop-filter: blur(16px);
        display: none;
        flex-direction: column;
        gap: 11px;
      }

      #t3-matrix-controller[data-open="true"] #t3-matrix-popover {
        display: flex;
      }

      .t3-matrix-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }

      .t3-matrix-label {
        min-width: 0;
        flex: 1;
        overflow-wrap: anywhere;
        font-size: 12px;
        font-weight: 500;
        color: #d4f7de;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .t3-matrix-sub {
        font-size: 10.5px;
        color: #7ca889;
        font-weight: 400;
      }

      .t3-matrix-switch {
        position: relative;
        width: 38px;
        height: 21px;
        border-radius: 999px;
        background: #27272a;
        border: 1px solid rgba(255, 255, 255, 0.14);
        cursor: pointer;
        padding: 0;
        transition: background 150ms ease, border-color 150ms ease, box-shadow 150ms ease;
        flex-shrink: 0;
      }

      .t3-matrix-switch[aria-checked="true"] {
        background: rgba(var(--matrix-neon-rgb, 0, 255, 70), 0.28);
        border-color: var(--matrix-neon-color, #00FF46);
        box-shadow: 0 0 10px rgba(var(--matrix-neon-rgb, 0, 255, 70), 0.35);
      }

      .t3-matrix-switch::after {
        content: "";
        position: absolute;
        top: 2px;
        left: 2px;
        width: 15px;
        height: 15px;
        border-radius: 50%;
        background: #a1a1aa;
        transition: transform 150ms ease, background 150ms ease, box-shadow 150ms ease;
      }

      .t3-matrix-switch[aria-checked="true"]::after {
        transform: translateX(17px);
        background: var(--matrix-neon-color, #00FF46);
        box-shadow: 0 0 8px var(--matrix-neon-color, #00FF46);
      }

      .t3-matrix-color-wrap {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 8px;
        padding: 3px 8px 3px 4px;
      }

      .t3-matrix-color-input {
        width: 22px;
        height: 22px;
        border: none;
        padding: 0;
        background: transparent;
        cursor: pointer;
        border-radius: 5px;
      }

      .t3-matrix-color-hex {
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-size: 11px;
        color: #d4f7de;
      }

      .t3-matrix-slider-wrap {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 150px;
        flex: 0 0 150px;
        min-width: 0;
      }

      .t3-matrix-slider {
        min-width: 0;
        width: 0;
        flex: 1;
        accent-color: var(--matrix-neon-color, #00FF46);
        cursor: pointer;
        height: 4px;
      }

      .t3-matrix-badge {
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-size: 11px;
        min-width: 44px;
        flex: 0 0 44px;
        white-space: nowrap;
        font-variant-numeric: tabular-nums;
        text-align: right;
        color: var(--matrix-neon-color, #00FF46);
      }

      .t3-matrix-presets {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
        padding-top: 2px;
      }

      .t3-matrix-preset-btn {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 3px 8px;
        border-radius: 6px;
        font-size: 10.5px;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: #c8f0d4;
        cursor: pointer;
        transition: all 130ms ease;
      }

      .t3-matrix-preset-btn:hover {
        border-color: var(--matrix-neon-color, #00FF46);
        background: rgba(var(--matrix-neon-rgb, 0, 255, 70), 0.12);
      }

      .t3-matrix-divider {
        height: 1px;
        background: rgba(255, 255, 255, 0.08);
        margin: 2px 0;
      }
    `;
  }

  // Resize & initialize drop columns
  function resizeCanvas() {
    if (!state.canvas) return;
    const w = Math.max(300, window.innerWidth || document.documentElement.clientWidth || 1280);
    const h = Math.max(200, window.innerHeight || document.documentElement.clientHeight || 800);
    state.canvas.width = w;
    state.canvas.height = h;
    const fontSize = Math.max(10, Math.min(28, Number(state.settings.fontSize) || 14));
    const cols = Math.ceil(w / fontSize);
    const nextDrops = [];
    for (let x = 0; x < cols; x++) {
      nextDrops[x] =
        state.drops[x] !== undefined
          ? state.drops[x]
          : Math.floor(Math.random() * Math.max(20, Math.floor(h / fontSize)));
    }
    state.columns = cols;
    state.drops = nextDrops;
  }

  // Core Matrix draw step — faithful to bad1dea/lively_matrix/script.js with customizable BG & neon sync
  function drawMatrixFrame() {
    if (!state.settings.enabled || !state.ctx || !state.canvas) return;
    const ctx = state.ctx;
    const c = state.canvas;
    const s = state.settings;
    const fontSize = Math.max(10, Math.min(28, Number(s.fontSize) || 14));
    const bgRgb = hexToRgb(s.backgroundColor);
    const waveRgb = hexToRgb(s.matrixColor);
    const trailAlpha = Math.max(0.02, Math.min(0.25, Number(s.trailOpacity) || 0.06));

    // Translucent BG fill to create the classic fading trail
    ctx.fillStyle = `rgba(${bgRgb.r}, ${bgRgb.g}, ${bgRgb.b}, ${trailAlpha})`;
    ctx.fillRect(0, 0, c.width, c.height);

    ctx.font = `${fontSize}px monospace, arial`;

    const cellBgR = Math.min(255, bgRgb.r + 8);
    const cellBgG = Math.min(255, bgRgb.g + 8);
    const cellBgB = Math.min(255, bgRgb.b + 8);
    const rainbowSpeed = (Number(s.rainbowSpeed) || 50) / 100;

    for (let i = 0; i < state.drops.length; i++) {
      const y = state.drops[i] * fontSize;
      const x = i * fontSize;

      if (y >= 0) {
        // Clear current glyph cell just like lively_matrix script.js line 55-56
        ctx.fillStyle = `rgba(${cellBgR}, ${cellBgG}, ${cellBgB}, 0.92)`;
        ctx.fillRect(x, y - fontSize + 2, fontSize, fontSize);

        const text = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];

        let rr = waveRgb.r;
        let rg = waveRgb.g;
        let rb = waveRgb.b;

        if (s.rainBow) {
          state.hue += state.hueFw ? 0.01 : -0.01;
          rr = Math.floor(127 * Math.sin(rainbowSpeed * state.hue + 0) + 128);
          rg = Math.floor(127 * Math.sin(rainbowSpeed * state.hue + 2) + 128);
          rb = Math.floor(127 * Math.sin(rainbowSpeed * state.hue + 4) + 128);
        }

        ctx.fillStyle = `rgb(${rr}, ${rg}, ${rb})`;
        ctx.fillText(text, x, y);

        // Optional bright phosphor highlight on the leading drop glyph
        if (s.headHighlight && Math.random() > 0.35) {
          ctx.fillStyle = `rgba(225, 255, 235, 0.55)`;
          ctx.fillText(text, x, y);
        }
      }

      state.drops[i]++;

      if (state.drops[i] * fontSize > c.height && Math.random() > 0.975) {
        state.drops[i] = 0;
      }
    }

    // If rainbow mode + splitter sync is active, keep splitter neon synced with the rainbow wave
    if (s.rainBow && s.splitterMatchSymbol) {
      updateCssVariables();
    }
  }

  function prewarmCanvas(frames = 28) {
    if (!state.settings.enabled || !state.ctx || !state.canvas) return;
    clearCanvasWithBg();
    for (let i = 0; i < frames; i++) {
      drawMatrixFrame();
    }
  }

  function restartLoop() {
    if (state.timerId !== null) {
      window.clearInterval(state.timerId);
      state.timerId = null;
    }
    if (!state.settings.enabled) return;
    const intervalMs = Math.max(10, Math.min(200, Number(state.settings.matrixSpeed) || 50));
    state.timerId = window.setInterval(drawMatrixFrame, intervalMs);
  }

  function clearCanvasWithBg() {
    if (!state.ctx || !state.canvas) return;
    const bgRgb = hexToRgb(state.settings.backgroundColor);
    state.ctx.fillStyle = `rgb(${bgRgb.r}, ${bgRgb.g}, ${bgRgb.b})`;
    state.ctx.fillRect(0, 0, state.canvas.width, state.canvas.height);
  }

  function updateSetting(patch) {
    const prevSpeed = state.settings.matrixSpeed;
    const prevEnabled = state.settings.enabled;
    const prevFontSize = state.settings.fontSize;
    const prevBg = state.settings.backgroundColor;

    state.settings = { ...state.settings, ...patch };
    saveSettings(state.settings);
    updateCssVariables();

    if (state.settings.fontSize !== prevFontSize) {
      resizeCanvas();
    }
    if (state.settings.backgroundColor !== prevBg) {
      clearCanvasWithBg();
    }
    if (state.settings.enabled !== prevEnabled || state.settings.matrixSpeed !== prevSpeed) {
      if (state.settings.enabled && !prevEnabled) {
        prewarmCanvas(20);
      }
      restartLoop();
    }

    syncUIControls();
  }

  // Lively Wallpaper property listener compatibility (from bad1dea/lively_matrix/script.js)
  function livelyPropertyListener(name, val) {
    switch (name) {
      case "matrixColor":
        updateSetting({ matrixColor: String(val) });
        break;
      case "rainBow":
        updateSetting({ rainBow: Boolean(val) });
        break;
      case "rainbowSpeed":
        updateSetting({ rainbowSpeed: Number(val) });
        break;
      case "matrixSpeed":
      case "matrixspeed":
        updateSetting({ matrixSpeed: Number(val) });
        break;
      case "backgroundColor":
        updateSetting({ backgroundColor: String(val) });
        break;
      case "enabled":
        updateSetting({ enabled: Boolean(val) });
        break;
      case "splitterColor":
        updateSetting({ splitterColor: String(val), splitterMatchSymbol: false });
        break;
    }
  }

  function renderControlsInnerHtml() {
    const s = state.settings;
    return `
      <div class="t3-matrix-row">
        <div class="t3-matrix-label">
          <span>Matrix Rain Theme</span>
          <span class="t3-matrix-sub">Toggle animation & neon splitters (Ctrl+Shift+M)</span>
        </div>
        <button type="button" class="t3-matrix-switch" data-matrix-action="toggle-enabled" aria-checked="${s.enabled}" aria-label="Toggle Matrix Rain Theme"></button>
      </div>

      <div class="t3-matrix-divider"></div>

      <div class="t3-matrix-row">
        <div class="t3-matrix-label">
          <span>Symbol Color</span>
          <span class="t3-matrix-sub">Katakana & digit rain glyph color</span>
        </div>
        <label class="t3-matrix-color-wrap">
          <input type="color" class="t3-matrix-color-input" data-matrix-input="matrixColor" value="${s.matrixColor}" />
          <span class="t3-matrix-color-hex" data-matrix-text="matrixColor">${s.matrixColor.toUpperCase()}</span>
        </label>
      </div>

      <div class="t3-matrix-row">
        <div class="t3-matrix-label">
          <span>Background Color</span>
          <span class="t3-matrix-sub">Canvas & translucent surface base</span>
        </div>
        <label class="t3-matrix-color-wrap">
          <input type="color" class="t3-matrix-color-input" data-matrix-input="backgroundColor" value="${s.backgroundColor}" />
          <span class="t3-matrix-color-hex" data-matrix-text="backgroundColor">${s.backgroundColor.toUpperCase()}</span>
        </label>
      </div>

      <div class="t3-matrix-row">
        <div class="t3-matrix-label">
          <span>Animation Delay</span>
          <span class="t3-matrix-sub">Lower ms = faster falling symbols</span>
        </div>
        <div class="t3-matrix-slider-wrap">
          <input type="range" class="t3-matrix-slider" data-matrix-input="matrixSpeed" min="12" max="140" step="2" value="${s.matrixSpeed}" />
          <span class="t3-matrix-badge" data-matrix-text="matrixSpeed">${s.matrixSpeed} ms</span>
        </div>
      </div>

      <div class="t3-matrix-row">
        <div class="t3-matrix-label">
          <span>Rainbow Wave Mode</span>
          <span class="t3-matrix-sub">Lively Matrix sine-wave color cycle</span>
        </div>
        <button type="button" class="t3-matrix-switch" data-matrix-action="toggle-rainbow" aria-checked="${s.rainBow}" aria-label="Toggle Rainbow Mode"></button>
      </div>

      <div class="t3-matrix-row" data-matrix-row="rainbowSpeed" style="${s.rainBow ? "" : "opacity:0.45"}">
        <div class="t3-matrix-label">
          <span>Rainbow Speed</span>
          <span class="t3-matrix-sub">Color wave oscillation speed</span>
        </div>
        <div class="t3-matrix-slider-wrap">
          <input type="range" class="t3-matrix-slider" data-matrix-input="rainbowSpeed" min="5" max="100" step="5" value="${s.rainbowSpeed}" />
          <span class="t3-matrix-badge" data-matrix-text="rainbowSpeed">${s.rainbowSpeed}%</span>
        </div>
      </div>

      <div class="t3-matrix-divider"></div>

      <div class="t3-matrix-row">
        <div class="t3-matrix-label">
          <span>Match Splitter Neon to Symbols</span>
          <span class="t3-matrix-sub">Syncs all panel splitters with rain color</span>
        </div>
        <button type="button" class="t3-matrix-switch" data-matrix-action="toggle-splitter-sync" aria-checked="${s.splitterMatchSymbol}" aria-label="Match Splitter Neon to Symbols"></button>
      </div>

      <div class="t3-matrix-row" data-matrix-row="splitterColor" style="${s.splitterMatchSymbol ? "display:none" : ""}">
        <div class="t3-matrix-label">
          <span>Custom Splitter Neon</span>
          <span class="t3-matrix-sub">Override splitter border & glow</span>
        </div>
        <label class="t3-matrix-color-wrap">
          <input type="color" class="t3-matrix-color-input" data-matrix-input="splitterColor" value="${s.splitterColor}" />
          <span class="t3-matrix-color-hex" data-matrix-text="splitterColor">${s.splitterColor.toUpperCase()}</span>
        </label>
      </div>

      <div class="t3-matrix-row">
        <div class="t3-matrix-label">
          <span>Splitter Neon Glow</span>
          <span class="t3-matrix-sub">Intensity of neon bloom on splitters</span>
        </div>
        <div class="t3-matrix-slider-wrap">
          <input type="range" class="t3-matrix-slider" data-matrix-input="splitterGlowIntensity" min="0" max="150" step="5" value="${s.splitterGlowIntensity}" />
          <span class="t3-matrix-badge" data-matrix-text="splitterGlowIntensity">${s.splitterGlowIntensity}%</span>
        </div>
      </div>

      <div class="t3-matrix-row">
        <div class="t3-matrix-label">
          <span>Screen Glow Overlay</span>
          <span class="t3-matrix-sub">Blend rain with the background behind panels</span>
        </div>
        <button type="button" class="t3-matrix-switch" data-matrix-action="toggle-overlay" aria-checked="${s.overlayBlend}" aria-label="Toggle Screen Glow Overlay"></button>
      </div>

      <div class="t3-matrix-row">
        <div class="t3-matrix-label">
          <span>UI Surface Opacity</span>
          <span class="t3-matrix-sub">How much rain shows through panels</span>
        </div>
        <div class="t3-matrix-slider-wrap">
          <input type="range" class="t3-matrix-slider" data-matrix-input="uiOpacity" min="0.15" max="0.95" step="0.05" value="${s.uiOpacity}" />
          <span class="t3-matrix-badge" data-matrix-text="uiOpacity">${Math.round(s.uiOpacity * 100)}%</span>
        </div>
      </div>

      <div class="t3-matrix-divider"></div>

      <div class="t3-matrix-presets">
        ${COLOR_PRESETS.map(
          (p) => `
          <button type="button" class="t3-matrix-preset-btn" data-matrix-preset-sym="${p.symbol}" data-matrix-preset-bg="${p.bg}">
            <span style="width:8px;height:8px;border-radius:50%;background:${p.symbol};box-shadow:0 0 6px ${p.symbol};display:inline-block"></span>
            ${p.name}
          </button>`
        ).join("")}
      </div>
    `;
  }

  function bindControlEvents(container) {
    if (!container || container.dataset.matrixBound === "true") return;
    container.dataset.matrixBound = "true";

    container.addEventListener("click", (e) => {
      const target = e.target.closest("[data-matrix-action], [data-matrix-preset-sym]");
      if (!target) return;

      const action = target.getAttribute("data-matrix-action");
      if (action === "toggle-enabled") {
        updateSetting({ enabled: !state.settings.enabled });
      } else if (action === "toggle-rainbow") {
        updateSetting({ rainBow: !state.settings.rainBow });
      } else if (action === "toggle-splitter-sync") {
        updateSetting({ splitterMatchSymbol: !state.settings.splitterMatchSymbol });
      } else if (action === "toggle-overlay") {
        updateSetting({ overlayBlend: !state.settings.overlayBlend });
      } else if (action === "toggle-popover") {
        updateSetting({ panelOpen: !state.settings.panelOpen });
      } else if (target.hasAttribute("data-matrix-preset-sym")) {
        updateSetting({
          enabled: true,
          rainBow: false,
          matrixColor: target.getAttribute("data-matrix-preset-sym"),
          backgroundColor: target.getAttribute("data-matrix-preset-bg"),
        });
      }
    });

    container.addEventListener("input", (e) => {
      const input = e.target.closest("[data-matrix-input]");
      if (!input) return;
      const key = input.getAttribute("data-matrix-input");
      const rawVal = input.value;
      if (key === "matrixColor" || key === "backgroundColor" || key === "splitterColor") {
        updateSetting({ [key]: rawVal });
      } else if (key === "matrixSpeed" || key === "rainbowSpeed" || key === "splitterGlowIntensity") {
        updateSetting({ [key]: Number(rawVal) });
      } else if (key === "uiOpacity") {
        updateSetting({ uiOpacity: Number(rawVal) });
      }
    });
  }

  function syncUIControls() {
    const s = state.settings;
    if (state.widgetEl) {
      state.widgetEl.setAttribute("data-enabled", String(Boolean(s.enabled)));
      state.widgetEl.setAttribute("data-open", String(Boolean(s.panelOpen)));
      const labelEl = state.widgetEl.querySelector("[data-matrix-pill-status]");
      if (labelEl) labelEl.textContent = s.enabled ? "Matrix ON" : "Matrix OFF";
    }

    const roots = [state.widgetEl, state.appearanceCardEl].filter(Boolean);
    for (const root of roots) {
      const enSwitch = root.querySelector('[data-matrix-action="toggle-enabled"]');
      if (enSwitch) enSwitch.setAttribute("aria-checked", String(Boolean(s.enabled)));

      const rbSwitch = root.querySelector('[data-matrix-action="toggle-rainbow"]');
      if (rbSwitch) rbSwitch.setAttribute("aria-checked", String(Boolean(s.rainBow)));

      const spSwitch = root.querySelector('[data-matrix-action="toggle-splitter-sync"]');
      if (spSwitch) spSwitch.setAttribute("aria-checked", String(Boolean(s.splitterMatchSymbol)));

      const ovSwitch = root.querySelector('[data-matrix-action="toggle-overlay"]');
      if (ovSwitch) ovSwitch.setAttribute("aria-checked", String(Boolean(s.overlayBlend)));

      const rbRow = root.querySelector('[data-matrix-row="rainbowSpeed"]');
      if (rbRow) rbRow.style.opacity = s.rainBow ? "1" : "0.45";

      const spRow = root.querySelector('[data-matrix-row="splitterColor"]');
      if (spRow) spRow.style.display = s.splitterMatchSymbol ? "none" : "flex";

      for (const key of [
        "matrixColor",
        "backgroundColor",
        "splitterColor",
        "matrixSpeed",
        "rainbowSpeed",
        "splitterGlowIntensity",
        "uiOpacity",
      ]) {
        const inputEl = root.querySelector(`[data-matrix-input="${key}"]`);
        if (inputEl && document.activeElement !== inputEl) {
          inputEl.value = String(s[key]);
        }
      }

      const txtSym = root.querySelector('[data-matrix-text="matrixColor"]');
      if (txtSym) txtSym.textContent = s.matrixColor.toUpperCase();
      const txtBg = root.querySelector('[data-matrix-text="backgroundColor"]');
      if (txtBg) txtBg.textContent = s.backgroundColor.toUpperCase();
      const txtSp = root.querySelector('[data-matrix-text="splitterColor"]');
      if (txtSp) txtSp.textContent = s.splitterColor.toUpperCase();
      const txtSpeed = root.querySelector('[data-matrix-text="matrixSpeed"]');
      if (txtSpeed) txtSpeed.textContent = `${s.matrixSpeed} ms`;
      const txtRb = root.querySelector('[data-matrix-text="rainbowSpeed"]');
      if (txtRb) txtRb.textContent = `${s.rainbowSpeed}%`;
      const txtGlow = root.querySelector('[data-matrix-text="splitterGlowIntensity"]');
      if (txtGlow) txtGlow.textContent = `${s.splitterGlowIntensity}%`;
      const txtOp = root.querySelector('[data-matrix-text="uiOpacity"]');
      if (txtOp) txtOp.textContent = `${Math.round(s.uiOpacity * 100)}%`;
    }
  }

  function createFloatingWidget() {
    const existing = document.getElementById("t3-matrix-controller");
    if (existing) existing.remove();
    const widget = document.createElement("div");
    widget.id = "t3-matrix-controller";
    widget.setAttribute("data-enabled", String(Boolean(state.settings.enabled)));
    widget.setAttribute("data-open", String(Boolean(state.settings.panelOpen)));
    widget.innerHTML = `
      <div id="t3-matrix-popover" role="dialog" aria-label="Matrix Rain Theme Settings">
        ${renderControlsInnerHtml()}
      </div>
      <div style="display:flex;align-items:center;gap:6px;justify-content:flex-end">
        <button type="button" id="t3-matrix-pill" data-matrix-action="toggle-popover" title="Customize Matrix Rain Theme (Ctrl+Shift+M to quick toggle)">
          <span id="t3-matrix-pill-dot"></span>
          <span style="font-family:monospace;font-weight:700;letter-spacing:0.03em">ｱ</span>
          <span data-matrix-pill-status>${state.settings.enabled ? "Matrix ON" : "Matrix OFF"}</span>
        </button>
      </div>
    `;
    bindControlEvents(widget);
    state.widgetEl = widget;
    document.body.appendChild(widget);
  }

  // Automatically mount a native-feeling settings card inside T3 Code's Settings -> Appearance page
  function maybeInjectAppearanceSettingsCard() {
    const appearanceSection =
      document.querySelector("section#appearance") ||
      document.querySelector("#appearance") ||
      document.querySelector('[data-settings-section="appearance"]');
    if (!appearanceSection) {
      state.appearanceCardEl = null;
      return;
    }
    if (appearanceSection.querySelector("#t3-matrix-appearance-card")) return;

    const card = document.createElement("div");
    card.id = "t3-matrix-appearance-card";
    card.style.cssText =
      "margin-top: 14px; padding: 16px; border-radius: 12px; border: 1px solid rgba(var(--matrix-neon-rgb, 0, 255, 70), 0.45); background: rgba(6, 14, 9, 0.84); display: flex; flex-direction: column; gap: 12px; position: relative; z-index: 65;";
    card.innerHTML = renderControlsInnerHtml();
    bindControlEvents(card);
    appearanceSection.appendChild(card);
    state.appearanceCardEl = card;
  }

  function onKeyDown(e) {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "m") {
      e.preventDefault();
      updateSetting({ enabled: !state.settings.enabled });
    }
  }

  function mountMod() {
    if (state.mounted) return;
    if (!document.head || !document.body) return;
    state.mounted = true;

    ensureT3ThemeRegistered(state.settings);

    // Create Canvas
    const canvas = document.createElement("canvas");
    canvas.id = "t3-matrix-rain-canvas";
    canvas.setAttribute("aria-hidden", "true");
    state.canvas = canvas;
    state.ctx = canvas.getContext("2d");

    // Create Dynamic Style Element
    const styleEl = document.createElement("style");
    styleEl.id = "t3-matrix-rain-styles";
    styleEl.textContent = buildStylesheet();
    state.styleEl = styleEl;

    document.head.appendChild(styleEl);
    document.body.prepend(canvas);
    createFloatingWidget();
    updateCssVariables();
    resizeCanvas();
    prewarmCanvas(28);
    restartLoop();
    maybeInjectAppearanceSettingsCard();

    window.addEventListener("resize", resizeCanvas);
    window.addEventListener("keydown", onKeyDown);

    const observer = new MutationObserver(() => {
      if (state.canvas && !document.body.contains(state.canvas)) {
        document.body.prepend(state.canvas);
      }
      if (state.widgetEl && !document.body.contains(state.widgetEl)) {
        document.body.appendChild(state.widgetEl);
      }
      if (state.styleEl && !document.head.contains(state.styleEl)) {
        document.head.appendChild(state.styleEl);
      }
      maybeInjectAppearanceSettingsCard();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    state.observer = observer;
  }

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", mountMod, { once: true });
  } else {
    mountMod();
  }

  // Expose public API & Lively Wallpaper listener
  window.livelyPropertyListener = livelyPropertyListener;
  window.T3MatrixRain = {
    getSettings: () => ({ ...state.settings }),
    updateSetting,
    toggle: () => updateSetting({ enabled: !state.settings.enabled }),
    enable: () => updateSetting({ enabled: true }),
    disable: () => updateSetting({ enabled: false }),
    livelyPropertyListener,
    destroy: () => {
      if (state.timerId !== null) window.clearInterval(state.timerId);
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("keydown", onKeyDown);
      state.observer?.disconnect();
      state.canvas?.remove();
      state.styleEl?.remove();
      state.widgetEl?.remove();
      state.appearanceCardEl?.remove();
      document.documentElement.removeAttribute("data-t3-matrix-rain");
      document.documentElement.removeAttribute("data-t3-matrix-overlay");
    },
  };
})();
