/**
 * T3 Code — Context Breakdown Mod
 * Adds a "Context NN%" row to the header "Project actions" panel. Clicking it expands, inline under the row,
 * a breakdown like Claude Code's /context: per-category tokens, deferred tools, autocompact buffer,
 * free space, and expandable MCP tools / memory files / skills.
 * Data comes from the server patch (install.mjs) at GET /api/t3mod/context-usage?threadId=…,
 * which calls the Claude Agent SDK's query.getContextUsage() for the thread's live session.
 */
(() => {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window.T3ContextBreakdown?.destroy) window.T3ContextBreakdown.destroy();

  const STORAGE_KEY = "t3code:context-breakdown:v1";
  const POLL_MS = 15000;
  const COLORS = {
    messages: "#4a8cf7",
    system_tools: "#e2622f",
    mcp_tools: "#16a37f",
    system_prompt: "#d9a21b",
    skills: "#8fcf8f",
    mcp_instructions: "#7dbb8c",
    memory_files: "#a6cfa6",
    custom_agents: "#a78bfa",
    autocompact_buffer: "#5d6661",
    free_space: "#2f3633",
  };
  Object.assign(COLORS, { cached_input: "#16a37f", new_input: "#4a8cf7", output: "#d9a21b", reasoning: "#a78bfa", used: "#4a8cf7", other: "#8a8f8c" });
  const PROVIDER_NAMES = { claudeAgent: "Claude", codex: "Codex", antigravity: "Antigravity", pi: "Pi", cursor: "Cursor" };

  // Non-Claude providers report totals only; turn them into the same shape as Claude's breakdown.
  function fromTotals(t) {
    const max = t.maxTokens ?? null, used = t.usedTokens;
    const n = (v) => (Number.isFinite(v) ? Math.max(0, v) : 0);
    const cached = n(t.cachedInputTokens), input = n(t.inputTokens), reasoning = n(t.reasoningOutputTokens);
    const output = Math.max(0, n(t.outputTokens) - reasoning); // reasoning is a subset of output tokens
    const parts = input || output || reasoning
      ? [
          { id: "cached_input", name: "Cached input", tokens: Math.min(cached, input) },
          { id: "new_input", name: "New input", tokens: Math.max(0, input - cached) },
          { id: "output", name: "Output", tokens: output },
          { id: "reasoning", name: "Reasoning", tokens: reasoning },
        ].filter((c) => c.tokens > 0)
      : [{ id: "used", name: "Used", tokens: used }];
    const other = used - parts.reduce((s, c) => s + c.tokens, 0);
    if (other > 0) parts.push({ id: "other", name: "Other", tokens: other });
    if (max) parts.push({ id: "free_space", name: "Free space", tokens: Math.max(0, max - used) });
    return {
      ...t,
      totalTokens: used,
      maxTokens: max,
      percentage: max ? Math.round((used / max) * 100) : null,
      categories: parts,
      note: `${PROVIDER_NAMES[t.driver] ?? t.driver ?? "This provider"} reports token totals only, not a per-category breakdown.`,
    };
  }

  const fallbackColor =(id) => `hsl(${[...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7)} 55% 60%)`;
  const colorOf = (c) => COLORS[c.id] ?? (c.isDeferred ? "#4b5563" : fallbackColor(c.id || c.name));

  let state = { expanded: false, open: {} };
  try { Object.assign(state, JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}")); } catch {}
  const save = () => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {} };

  const fmt = (n) => {
    if (n == null || !Number.isFinite(n)) return "—";
    if (n >= 1e6) return `${+(n / 1e6).toFixed(n % 1e6 ? 1 : 0)}M`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
    return String(n);
  };
  const pct = (n, max) => (max ? `${((n / max) * 100).toFixed(1)}%` : "—");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

  // Inherit the panel's font and colors; only accents and dividers are drawn here.
  const style = document.createElement("style");
  style.id = "t3-ctx-style";
  style.textContent = `
.t3-ctx-item{cursor:pointer}
.t3-ctx-item[role=menuitem]:hover,.t3-ctx-item[role=menuitem]:focus-visible{background:var(--color-accent,color-mix(in oklab,currentColor 8%,transparent));outline:none}
.t3-ctx-meta{margin-left:auto;display:flex;align-items:center;gap:6px;font-variant-numeric:tabular-nums}
.t3-ctx-chev{display:inline-flex;transition:transform .15s;opacity:.6}
.t3-ctx-item[aria-expanded=true] .t3-ctx-chev{transform:rotate(180deg)}
.t3-ctx-bar,.t3-ctx-body .bar{display:flex;overflow:hidden;background:color-mix(in oklab,currentColor 14%,transparent)}
.t3-ctx-bar{width:44px;height:4px;border-radius:2px}
.t3-ctx-bar i,.t3-ctx-body .bar i{display:block;height:100%}
.t3-ctx-body{padding:4px 8px 8px;font-size:12px;line-height:1.35;color:inherit;cursor:default}
.t3-ctx-body .sum{display:flex;justify-content:space-between;margin:2px 0 6px}
.t3-ctx-body .bar{height:6px;border-radius:3px}
.t3-ctx-body .rows{margin-top:8px;display:grid;grid-template-columns:10px minmax(0,1fr) auto 42px;gap:3px 8px;align-items:center}
.t3-ctx-body .sw{width:10px;height:10px;border-radius:2px}
.t3-ctx-body .num,.t3-ctx-body .note,.t3-ctx-body .n{color:var(--color-muted-foreground,inherit);font-variant-numeric:tabular-nums}
.t3-ctx-body .num{text-align:right}
.t3-ctx-body .dim{opacity:.6}
.t3-ctx-body .gap{grid-column:1/-1;height:4px}
.t3-ctx-body .sec{margin-top:6px;border-top:1px solid color-mix(in oklab,currentColor 12%,transparent);padding-top:4px}
.t3-ctx-body .sec>button{all:unset;box-sizing:border-box;display:flex;width:100%;gap:6px;align-items:center;padding:3px 0;cursor:pointer}
.t3-ctx-body .sec>button:focus-visible{outline:2px solid var(--color-ring,currentColor);outline-offset:1px;border-radius:4px}
.t3-ctx-body .sec>button .n{margin-left:auto}
.t3-ctx-body .chev{display:inline-block;transition:transform .15s;opacity:.6}
.t3-ctx-body .sec.closed .chev{transform:rotate(-90deg)}
.t3-ctx-body .items{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 8px;padding:2px 0 2px 16px}
.t3-ctx-body .sec.closed .items{display:none}
.t3-ctx-body .nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.t3-ctx-body .note{padding-top:6px}
`;
  document.head.appendChild(style);

  let data = null; // last payload for the current thread
  let error = null;
  let threadId = null;
  let tokenPromise = null;

  // The desktop app uses hash routing (t3code://app/#/<env>/<thread>); the web build uses the path.
  const currentRoute = () => (location.hash.startsWith("#/") ? location.hash.slice(1).split(/[?#]/)[0] : location.pathname);
  const currentThreadId = () => {
    const parts = currentRoute().split("/").filter(Boolean);
    return parts.length === 2 && /^[0-9a-f-]{36}$/i.test(parts[1]) ? parts[1] : null;
  };

  async function fetchUsage(id) {
    const bridge = window.desktopBridge;
    if (!bridge) throw new Error("Desktop app only");
    const primary = (bridge.getLocalEnvironmentBootstraps?.() ?? []).find((e) => e.id === "primary");
    if (!primary?.httpBaseUrl) throw new Error("Local environment not available");
    tokenPromise ??= bridge.getLocalEnvironmentBearerToken();
    // The local server forwards threads of a linked machine (route /<environmentId>/<threadId>) to that machine.
    const environmentId = currentRoute().split("/").filter(Boolean)[0] ?? "";
    const query = `threadId=${encodeURIComponent(id)}&environmentId=${encodeURIComponent(environmentId)}`;
    const res = await fetch(new URL(`/api/t3mod/context-usage?${query}`, primary.httpBaseUrl), {
      headers: { authorization: `Bearer ${await tokenPromise}` },
    });
    if (res.status === 401) tokenPromise = null; // token rotated; refetch next poll
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    // An unpatched server answers unknown paths with the SPA's index.html.
    if (!res.headers.get("content-type")?.includes("json")) throw new Error("Server patch not installed — close T3 and run install.mjs");
    return res.json();
  }

  async function refresh() {
    const id = currentThreadId();
    if (id !== threadId) { threadId = id; data = null; error = null; }
    if (!id || document.visibilityState !== "visible") return render();
    try {
      const next = await fetchUsage(id);
      if (id === threadId) { data = next?.totalsOnly ? fromTotals(next) : next; error = null; }
    } catch (e) {
      if (id === threadId) error = e.message || String(e);
    }
    render();
  }

  function section(key, title, count, itemsHtml) {
    const closed = !state.open[key];
    return `<div class="sec${closed ? " closed" : ""}"><button type="button" data-sec="${key}" aria-expanded="${!closed}">
      <span class="chev">▾</span>${esc(title)}<span class="n">${esc(count)}</span></button>
      <div class="items">${itemsHtml}</div></div>`;
  }

  const usedPctOf = (d) => (d?.maxTokens ? `${d.percentage ?? Math.round((d.totalTokens / d.maxTokens) * 100)}%` : "—");
  const barOf = (d, skipFree) => (d?.categories ?? [])
    .filter((c) => !c.isDeferred && c.tokens > 0 && d.maxTokens && !(skipFree && c.id === "free_space"))
    .map((c) => `<i style="width:${(c.tokens / d.maxTokens) * 100}%;background:${colorOf(c)}" title="${esc(c.name)}"></i>`).join("");

  function bodyHtml() {
    if (!data) return `<div class="note">${esc(error || "No usage for this thread yet. It appears after the thread's next turn.")}</div>`;
    const max = data.maxTokens;
    const cats = data.categories ?? [];
    const row = (c, dim) => `<span class="sw" style="background:${colorOf(c)}"></span>
      <span class="nm${dim ? " dim" : ""}">${esc(c.name)}</span>
      <span class="num">${fmt(c.tokens)}</span><span class="num">${dim ? "—" : pct(c.tokens, max)}</span>`;
    const live = cats.filter((c) => !c.isDeferred), deferred = cats.filter((c) => c.isDeferred);

    const byServer = {};
    for (const t of data.mcpTools ?? []) {
      const v = (byServer[t.serverName] ??= { n: 0, tokens: 0, loaded: 0 });
      v.n++; v.tokens += t.tokens; v.loaded += t.isLoaded ? 1 : 0;
    }
    const mcpItems = Object.entries(byServer).sort((a, b) => b[1].tokens - a[1].tokens)
      .map(([s, v]) => `<span class="nm" title="${v.loaded}/${v.n} loaded">${esc(s)} · ${v.n}</span><span class="num">${fmt(v.tokens)}</span>`).join("");
    const memItems = (data.memoryFiles ?? [])
      .map((f) => `<span class="nm" title="${esc(f.path)}">${esc(f.type)} · ${esc(f.path.split(/[\\/]/).slice(-2).join("/"))}</span><span class="num">${fmt(f.tokens)}</span>`).join("");
    const skillItems = [...(data.skills?.skillFrontmatter ?? [])].sort((a, b) => b.tokens - a.tokens)
      .map((s) => `<span class="nm" title="${esc(s.path)}">${esc(s.name)}</span><span class="num">${fmt(s.tokens)}</span>`).join("");

    return `<div class="sum"><span><b>${usedPctOf(data)}</b> used</span><span class="num">${fmt(data.totalTokens)} / ${fmt(max)}</span></div>
      <div class="bar">${barOf(data, false)}</div>
      <div class="rows">${live.map((c) => row(c, false)).join("")}${deferred.length ? `<div class="gap"></div>${deferred.map((c) => row(c, true)).join("")}` : ""}</div>
      ${mcpItems ? section("mcp", "MCP tools", data.mcpTools.length, mcpItems) : ""}
      ${memItems ? section("mem", "Memory files", data.memoryFiles.length, memItems) : ""}
      ${skillItems ? section("skills", "Skills", data.skills.skillFrontmatter.length, skillItems) : ""}
      ${data.cost ? `<div class="sum" style="margin-top:8px"><span>Session cost</span><span class="num">${esc(data.cost.currency)} ${data.cost.amount.toFixed(2)}</span></div>` : ""}
      ${data.note ? `<div class="note">${esc(data.note)}</div>` : ""}
      ${data.stale ? `<div class="note">Session closed — showing the last snapshot.</div>` : ""}`;
  }

  // --- "Context NN%" row in T3's header "Project actions" panel/menu -----------------------------
  // T3 renders it either as a panel of row <button>s or as a [role=menu] dropdown, depending on width.
  const MENU_MARKER = /(^|\s)(Add project script|Add action|Initialize Git)$/;
  const PANEL_MARKER = /^Add project script$/;
  const ICON = `<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="8" cy="8" r="6"/><path d="M8 2a6 6 0 0 1 6 6H8z" fill="currentColor" stroke="none"/></svg>`;
  const CHEVRON = `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg>`;

  const rowHtml = () =>
    `${ICON}<span>Context</span><span class="t3-ctx-meta"><span class="t3-ctx-bar">${barOf(data, true)}</span><b>${usedPctOf(data)}</b><span class="t3-ctx-chev">${CHEVRON}</span></span>`;

  function toggle() {
    state.expanded = !state.expanded;
    save();
    render();
    if (state.expanded) refresh();
  }

  // Each host: the container to append to, and an existing row to copy styling from.
  function findHosts() {
    const hosts = [];
    for (const menu of document.querySelectorAll('[role="menu"]')) {
      const items = [...menu.querySelectorAll('[role="menuitem"]:not(.t3-ctx-item)')];
      if (items.some((i) => MENU_MARKER.test(i.textContent.trim()))) hosts.push({ box: items.at(-1).parentElement, template: items.at(-1), menu: true });
    }
    for (const btn of document.querySelectorAll("button:not(.t3-ctx-item)")) {
      if (!btn.closest('[role="menu"]') && PANEL_MARKER.test(btn.textContent.trim())) hosts.push({ box: btn.parentElement, template: btn, menu: false });
    }
    return hosts;
  }

  const setHtml = (el, html) => { if (el._html !== html) el.innerHTML = el._html = html; }; // our own writes re-trigger the observer

  function render() {
    for (const { box, template, menu } of findHosts()) {
      let item = box.querySelector(":scope > .t3-ctx-item");
      if (!threadId) { box.querySelectorAll(":scope > .t3-ctx-item, :scope > .t3-ctx-sep, :scope > .t3-ctx-body").forEach((el) => el.remove()); continue; }
      if (!item) {
        const sep = box.querySelector(':scope > [role="separator"], :scope > [data-slot="separator"]')?.cloneNode(false);
        sep?.classList.add("t3-ctx-sep");
        item = document.createElement(menu ? "div" : "button");
        item.className = `${template.className} t3-ctx-item`;
        if (menu) {
          item.setAttribute("role", "menuitem");
          item.tabIndex = 0;
          item.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } });
        } else item.type = "button";
        item.title = "Context window breakdown";
        // Keep clicks from reaching T3's menu/popover handlers so it stays open while toggling.
        item.addEventListener("click", (e) => { e.stopPropagation(); toggle(); });
        box.append(...(sep ? [sep] : []), item);
        refresh();
      }
      item.setAttribute("aria-expanded", String(!!state.expanded));
      setHtml(item, rowHtml());

      let body = box.querySelector(":scope > .t3-ctx-body");
      if (!state.expanded) { body?.remove(); continue; }
      if (!body) {
        body = document.createElement("div");
        body.className = "t3-ctx-body";
        body.setAttribute("role", "region");
        body.setAttribute("aria-label", "Context window breakdown");
        body.addEventListener("click", (e) => {
          e.stopPropagation();
          const sec = e.target.closest("[data-sec]");
          if (sec) { state.open[sec.dataset.sec] = !state.open[sec.dataset.sec]; save(); render(); }
        });
        item.after(body);
      }
      setHtml(body, bodyHtml());
    }
  }

  let frame = 0;
  const observer = new MutationObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(render); });
  observer.observe(document.body, { childList: true, subtree: true });

  let lastPath = currentRoute();
  const routeTimer = setInterval(() => {
    if (currentRoute() !== lastPath) { lastPath = currentRoute(); refresh(); }
  }, 750);
  const pollTimer = setInterval(refresh, POLL_MS);
  const onVisible = () => document.visibilityState === "visible" && refresh();
  document.addEventListener("visibilitychange", onVisible);
  refresh();

  window.T3ContextBreakdown = {
    refresh,
    destroy() {
      clearInterval(routeTimer);
      clearInterval(pollTimer);
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisible);
      document.querySelectorAll(".t3-ctx-item, .t3-ctx-sep, .t3-ctx-body").forEach((el) => el.remove());
      style.remove();
      delete window.T3ContextBreakdown;
    },
  };
})();
