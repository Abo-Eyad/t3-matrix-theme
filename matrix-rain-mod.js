/**
 * T3 Code — Matrix Rain Animated Theme Mod
 * Rain glyphs, drop-trail loop and rainbow wave adapted from lively_matrix by bad1dea:
 * https://github.com/bad1dea/lively_matrix (original author's work; see LICENSE).
 * Everything else: MIT, see LICENSE.
 *
 * Features:
 * - Fullscreen HiDPI HTML5 Canvas Matrix digital rain in T3 Code (auto-pauses when hidden)
 * - Multiple glyph sets (Katakana, Binary, Hex, Cyberpunk, ASCII) & optional Depth Parallax
 * - Glassy readability window behind the centered chat column, matched to active theme colors
 * - Dual Render Mode: "Screen Glow + Glass UI" or "Behind Glass UI"
 * - Live customizable Background Color, Symbol Color, Rainbow Wave & Presets
 * - Adjustable Animation Speed, Font Size, Rain Intensity, Trail Fade, Phosphor Lead Glow & Surface Opacity
 * - Matching Neon Color, Width & Glow for all T3 Code Splitters (Sidebar rail, Vertical & Horizontal handles)
 * - Master On/Off Toggle (hideable UI pill, Settings -> Appearance integration, and Ctrl+Shift+M shortcut)
 * - Full support for livelyPropertyListener(name, val) and window.T3MatrixRain API
 */
(() => {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window.T3MatrixRain && typeof window.T3MatrixRain.destroy === "function") {
    window.T3MatrixRain.destroy();
  }

  const STORAGE_KEY = "t3code:matrix-rain-settings:v1";
  const CUSTOM_THEMES_STORAGE_KEY = "t3code:themes:v1";

  // Classic Katakana + numeric set from https://github.com/bad1dea/lively_matrix/blob/master/script.js
  const GLYPH_SETS = {
    katakana: {
      label: "Katakana",
      chars:
        "゠アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレワヰヱヲンヺ・ーヽヿ0123456789",
    },
    binary: {
      label: "Binary 01",
      chars: "01",
    },
    hex: {
      label: "Hex 0-F",
      chars: "0123456789ABCDEF",
    },
    cyber: {
      label: "Cyberpunk",
      chars:
        "アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789ABCDEF$+-*/=<>[]{}#%&@¥§ΔΩλ",
    },
    ascii: {
      label: "ASCII",
      chars: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*+-=/:;<>[]{}",
    },
  };

  const DEFAULT_SETTINGS = {
    enabled: true,
    backgroundColor: "#000000",
    matrixColor: "#00FF46", // Default from LivelyProperties.json (#00FF46)
    rainBow: false, // Default from LivelyProperties.json
    rainbowSpeed: 50, // 0..100 slider (mapped to /100 = 0.5 in script.js)
    matrixSpeed: 42, // Drop tick interval in ms (lower = faster)
    glyphSet: "katakana", // katakana | binary | hex | cyber | ascii
    depthMode: true, // Per-column speed & brightness variation for parallax depth
    fontSize: 14, // Default from script.js (14px)
    trailOpacity: 0.06, // Translucent BG alpha to show rain trail (0.02..0.18)
    headHighlight: true, // Subtle bright phosphor lead glyph on each drop
    uiOpacity: 0.72, // Translucent T3 Code panels so Matrix rain is visible behind UI
    rainOpacity: 0.85, // Overall canvas opacity (0.15..1.0)
    overlayBlend: true, // Screen-blend overlay so rain is visible over inner containers
    chatGlass: true, // Glassy readability window behind the centered chat timeline
    chatGlassOpacity: 0.38, // Backdrop tint opacity for the chat glass window (0.10..0.85)
    chatGlassBlur: 6, // Frosted glass blur radius in px (0..20)
    splitterMatchSymbol: true, // Automatically match splitter neon color to symbol/rainbow color
    splitterColor: "#00FF46", // Custom splitter neon color when splitterMatchSymbol is false
    splitterGlowIntensity: 100, // 0..150% neon bloom intensity
    splitterThickness: 2, // 1..4px visible neon core thickness
    showPill: true, // Show floating bottom-right controller pill
    readabilityVersion: 2,
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

  function getActiveCharacters(glyphSetKey) {
    const entry = GLYPH_SETS[glyphSetKey] || GLYPH_SETS.katakana;
    return entry.chars.split("");
  }

  function loadSettings() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT_SETTINGS };
      const parsed = JSON.parse(raw);
      const settings = { ...DEFAULT_SETTINGS, ...(typeof parsed === "object" && parsed ? parsed : {}) };
      if (!GLYPH_SETS[settings.glyphSet]) {
        settings.glyphSet = DEFAULT_SETTINGS.glyphSet;
      }
      // Upgrade existing preferences once; later slider choices still persist.
      const prevVer = Number(parsed.readabilityVersion) || 0;
      if (prevVer < 2) {
        if (prevVer < 1) {
          settings.uiOpacity = Math.max(0.72, Number(settings.uiOpacity) || 0.72);
        }
        if (parsed.chatGlassOpacity === undefined || parsed.chatGlassOpacity === 0.72) {
          settings.chatGlassOpacity = DEFAULT_SETTINGS.chatGlassOpacity;
        }
        if (parsed.chatGlassBlur === undefined) {
          settings.chatGlassBlur = DEFAULT_SETTINGS.chatGlassBlur;
        }
        if (parsed.depthMode === undefined || parsed.depthMode === false) {
          settings.depthMode = DEFAULT_SETTINGS.depthMode;
        }
        settings.readabilityVersion = 2;
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
    characters: [],
    canvas: null,
    ctx: null,
    cssWidth: 1280,
    cssHeight: 800,
    dpr: 1,
    styleEl: null,
    widgetEl: null,
    appearanceCardEl: null,
    observer: null,
    mutationRafId: null,
    timerId: null,
    drops: [],
    dropSpeeds: [],
    dropAlphas: [],
    columns: 0,
    hue: -0.01,
    hueFw: false,
    currentNeonHex: "#00FF46",
    mounted: false,
  };
  state.characters = getActiveCharacters(state.settings.glyphSet);

  function computeRainbowRgb() {
    const speed = (state.settings.rainbowSpeed ?? 50) / 100;
    const rr = Math.floor(127 * Math.sin(speed * state.hue + 0) + 128);
    const rg = Math.floor(127 * Math.sin(speed * state.hue + 2) + 128);
    const rb = Math.floor(127 * Math.sin(speed * state.hue + 4) + 128);
    return { r: rr, g: rg, b: rb };
  }

  function computeActiveThemeAccentRgb() {
    if (state.settings.rainBow) {
      return computeRainbowRgb();
    }
    return hexToRgb(state.settings.matrixColor);
  }

  function computeActiveNeonRgb() {
    if (!state.settings.splitterMatchSymbol) {
      return hexToRgb(state.settings.splitterColor);
    }
    return computeActiveThemeAccentRgb();
  }

  function updateCssVariables() {
    const root = document.documentElement;
    if (!root) return;
    const s = state.settings;
    const bgRgb = hexToRgb(s.backgroundColor);
    const symRgb = hexToRgb(s.matrixColor);
    const accentRgb = computeActiveThemeAccentRgb();
    const neonRgb = computeActiveNeonRgb();
    const neonHex = rgbToHex(neonRgb);
    state.currentNeonHex = neonHex;

    const glowScale = Math.max(0, Math.min(2, (s.splitterGlowIntensity ?? 100) / 100));
    const corePx = Math.max(1, Math.min(6, Number(s.splitterThickness) || 2));
    const glassAlpha = Math.max(0.1, Math.min(0.96, Number(s.uiOpacity) ?? 0.72));
    const chatGlassAlpha = Math.max(0.1, Math.min(0.85, Number(s.chatGlassOpacity) ?? 0.38));
    const chatGlassBlur = Math.max(0, Math.min(20, Number(s.chatGlassBlur) ?? 6));
    const sidebarAlpha = 1; // Sidebar stays solid regardless of chat opacity.
    const rainAlpha = Math.max(0.15, Math.min(1, Number(s.rainOpacity) ?? 0.85));

    root.toggleAttribute("data-t3-matrix-rain", Boolean(s.enabled));
    root.toggleAttribute("data-t3-matrix-overlay", Boolean(s.enabled && s.overlayBlend));
    root.toggleAttribute("data-t3-matrix-chat-glass", Boolean(s.enabled && s.chatGlass));
    root.style.setProperty("--matrix-bg-color", s.backgroundColor);
    root.style.setProperty("--matrix-bg-rgb", `${bgRgb.r}, ${bgRgb.g}, ${bgRgb.b}`);
    root.style.setProperty("--matrix-symbol-color", s.matrixColor);
    root.style.setProperty("--matrix-symbol-rgb", `${symRgb.r}, ${symRgb.g}, ${symRgb.b}`);
    root.style.setProperty("--matrix-theme-accent-rgb", `${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}`);
    root.style.setProperty("--matrix-neon-color", neonHex);
    root.style.setProperty("--matrix-neon-rgb", `${neonRgb.r}, ${neonRgb.g}, ${neonRgb.b}`);
    root.style.setProperty("--matrix-splitter-width", `${corePx}px`);
    root.style.setProperty("--matrix-ui-alpha", String(glassAlpha));
    root.style.setProperty("--matrix-chat-glass-alpha", String(chatGlassAlpha));
    root.style.setProperty("--matrix-chat-glass-blur", `${chatGlassBlur}px`);
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
      "--matrix-splitter-shadow-strong",
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
       * GLASSY CHAT READABILITY WINDOW
       * Dynamic frosted theme-tinted glass behind the centered chat timeline
       * ===================================================================== */
      @keyframes t3-matrix-glass-sheen {
        0%, 100% {
          background-position: 0% 0%, 0% 0%;
        }
        50% {
          background-position: 100% 100%, 0% 0%;
        }
      }

      @keyframes t3-matrix-glass-pulse {
        0%, 100% {
          border-left-color: rgba(var(--matrix-theme-accent-rgb, 0, 255, 70), 0.18);
          border-right-color: rgba(var(--matrix-theme-accent-rgb, 0, 255, 70), 0.18);
          box-shadow:
            inset 1px 0 0 rgba(255, 255, 255, 0.04),
            inset -1px 0 0 rgba(255, 255, 255, 0.04),
            0 0 24px rgba(var(--matrix-theme-accent-rgb, 0, 255, 70), 0.07);
        }
        50% {
          border-left-color: rgba(var(--matrix-theme-accent-rgb, 0, 255, 70), 0.36);
          border-right-color: rgba(var(--matrix-theme-accent-rgb, 0, 255, 70), 0.36);
          box-shadow:
            inset 1px 0 0 rgba(255, 255, 255, 0.08),
            inset -1px 0 0 rgba(255, 255, 255, 0.08),
            0 0 34px rgba(var(--matrix-theme-accent-rgb, 0, 255, 70), 0.15);
        }
      }

      html[data-t3-matrix-rain][data-t3-matrix-chat-glass] [data-assistant-citation-viewport="true"]::before {
        content: "";
        position: absolute;
        top: 0;
        bottom: 0;
        left: calc(50% + (var(--chat-lane-inset-start, 0px) - var(--chat-lane-inset-end, 0px)) / 2);
        transform: translateX(-50%);
        width: min(
          calc(var(--chat-content-max-width, 46rem) + 3.5rem),
          calc(100% - var(--chat-lane-inset-start, 0px) - var(--chat-lane-inset-end, 0px))
        );
        border-radius: 0;
        background-image:
          linear-gradient(
            125deg,
            rgba(var(--matrix-theme-accent-rgb, 0, 255, 70), 0.10) 0%,
            rgba(var(--matrix-theme-accent-rgb, 0, 255, 70), 0.02) 30%,
            rgba(255, 255, 255, 0.045) 50%,
            rgba(var(--matrix-theme-accent-rgb, 0, 255, 70), 0.02) 70%,
            rgba(var(--matrix-theme-accent-rgb, 0, 255, 70), 0.08) 100%
          ),
          linear-gradient(
            180deg,
            rgba(var(--matrix-bg-rgb, 0, 0, 0), var(--matrix-chat-glass-alpha, 0.38)),
            rgba(var(--matrix-bg-rgb, 0, 0, 0), var(--matrix-chat-glass-alpha, 0.38))
          );
        background-size: 240% 240%, 100% 100%;
        border: none;
        border-left: 1px solid rgba(var(--matrix-theme-accent-rgb, 0, 255, 70), 0.24);
        border-right: 1px solid rgba(var(--matrix-theme-accent-rgb, 0, 255, 70), 0.24);
        backdrop-filter: blur(var(--matrix-chat-glass-blur, 6px)) saturate(140%) brightness(1.06);
        -webkit-backdrop-filter: blur(var(--matrix-chat-glass-blur, 6px)) saturate(140%) brightness(1.06);
        pointer-events: none;
        z-index: 0;
        animation:
          t3-matrix-glass-sheen 12s ease-in-out infinite,
          t3-matrix-glass-pulse 5.5s ease-in-out infinite;
      }

      html[data-t3-matrix-rain][data-t3-matrix-chat-glass] [data-assistant-citation-viewport="true"] > .messages-timeline-scroll {
        position: relative;
        z-index: 1;
        -webkit-mask-image:
          linear-gradient(
            to bottom,
            transparent 0px,
            #000 calc(var(--workspace-titlebar-scroll-fade-height, 24px) + 10px),
            #000 calc(100% - 36px),
            transparent 100%
          ),
          linear-gradient(#000, #000) !important;
        -webkit-mask-position: left top, right top !important;
        -webkit-mask-size: calc(100% - 14px) 100%, 14px 100% !important;
        -webkit-mask-repeat: no-repeat, no-repeat !important;
        -webkit-mask-composite: source-over !important;
        mask-image:
          linear-gradient(
            to bottom,
            transparent 0px,
            #000 calc(var(--workspace-titlebar-scroll-fade-height, 24px) + 10px),
            #000 calc(100% - 36px),
            transparent 100%
          ),
          linear-gradient(#000, #000) !important;
        mask-position: left top, right top !important;
        mask-size: calc(100% - 14px) 100%, 14px 100% !important;
        mask-repeat: no-repeat, no-repeat !important;
        mask-composite: add !important;
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
        box-shadow: var(--matrix-splitter-shadow-strong) !important;
        opacity: 1 !important;
      }

      /* 2. Vertical Panel Splitters (RightPanelResizeHandle .cursor-col-resize / .cursor-ew-resize) */
      html[data-t3-matrix-rain] .cursor-col-resize,
      html[data-t3-matrix-rain] .cursor-ew-resize,
      html[data-t3-matrix-rain] .t3-matrix-splitter-vertical {
        z-index: 60 !important;
      }

      html[data-t3-matrix-rain] .cursor-col-resize > span,
      html[data-t3-matrix-rain] .t3-matrix-splitter-vertical > span {
        background-color: var(--matrix-neon-color, #00FF46) !important;
        width: var(--matrix-splitter-width, 2px) !important;
        box-shadow: var(--matrix-splitter-shadow) !important;
        opacity: 0.92 !important;
        transition: box-shadow 150ms ease, width 150ms ease, opacity 150ms ease !important;
      }

      html[data-t3-matrix-rain] .cursor-col-resize:hover > span,
      html[data-t3-matrix-rain] .cursor-col-resize:active > span,
      html[data-t3-matrix-rain] .t3-matrix-splitter-vertical:hover > span,
      html[data-t3-matrix-rain] .t3-matrix-splitter-vertical:active > span {
        width: calc(var(--matrix-splitter-width, 2px) + 1px) !important;
        box-shadow: var(--matrix-splitter-shadow-strong) !important;
        opacity: 1 !important;
      }

      /* Fallback pseudo-line for vertical splitters without an inner <span> (excluding sidebar-rail) */
      html[data-t3-matrix-rain] .cursor-col-resize:not([data-slot="sidebar-rail"]):not([data-sidebar="rail"]):not(:has(> span))::after,
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

      html[data-t3-matrix-rain] .cursor-col-resize:not([data-slot="sidebar-rail"]):not([data-sidebar="rail"]):not(:has(> span)):hover::after,
      html[data-t3-matrix-rain] .cursor-ew-resize:not(:has(> span)):hover::after,
      html[data-t3-matrix-rain] .t3-matrix-splitter-vertical:not(:has(> span)):hover::after {
        width: calc(var(--matrix-splitter-width, 2px) + 1px);
        box-shadow: var(--matrix-splitter-shadow-strong);
      }

      /* 3. Horizontal Panel Splitters (Terminal Drawer .cursor-row-resize / .cursor-ns-resize) */
      html[data-t3-matrix-rain] .cursor-row-resize,
      html[data-t3-matrix-rain] .cursor-ns-resize,
      html[data-t3-matrix-rain] .t3-matrix-splitter-horizontal {
        z-index: 60 !important;
      }

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

      html[data-t3-matrix-rain] .cursor-row-resize:hover::after,
      html[data-t3-matrix-rain] .cursor-ns-resize:hover::after,
      html[data-t3-matrix-rain] .t3-matrix-splitter-horizontal:hover::after {
        height: calc(var(--matrix-splitter-width, 2px) + 1px);
        box-shadow: var(--matrix-splitter-shadow-strong);
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
        color: color-mix(in srgb, var(--matrix-symbol-color, #00FF46) 12%, #fff);
        user-select: none;
      }

      #t3-matrix-controller[data-pill-hidden="true"] #t3-matrix-pill-bar {
        display: none !important;
      }

      #t3-matrix-pill {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        height: 32px;
        padding: 0 12px;
        border-radius: 999px;
        background: rgba(var(--matrix-bg-rgb, 0, 0, 0), 0.92);
        border: 1px solid rgba(var(--matrix-symbol-rgb, 0, 255, 70), 0.65);
        box-shadow: 0 4px 18px rgba(0, 0, 0, 0.7), 0 0 12px rgba(var(--matrix-symbol-rgb, 0, 255, 70), 0.35);
        color: color-mix(in srgb, var(--matrix-symbol-color, #00FF46) 12%, #fff);
        cursor: pointer;
        backdrop-filter: blur(10px);
        transition: all 160ms ease;
      }

      #t3-matrix-pill:hover {
        border-color: var(--matrix-symbol-color, #00FF46);
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.85), 0 0 16px rgba(var(--matrix-symbol-rgb, 0, 255, 70), 0.6);
      }

      #t3-matrix-pill-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--matrix-symbol-color, #00FF46);
        box-shadow: 0 0 8px var(--matrix-symbol-color, #00FF46);
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
        width: min(370px, calc(100vw - 32px));
        box-sizing: border-box;
        max-height: calc(100vh - 80px);
        overflow-y: auto;
        padding: 14px;
        border-radius: 14px;
        background: rgba(var(--matrix-bg-rgb, 0, 0, 0), 0.96);
        border: 1px solid rgba(var(--matrix-symbol-rgb, 0, 255, 70), 0.5);
        box-shadow: 0 16px 40px rgba(0, 0, 0, 0.8), 0 0 22px rgba(var(--matrix-symbol-rgb, 0, 255, 70), 0.24);
        backdrop-filter: blur(16px);
        display: none;
        flex-direction: column;
        gap: 10px;
      }

      #t3-matrix-controller[data-open="true"] #t3-matrix-popover {
        display: flex;
      }

      .t3-matrix-section-title {
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: color-mix(in srgb, var(--matrix-symbol-color, #00FF46) 72%, #fff);
        margin-top: 2px;
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
        color: color-mix(in srgb, var(--matrix-symbol-color, #00FF46) 18%, #fff);
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .t3-matrix-sub {
        font-size: 10.5px;
        color: color-mix(in srgb, var(--matrix-symbol-color, #00FF46) 45%, #888);
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
        background: rgba(var(--matrix-symbol-rgb, 0, 255, 70), 0.28);
        border-color: var(--matrix-symbol-color, #00FF46);
        box-shadow: 0 0 10px rgba(var(--matrix-symbol-rgb, 0, 255, 70), 0.35);
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
        background: var(--matrix-symbol-color, #00FF46);
        box-shadow: 0 0 8px var(--matrix-symbol-color, #00FF46);
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
        color: color-mix(in srgb, var(--matrix-symbol-color, #00FF46) 18%, #fff);
      }

      .t3-matrix-select {
        height: 26px;
        padding: 0 8px;
        border-radius: 7px;
        font-size: 11.5px;
        background: rgba(var(--matrix-bg-rgb, 0, 0, 0), 0.92);
        color: color-mix(in srgb, var(--matrix-symbol-color, #00FF46) 20%, #fff);
        border: 1px solid rgba(var(--matrix-symbol-rgb, 0, 255, 70), 0.35);
        cursor: pointer;
        outline: none;
      }

      .t3-matrix-select:focus {
        border-color: var(--matrix-symbol-color, #00FF46);
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
        accent-color: var(--matrix-symbol-color, #00FF46);
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
        color: var(--matrix-symbol-color, #00FF46);
      }

      .t3-matrix-presets {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
        padding-top: 2px;
      }

      .t3-matrix-preset-btn,
      .t3-matrix-action-btn {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 4px 8px;
        border-radius: 6px;
        font-size: 10.5px;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: color-mix(in srgb, var(--matrix-symbol-color, #00FF46) 25%, #fff);
        cursor: pointer;
        transition: all 130ms ease;
      }

      .t3-matrix-preset-btn:hover,
      .t3-matrix-action-btn:hover {
        border-color: var(--matrix-symbol-color, #00FF46);
        background: rgba(var(--matrix-symbol-rgb, 0, 255, 70), 0.12);
      }

      .t3-matrix-footer-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding-top: 2px;
      }

      .t3-matrix-divider {
        height: 1px;
        background: rgba(255, 255, 255, 0.08);
        margin: 2px 0;
      }
    `;
  }

  // Resize & initialize drop columns with HiDPI crisp scaling
  function resizeCanvas() {
    if (!state.canvas || !state.ctx) return;
    const w = Math.max(300, window.innerWidth || document.documentElement.clientWidth || 1280);
    const h = Math.max(200, window.innerHeight || document.documentElement.clientHeight || 800);
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

    state.cssWidth = w;
    state.cssHeight = h;
    state.dpr = dpr;

    state.canvas.width = Math.round(w * dpr);
    state.canvas.height = Math.round(h * dpr);
    state.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const fontSize = Math.max(10, Math.min(28, Number(state.settings.fontSize) || 14));
    const cols = Math.ceil(w / fontSize);
    const nextDrops = [];
    const nextSpeeds = [];
    const nextAlphas = [];
    const maxStartRow = Math.max(20, Math.floor(h / fontSize));

    for (let x = 0; x < cols; x++) {
      nextDrops[x] =
        state.drops[x] !== undefined ? state.drops[x] : Math.floor(Math.random() * maxStartRow);
      nextSpeeds[x] =
        state.dropSpeeds[x] !== undefined ? state.dropSpeeds[x] : 0.45 + Math.random() * 0.55;
      nextAlphas[x] =
        state.dropAlphas[x] !== undefined ? state.dropAlphas[x] : 0.45 + Math.random() * 0.55;
    }

    state.columns = cols;
    state.drops = nextDrops;
    state.dropSpeeds = nextSpeeds;
    state.dropAlphas = nextAlphas;
  }

  // Core Matrix draw step — faithful to bad1dea/lively_matrix/script.js with HiDPI, depth & theme sync
  function drawMatrixFrame() {
    if (!state.settings.enabled || !state.ctx || !state.canvas) return;
    const ctx = state.ctx;
    const w = state.cssWidth;
    const h = state.cssHeight;
    const s = state.settings;
    const chars = state.characters;
    const fontSize = Math.max(10, Math.min(28, Number(s.fontSize) || 14));
    const bgRgb = hexToRgb(s.backgroundColor);
    const waveRgb = hexToRgb(s.matrixColor);
    const trailAlpha = Math.max(0.02, Math.min(0.25, Number(s.trailOpacity) || 0.06));
    const useDepth = Boolean(s.depthMode);

    // Translucent BG fill to create the classic fading trail
    ctx.fillStyle = `rgba(${bgRgb.r}, ${bgRgb.g}, ${bgRgb.b}, ${trailAlpha})`;
    ctx.fillRect(0, 0, w, h);

    ctx.font = `${fontSize}px monospace, arial`;

    const cellBgR = Math.min(255, bgRgb.r + 8);
    const cellBgG = Math.min(255, bgRgb.g + 8);
    const cellBgB = Math.min(255, bgRgb.b + 8);
    const rainbowSpeed = (Number(s.rainbowSpeed) || 50) / 100;

    for (let i = 0; i < state.drops.length; i++) {
      const row = Math.floor(state.drops[i]);
      const y = row * fontSize;
      const x = i * fontSize;

      if (y >= 0) {
        // Clear current glyph cell just like lively_matrix script.js line 55-56
        ctx.fillStyle = `rgba(${cellBgR}, ${cellBgG}, ${cellBgB}, 0.92)`;
        ctx.fillRect(x, y - fontSize + 2, fontSize, fontSize);

        const text = chars[Math.floor(Math.random() * chars.length)];

        let rr = waveRgb.r;
        let rg = waveRgb.g;
        let rb = waveRgb.b;

        if (s.rainBow) {
          state.hue += state.hueFw ? 0.01 : -0.01;
          rr = Math.floor(127 * Math.sin(rainbowSpeed * state.hue + 0) + 128);
          rg = Math.floor(127 * Math.sin(rainbowSpeed * state.hue + 2) + 128);
          rb = Math.floor(127 * Math.sin(rainbowSpeed * state.hue + 4) + 128);
        }

        const colAlpha = useDepth ? state.dropAlphas[i] ?? 1 : 1;
        ctx.fillStyle = colAlpha < 0.99 ? `rgba(${rr}, ${rg}, ${rb}, ${colAlpha.toFixed(2)})` : `rgb(${rr}, ${rg}, ${rb})`;
        ctx.fillText(text, x, y);

        // Bright phosphor lead glyph tinted to match the active drop color
        if (s.headHighlight && Math.random() > 0.35) {
          const hr = Math.round(rr + (255 - rr) * 0.72);
          const hg = Math.round(rg + (255 - rg) * 0.72);
          const hb = Math.round(rb + (255 - rb) * 0.72);
          ctx.fillStyle = `rgba(${hr}, ${hg}, ${hb}, ${(0.62 * colAlpha).toFixed(2)})`;
          ctx.fillText(text, x, y);
        }
      }

      state.drops[i] += useDepth ? state.dropSpeeds[i] ?? 1 : 1;

      if (state.drops[i] * fontSize > h && Math.random() > 0.975) {
        state.drops[i] = 0;
        if (useDepth) {
          state.dropSpeeds[i] = 0.45 + Math.random() * 0.55;
          state.dropAlphas[i] = 0.45 + Math.random() * 0.55;
        }
      }
    }

    // If rainbow mode is active, keep synced splitters and chat glass border cycling smoothly
    if (s.rainBow && (s.splitterMatchSymbol || s.chatGlass)) {
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

  function stopLoop() {
    if (state.timerId !== null) {
      window.clearInterval(state.timerId);
      state.timerId = null;
    }
  }

  function restartLoop(ignoreHidden = false) {
    stopLoop();
    if (!state.settings.enabled) return;
    if (!ignoreHidden && document.visibilityState === "hidden") return;
    const intervalMs = Math.max(10, Math.min(200, Number(state.settings.matrixSpeed) || 42));
    state.timerId = window.setInterval(drawMatrixFrame, intervalMs);
  }

  function ensureLoopRunning() {
    if (state.settings.enabled && state.timerId === null && document.visibilityState !== "hidden") {
      restartLoop();
    }
  }

  function onVisibilityChange() {
    if (document.visibilityState === "hidden") {
      stopLoop();
    } else if (state.settings.enabled) {
      restartLoop();
    }
  }

  function clearCanvasWithBg() {
    if (!state.ctx || !state.canvas) return;
    const bgRgb = hexToRgb(state.settings.backgroundColor);
    state.ctx.fillStyle = `rgb(${bgRgb.r}, ${bgRgb.g}, ${bgRgb.b})`;
    state.ctx.fillRect(0, 0, state.cssWidth, state.cssHeight);
  }

  function updateSetting(patch) {
    const prevSpeed = state.settings.matrixSpeed;
    const prevEnabled = state.settings.enabled;
    const prevFontSize = state.settings.fontSize;
    const prevBg = state.settings.backgroundColor;
    const prevGlyphSet = state.settings.glyphSet;

    state.settings = { ...state.settings, ...patch };
    if (!GLYPH_SETS[state.settings.glyphSet]) {
      state.settings.glyphSet = DEFAULT_SETTINGS.glyphSet;
    }
    if (state.settings.glyphSet !== prevGlyphSet) {
      state.characters = getActiveCharacters(state.settings.glyphSet);
    }

    saveSettings(state.settings);
    updateCssVariables();

    if (state.settings.fontSize !== prevFontSize) {
      resizeCanvas();
      clearCanvasWithBg();
    } else if (state.settings.backgroundColor !== prevBg) {
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

  function resetSettings() {
    const keepOpen = state.settings.panelOpen;
    updateSetting({ ...DEFAULT_SETTINGS, panelOpen: keepOpen });
    prewarmCanvas(20);
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
      case "chatGlass":
        updateSetting({ chatGlass: Boolean(val) });
        break;
      case "chatGlassOpacity":
        updateSetting({ chatGlassOpacity: Number(val) });
        break;
      case "chatGlassBlur":
        updateSetting({ chatGlassBlur: Number(val) });
        break;
      case "glyphSet":
        updateSetting({ glyphSet: String(val) });
        break;
      case "depthMode":
        updateSetting({ depthMode: Boolean(val) });
        break;
    }
  }

  function renderControlsInnerHtml() {
    const s = state.settings;
    return `
      <div class="t3-matrix-row">
        <div class="t3-matrix-label">
          <span>Matrix Rain Theme</span>
          <span class="t3-matrix-sub">Toggle animation, glass &amp; splitters (Ctrl+Shift+M)</span>
        </div>
        <button type="button" class="t3-matrix-switch" data-matrix-action="toggle-enabled" aria-checked="${s.enabled}" aria-label="Toggle Matrix Rain Theme"></button>
      </div>

      <div class="t3-matrix-divider"></div>
      <div class="t3-matrix-section-title">Chat Readability Glass</div>

      <div class="t3-matrix-row">
        <div class="t3-matrix-label">
          <span>Chat Glass Window</span>
          <span class="t3-matrix-sub">Frosted theme-tinted panel behind messages</span>
        </div>
        <button type="button" class="t3-matrix-switch" data-matrix-action="toggle-chat-glass" aria-checked="${s.chatGlass}" aria-label="Toggle Chat Glass Window"></button>
      </div>

      <div class="t3-matrix-row" data-matrix-row="chatGlassOpacity" style="${s.chatGlass ? "" : "display:none"}">
        <div class="t3-matrix-label">
          <span>Chat Glass Tint</span>
          <span class="t3-matrix-sub">Lower = more live rain through the glass</span>
        </div>
        <div class="t3-matrix-slider-wrap">
          <input type="range" class="t3-matrix-slider" data-matrix-input="chatGlassOpacity" min="0.1" max="0.85" step="0.05" value="${s.chatGlassOpacity}" />
          <span class="t3-matrix-badge" data-matrix-text="chatGlassOpacity">${Math.round(s.chatGlassOpacity * 100)}%</span>
        </div>
      </div>

      <div class="t3-matrix-row" data-matrix-row="chatGlassBlur" style="${s.chatGlass ? "" : "display:none"}">
        <div class="t3-matrix-label">
          <span>Chat Glass Blur</span>
          <span class="t3-matrix-sub">Frosted blur behind chat messages</span>
        </div>
        <div class="t3-matrix-slider-wrap">
          <input type="range" class="t3-matrix-slider" data-matrix-input="chatGlassBlur" min="0" max="20" step="1" value="${s.chatGlassBlur}" />
          <span class="t3-matrix-badge" data-matrix-text="chatGlassBlur">${s.chatGlassBlur} px</span>
        </div>
      </div>

      <div class="t3-matrix-divider"></div>
      <div class="t3-matrix-section-title">Colors &amp; Rain</div>

      <div class="t3-matrix-row">
        <div class="t3-matrix-label">
          <span>Symbol Color</span>
          <span class="t3-matrix-sub">Rain glyphs, chat glass &amp; accents</span>
        </div>
        <label class="t3-matrix-color-wrap">
          <input type="color" class="t3-matrix-color-input" data-matrix-input="matrixColor" value="${s.matrixColor}" />
          <span class="t3-matrix-color-hex" data-matrix-text="matrixColor">${s.matrixColor.toUpperCase()}</span>
        </label>
      </div>

      <div class="t3-matrix-row">
        <div class="t3-matrix-label">
          <span>Background Color</span>
          <span class="t3-matrix-sub">Canvas &amp; translucent surface base</span>
        </div>
        <label class="t3-matrix-color-wrap">
          <input type="color" class="t3-matrix-color-input" data-matrix-input="backgroundColor" value="${s.backgroundColor}" />
          <span class="t3-matrix-color-hex" data-matrix-text="backgroundColor">${s.backgroundColor.toUpperCase()}</span>
        </label>
      </div>

      <div class="t3-matrix-row">
        <div class="t3-matrix-label">
          <span>Glyph Set</span>
          <span class="t3-matrix-sub">Character alphabet used for rain drops</span>
        </div>
        <select class="t3-matrix-select" data-matrix-input="glyphSet" aria-label="Glyph Set">
          ${Object.entries(GLYPH_SETS)
            .map(([key, def]) => `<option value="${key}"${s.glyphSet === key ? " selected" : ""}>${def.label}</option>`)
            .join("")}
        </select>
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
          <span>Glyph Size</span>
          <span class="t3-matrix-sub">Character size &amp; column density</span>
        </div>
        <div class="t3-matrix-slider-wrap">
          <input type="range" class="t3-matrix-slider" data-matrix-input="fontSize" min="10" max="24" step="1" value="${s.fontSize}" />
          <span class="t3-matrix-badge" data-matrix-text="fontSize">${s.fontSize} px</span>
        </div>
      </div>

      <div class="t3-matrix-row">
        <div class="t3-matrix-label">
          <span>Rain Intensity</span>
          <span class="t3-matrix-sub">Overall canvas visibility</span>
        </div>
        <div class="t3-matrix-slider-wrap">
          <input type="range" class="t3-matrix-slider" data-matrix-input="rainOpacity" min="0.15" max="1" step="0.05" value="${s.rainOpacity}" />
          <span class="t3-matrix-badge" data-matrix-text="rainOpacity">${Math.round(s.rainOpacity * 100)}%</span>
        </div>
      </div>

      <div class="t3-matrix-row">
        <div class="t3-matrix-label">
          <span>Trail Fade</span>
          <span class="t3-matrix-sub">Lower = longer glowing trails</span>
        </div>
        <div class="t3-matrix-slider-wrap">
          <input type="range" class="t3-matrix-slider" data-matrix-input="trailOpacity" min="0.02" max="0.18" step="0.01" value="${s.trailOpacity}" />
          <span class="t3-matrix-badge" data-matrix-text="trailOpacity">${Math.round(s.trailOpacity * 100)}%</span>
        </div>
      </div>

      <div class="t3-matrix-row">
        <div class="t3-matrix-label">
          <span>Depth Parallax</span>
          <span class="t3-matrix-sub">Vary drop speed &amp; brightness per column</span>
        </div>
        <button type="button" class="t3-matrix-switch" data-matrix-action="toggle-depth" aria-checked="${s.depthMode}" aria-label="Toggle Depth Parallax"></button>
      </div>

      <div class="t3-matrix-row">
        <div class="t3-matrix-label">
          <span>Phosphor Lead Glow</span>
          <span class="t3-matrix-sub">Bright leading glyph on each drop</span>
        </div>
        <button type="button" class="t3-matrix-switch" data-matrix-action="toggle-head-highlight" aria-checked="${s.headHighlight}" aria-label="Toggle Phosphor Lead Glow"></button>
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
      <div class="t3-matrix-section-title">Splitters &amp; Surfaces</div>

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
          <span class="t3-matrix-sub">Override splitter border &amp; glow</span>
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
          <span>Splitter Thickness</span>
          <span class="t3-matrix-sub">Visible neon core line width</span>
        </div>
        <div class="t3-matrix-slider-wrap">
          <input type="range" class="t3-matrix-slider" data-matrix-input="splitterThickness" min="1" max="4" step="1" value="${s.splitterThickness}" />
          <span class="t3-matrix-badge" data-matrix-text="splitterThickness">${s.splitterThickness} px</span>
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
          <span class="t3-matrix-sub">How much rain shows through workspace panes</span>
        </div>
        <div class="t3-matrix-slider-wrap">
          <input type="range" class="t3-matrix-slider" data-matrix-input="uiOpacity" min="0.15" max="0.95" step="0.05" value="${s.uiOpacity}" />
          <span class="t3-matrix-badge" data-matrix-text="uiOpacity">${Math.round(s.uiOpacity * 100)}%</span>
        </div>
      </div>

      <div class="t3-matrix-row">
        <div class="t3-matrix-label">
          <span>Show Floating Pill</span>
          <span class="t3-matrix-sub">Bottom-right quick toggle (always in Appearance)</span>
        </div>
        <button type="button" class="t3-matrix-switch" data-matrix-action="toggle-show-pill" aria-checked="${s.showPill}" aria-label="Show Floating Pill"></button>
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

      <div class="t3-matrix-footer-row">
        <span class="t3-matrix-sub">Esc to close · Ctrl+Shift+M to toggle</span>
        <button type="button" class="t3-matrix-action-btn" data-matrix-action="reset-defaults">Reset defaults</button>
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
      } else if (action === "toggle-chat-glass") {
        updateSetting({ chatGlass: !state.settings.chatGlass });
      } else if (action === "toggle-depth") {
        updateSetting({ depthMode: !state.settings.depthMode });
      } else if (action === "toggle-head-highlight") {
        updateSetting({ headHighlight: !state.settings.headHighlight });
      } else if (action === "toggle-rainbow") {
        updateSetting({ rainBow: !state.settings.rainBow });
      } else if (action === "toggle-splitter-sync") {
        updateSetting({ splitterMatchSymbol: !state.settings.splitterMatchSymbol });
      } else if (action === "toggle-overlay") {
        updateSetting({ overlayBlend: !state.settings.overlayBlend });
      } else if (action === "toggle-show-pill") {
        const nextShow = !state.settings.showPill;
        updateSetting({ showPill: nextShow, panelOpen: nextShow ? state.settings.panelOpen : false });
      } else if (action === "toggle-popover") {
        updateSetting({ panelOpen: !state.settings.panelOpen });
      } else if (action === "reset-defaults") {
        resetSettings();
      } else if (target.hasAttribute("data-matrix-preset-sym")) {
        updateSetting({
          enabled: true,
          rainBow: false,
          matrixColor: target.getAttribute("data-matrix-preset-sym"),
          backgroundColor: target.getAttribute("data-matrix-preset-bg"),
        });
      }
    });

    const handleFieldUpdate = (e) => {
      const input = e.target.closest("[data-matrix-input]");
      if (!input) return;
      const key = input.getAttribute("data-matrix-input");
      const rawVal = input.value;
      if (key === "matrixColor" || key === "backgroundColor" || key === "splitterColor" || key === "glyphSet") {
        updateSetting({ [key]: rawVal });
      } else if (
        key === "matrixSpeed" ||
        key === "fontSize" ||
        key === "rainOpacity" ||
        key === "trailOpacity" ||
        key === "rainbowSpeed" ||
        key === "splitterGlowIntensity" ||
        key === "splitterThickness" ||
        key === "uiOpacity" ||
        key === "chatGlassOpacity" ||
        key === "chatGlassBlur"
      ) {
        updateSetting({ [key]: Number(rawVal) });
      }
    };

    container.addEventListener("input", handleFieldUpdate);
    container.addEventListener("change", handleFieldUpdate);
  }

  function syncUIControls() {
    const s = state.settings;
    if (state.widgetEl) {
      state.widgetEl.setAttribute("data-enabled", String(Boolean(s.enabled)));
      state.widgetEl.setAttribute("data-open", String(Boolean(s.panelOpen)));
      state.widgetEl.setAttribute("data-pill-hidden", String(!s.showPill));
      const labelEl = state.widgetEl.querySelector("[data-matrix-pill-status]");
      if (labelEl) labelEl.textContent = s.enabled ? "Matrix ON" : "Matrix OFF";
    }

    const roots = [state.widgetEl, state.appearanceCardEl].filter(Boolean);
    for (const root of roots) {
      const setSwitch = (action, val) => {
        const el = root.querySelector(`[data-matrix-action="${action}"]`);
        if (el) el.setAttribute("aria-checked", String(Boolean(val)));
      };

      setSwitch("toggle-enabled", s.enabled);
      setSwitch("toggle-chat-glass", s.chatGlass);
      setSwitch("toggle-depth", s.depthMode);
      setSwitch("toggle-head-highlight", s.headHighlight);
      setSwitch("toggle-rainbow", s.rainBow);
      setSwitch("toggle-splitter-sync", s.splitterMatchSymbol);
      setSwitch("toggle-overlay", s.overlayBlend);
      setSwitch("toggle-show-pill", s.showPill);

      const glassRow = root.querySelector('[data-matrix-row="chatGlassOpacity"]');
      if (glassRow) glassRow.style.display = s.chatGlass ? "flex" : "none";

      const glassBlurRow = root.querySelector('[data-matrix-row="chatGlassBlur"]');
      if (glassBlurRow) glassBlurRow.style.display = s.chatGlass ? "flex" : "none";

      const rbRow = root.querySelector('[data-matrix-row="rainbowSpeed"]');
      if (rbRow) rbRow.style.opacity = s.rainBow ? "1" : "0.45";

      const spRow = root.querySelector('[data-matrix-row="splitterColor"]');
      if (spRow) spRow.style.display = s.splitterMatchSymbol ? "none" : "flex";

      for (const key of [
        "matrixColor",
        "backgroundColor",
        "splitterColor",
        "glyphSet",
        "matrixSpeed",
        "fontSize",
        "rainOpacity",
        "trailOpacity",
        "rainbowSpeed",
        "splitterGlowIntensity",
        "splitterThickness",
        "uiOpacity",
        "chatGlassOpacity",
        "chatGlassBlur",
      ]) {
        const inputEl = root.querySelector(`[data-matrix-input="${key}"]`);
        if (inputEl && document.activeElement !== inputEl) {
          inputEl.value = String(s[key]);
        }
      }

      const setText = (key, text) => {
        const el = root.querySelector(`[data-matrix-text="${key}"]`);
        if (el) el.textContent = text;
      };

      setText("matrixColor", s.matrixColor.toUpperCase());
      setText("backgroundColor", s.backgroundColor.toUpperCase());
      setText("splitterColor", s.splitterColor.toUpperCase());
      setText("matrixSpeed", `${s.matrixSpeed} ms`);
      setText("fontSize", `${s.fontSize} px`);
      setText("rainOpacity", `${Math.round(s.rainOpacity * 100)}%`);
      setText("trailOpacity", `${Math.round(s.trailOpacity * 100)}%`);
      setText("rainbowSpeed", `${s.rainbowSpeed}%`);
      setText("splitterGlowIntensity", `${s.splitterGlowIntensity}%`);
      setText("splitterThickness", `${s.splitterThickness} px`);
      setText("uiOpacity", `${Math.round(s.uiOpacity * 100)}%`);
      setText("chatGlassOpacity", `${Math.round(s.chatGlassOpacity * 100)}%`);
      setText("chatGlassBlur", `${s.chatGlassBlur} px`);
    }
  }

  function createFloatingWidget() {
    const existing = document.getElementById("t3-matrix-controller");
    if (existing) existing.remove();
    const widget = document.createElement("div");
    widget.id = "t3-matrix-controller";
    widget.setAttribute("data-enabled", String(Boolean(state.settings.enabled)));
    widget.setAttribute("data-open", String(Boolean(state.settings.panelOpen)));
    widget.setAttribute("data-pill-hidden", String(!state.settings.showPill));
    widget.innerHTML = `
      <div id="t3-matrix-popover" role="dialog" aria-label="Matrix Rain Theme Settings">
        ${renderControlsInnerHtml()}
      </div>
      <div id="t3-matrix-pill-bar" style="display:flex;align-items:center;gap:6px;justify-content:flex-end">
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
      "margin-top: 14px; padding: 16px; border-radius: 12px; border: 1px solid rgba(var(--matrix-symbol-rgb, 0, 255, 70), 0.45); background: rgba(var(--matrix-bg-rgb, 0, 0, 0), 0.84); display: flex; flex-direction: column; gap: 11px; position: relative; z-index: 65;";
    card.innerHTML = renderControlsInnerHtml();
    bindControlEvents(card);
    appearanceSection.appendChild(card);
    state.appearanceCardEl = card;
  }

  function onKeyDown(e) {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "m") {
      e.preventDefault();
      updateSetting({ enabled: !state.settings.enabled });
    } else if (e.key === "Escape" && state.settings.panelOpen) {
      updateSetting({ panelOpen: false });
    }
  }

  function onDocumentPointerDown(e) {
    if (!state.settings.panelOpen || !state.widgetEl) return;
    if (!state.widgetEl.contains(e.target)) {
      updateSetting({ panelOpen: false });
    }
  }

  function reconcileDom() {
    state.mutationRafId = null;
    if (!state.mounted) return;
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
  }

  function scheduleReconcileDom() {
    if (state.mutationRafId !== null) return;
    state.mutationRafId = window.requestAnimationFrame(reconcileDom);
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
    restartLoop(true);
    maybeInjectAppearanceSettingsCard();

    window.addEventListener("resize", resizeCanvas);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("focus", ensureLoopRunning);
    window.addEventListener("pageshow", ensureLoopRunning);
    document.addEventListener("pointerdown", onDocumentPointerDown, true);
    document.addEventListener("visibilitychange", onVisibilityChange);

    const observer = new MutationObserver(scheduleReconcileDom);
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
    resetSettings,
    toggle: () => updateSetting({ enabled: !state.settings.enabled }),
    enable: () => updateSetting({ enabled: true }),
    disable: () => updateSetting({ enabled: false }),
    openPanel: () => updateSetting({ showPill: true, panelOpen: true }),
    showPill: () => updateSetting({ showPill: true }),
    livelyPropertyListener,
    destroy: () => {
      state.mounted = false;
      stopLoop();
      if (state.mutationRafId !== null) {
        window.cancelAnimationFrame(state.mutationRafId);
        state.mutationRafId = null;
      }
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("focus", ensureLoopRunning);
      window.removeEventListener("pageshow", ensureLoopRunning);
      document.removeEventListener("pointerdown", onDocumentPointerDown, true);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      state.observer?.disconnect();
      state.canvas?.remove();
      state.styleEl?.remove();
      state.widgetEl?.remove();
      state.appearanceCardEl?.remove();
      document.documentElement.removeAttribute("data-t3-matrix-rain");
      document.documentElement.removeAttribute("data-t3-matrix-overlay");
      document.documentElement.removeAttribute("data-t3-matrix-chat-glass");
    },
  };
})();
