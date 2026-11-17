// Self-check for the Context Breakdown server registry: node test-context-registry.mjs
import assert from "node:assert/strict";
import { CTX_REGISTRY, patchServerJs } from "./install.mjs";

// Query hook: old (bare) and 0.1.7+ (wrapped) call shapes
const call = "Y8e({\n prompt,\n options: {\n ...options,\n spawnClaudeCodeProcess\n }\n })";
assert.ok(patchServerJs(`try: () => ${call},`).includes(`try: () => globalThis.__t3modCtx.register(input.threadId, ${call}),`));
assert.ok(patchServerJs(`try: () => wrapW(() => ${call}),`).includes(`try: () => wrapW(() => globalThis.__t3modCtx.register(input.threadId, ${call})),`));

new Function(CTX_REGISTRY.replace(/\/\*.*?\*\//g, ""))();
const R = globalThis.__t3modCtx;
const tick = () => new Promise((r) => setTimeout(r, 5));

// Unknown thread
assert.equal(await R.get("none"), null);

// Codex: totals only
R.recordUsage("codex-t", "codex", { usedTokens: 50000, maxTokens: 258000, inputTokens: 48000, cachedInputTokens: 40000, outputTokens: 2000 });
const c = await R.get("codex-t");
assert.equal(c.totalsOnly, true);
assert.equal(c.driver, "codex");
assert.equal(c.maxTokens, 258000);

// Antigravity: later partial update merges (keeps maxTokens, adds cost)
R.recordUsage("agy-t", "antigravity", { usedTokens: 1000, maxTokens: 1048576 });
R.recordUsage("agy-t", undefined, { usedTokens: 1200, cost: { amount: 0.01, currency: "USD" } });
const a = await R.get("agy-t");
assert.deepEqual([a.usedTokens, a.maxTokens, a.driver, a.cost.currency], [1200, 1048576, "antigravity", "USD"]);

// Claude: live query wins over its own totals
let open = true;
const q = { getContextUsage: async () => { if (!open) throw new Error("closed"); return { categories: [{ id: "messages", tokens: 1 }], totalTokens: 9, maxTokens: 100, gridRows: [[]] }; } };
R.register("claude-t", q);
await tick();
R.recordUsage("claude-t", "claudeAgent", { usedTokens: 9, maxTokens: 100 });
const live = await R.get("claude-t");
assert.ok(live.categories && !("gridRows" in live) && live.driver === "claudeAgent");

// Closed Claude session -> stale breakdown (after cache expiry)
open = false;
await new Promise((r) => setTimeout(r, 3100));
assert.equal((await R.get("claude-t")).stale, true);

// Thread switched from Claude to Codex -> Codex totals
await tick();
R.recordUsage("claude-t", "codex", { usedTokens: 7, maxTokens: 200 });
const switched = await R.get("claude-t");
assert.deepEqual([switched.driver, switched.totalsOnly], ["codex", true]);

console.log("context registry: all checks passed");
