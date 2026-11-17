#!/usr/bin/env node
/**
 * T3 Code — Matrix Rain Animated Theme Installer / Uninstaller
 *
 * Usage:
 *   node install.mjs           # Install / update Matrix Rain Mod in T3 Code
 *   node install.mjs --remove  # Uninstall and restore original T3 Code files
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Installable mods; which ones are installed is remembered in ~/.t3/userdata/t3-mods.json.
const MODS = { matrix: "matrix-rain-mod.js" };
const THEME_JSON_PATH = path.join(__dirname, "matrix-rain.theme.json");
const SCRIPT_TAG = '<script src="/matrix-rain-mod.js" defer></script>';
const INLINE_MARKER_START = "<!-- T3-MATRIX-RAIN-MOD-START -->";
const INLINE_MARKER_END = "<!-- T3-MATRIX-RAIN-MOD-END -->";
const JS_MARKER_START = "/* === T3-MATRIX-RAIN-MOD-JS-START === */";
const JS_MARKER_END = "/* === T3-MATRIX-RAIN-MOD-JS-END === */";

const argValue = (flag) => { const i = process.argv.indexOf(flag); return i === -1 ? undefined : process.argv[i + 1]; };
const removeAll = process.argv.includes("--remove") || process.argv.includes("--uninstall");
const removeMod = argValue("--remove-mod");
const onlyMods = argValue("--mods");

function computeAsarIntegrity(buffer) {
  const blockSize = 4194304; // 4 MB standard Electron ASAR integrity block size
  const blocks = [];
  for (let offset = 0; offset < buffer.length; offset += blockSize) {
    const slice = buffer.subarray(offset, Math.min(offset + blockSize, buffer.length));
    blocks.push(crypto.createHash("sha256").update(slice).digest("hex"));
  }
  if (blocks.length === 0) {
    blocks.push(crypto.createHash("sha256").update(Buffer.alloc(0)).digest("hex"));
  }
  const hash = crypto.createHash("sha256").update(buffer).digest("hex");
  return {
    algorithm: "SHA256",
    hash,
    blockSize,
    blocks,
  };
}

function getInlineScriptBlock(modCode) {
  return `${INLINE_MARKER_START}\n<script>\n${modCode}\n</script>\n${INLINE_MARKER_END}`;
}

function patchHtmlContent(html, modCode, remove = false) {
  const startIdx = html.indexOf(INLINE_MARKER_START);
  const endIdx = html.indexOf(INLINE_MARKER_END);
  let cleaned = html;
  if (startIdx !== -1 && endIdx !== -1) {
    cleaned =
      html.slice(0, startIdx) + html.slice(endIdx + INLINE_MARKER_END.length);
  }
  cleaned = cleaned.replace(SCRIPT_TAG, "");

  if (remove) return cleaned;

  const block = getInlineScriptBlock(modCode);
  if (cleaned.includes("</body>")) {
    return cleaned.replace("</body>", `${block}\n  </body>`);
  }
  return `${cleaned}\n${block}`;
}

function patchJsContent(jsSource, modCode, remove = false) {
  const startIdx = jsSource.indexOf(JS_MARKER_START);
  const endIdx = jsSource.indexOf(JS_MARKER_END);
  let cleaned = jsSource;
  if (startIdx !== -1 && endIdx !== -1) {
    cleaned =
      jsSource.slice(0, startIdx) + jsSource.slice(endIdx + JS_MARKER_END.length);
  }
  if (remove) return cleaned.trimEnd() + "\n";

  const mapCommentMatch = cleaned.match(/\/\/# sourceMappingURL=.*$/m);
  const injection = `\n${JS_MARKER_START}\n${modCode}\n${JS_MARKER_END}\n`;
  if (mapCommentMatch && mapCommentMatch.index !== undefined) {
    return (
      cleaned.slice(0, mapCommentMatch.index) +
      injection +
      cleaned.slice(mapCommentMatch.index)
    );
  }
  return `${cleaned}\n${injection}`;
}

function patchPreloadContent(preloadSource, modCode, remove = false) {
  const startIdx = preloadSource.indexOf(JS_MARKER_START);
  const endIdx = preloadSource.indexOf(JS_MARKER_END);
  let cleaned = preloadSource;
  if (startIdx !== -1 && endIdx !== -1) {
    cleaned =
      preloadSource.slice(0, startIdx) +
      preloadSource.slice(endIdx + JS_MARKER_END.length);
  }
  if (remove) return cleaned.trimEnd() + "\n";

  // Preload runs with contextIsolation: true. Injecting a <script> tag into document.documentElement
  // runs in the main world (having access to window.T3MatrixRain and DOM) while bypassing any HTTP cache!
  const preloadWrapper = `
${JS_MARKER_START}
(() => {
  try {
    const injectIntoMainWorld = () => {
      if (typeof document === "undefined") return;
      if (document.getElementById("t3-matrix-rain-preload-script") || document.getElementById("t3-matrix-rain-canvas")) return;
      const s = document.createElement("script");
      s.id = "t3-matrix-rain-preload-script";
      s.textContent = ${JSON.stringify(modCode)};
      (document.head || document.documentElement).appendChild(s);
    };
    if (typeof window !== "undefined") {
      if (document.readyState === "loading") {
        window.addEventListener("DOMContentLoaded", injectIntoMainWorld, { once: true });
      } else {
        injectIntoMainWorld();
      }
    }
  } catch (err) {
    console.error("[T3 Matrix Rain Preload Error]", err);
  }
})();
${JS_MARKER_END}
`;
  return `${cleaned}\n${preloadWrapper}`;
}

function buildUpdatedAsarBuffer(buf, mutator) {
  const headerPickleSize = buf.readUInt32LE(4);
  const jsonLen = buf.readUInt32LE(12);
  const headerJsonStr = buf.subarray(16, 16 + jsonLen).toString("utf8");
  const header = JSON.parse(headerJsonStr);
  const dataOffset = 8 + headerPickleSize;

  const extraBuffers = [];
  let runningOffset = buf.length - dataOffset;

  const appendFileEntry = (entryObj, newBytes) => {
    entryObj.offset = String(runningOffset);
    entryObj.size = newBytes.length;
    entryObj.integrity = computeAsarIntegrity(newBytes);
    extraBuffers.push(newBytes);
    runningOffset += newBytes.length;
  };

  const readFileEntry = (entryObj) => {
    const off = Number(entryObj.offset);
    const sz = Number(entryObj.size);
    return buf.subarray(dataOffset + off, dataOffset + off + sz);
  };

  mutator({ header, readFileEntry, appendFileEntry });

  const newJsonBytes = Buffer.from(JSON.stringify(header), "utf8");
  const alignPadding = (4 - (newJsonBytes.length % 4)) % 4;
  const alignedJsonLen = newJsonBytes.length + alignPadding;
  const newHeaderPickleSize = alignedJsonLen + 8;

  const newHeaderBuf = Buffer.alloc(8 + newHeaderPickleSize);
  newHeaderBuf.writeUInt32LE(4, 0);
  newHeaderBuf.writeUInt32LE(newHeaderPickleSize, 4);
  newHeaderBuf.writeUInt32LE(alignedJsonLen + 4, 8);
  newHeaderBuf.writeUInt32LE(newJsonBytes.length, 12);
  newJsonBytes.copy(newHeaderBuf, 16);

  const originalDataSlice = buf.subarray(dataOffset);
  return Buffer.concat([newHeaderBuf, originalDataSlice, ...extraBuffers]);
}

function patchServerAsar(asarPath, modCode, remove = false) {
  if (!fs.existsSync(asarPath)) {
    return { status: "skipped", reason: `Not found: ${asarPath}` };
  }

  const backupPath = `${asarPath}.bak`;
  if (remove) {
    if (fs.existsSync(backupPath)) {
      fs.copyFileSync(backupPath, asarPath);
      return { status: "restored", path: asarPath };
    }
    return { status: "skipped", reason: "No .bak file found to restore" };
  }

  // Refresh the backup whenever the live asar is unpatched (first install, or a T3 update replaced it),
  // so we never rebuild from a stale backup of an older T3 version.
  if (!fs.existsSync(backupPath) || !fs.readFileSync(asarPath).includes(JS_MARKER_START)) {
    fs.copyFileSync(asarPath, backupPath);
  }

  const sourcePath = fs.existsSync(backupPath) ? backupPath : asarPath;
  const buf = fs.readFileSync(sourcePath);

  const patchedFiles = [];
  const finalBuf = buildUpdatedAsarBuffer(buf, ({ header, readFileEntry, appendFileEntry }) => {
    const clientNode =
      header?.files?.apps?.files?.server?.files?.dist?.files?.client?.files;
    if (!clientNode) return;

    // 1. Patch index.html
    const indexEntry = clientNode["index.html"];
    if (indexEntry && !indexEntry.unpacked) {
      const origHtml = readFileEntry(indexEntry).toString("utf8");
      const patchedHtml = patchHtmlContent(origHtml, modCode, false);
      appendFileEntry(indexEntry, Buffer.from(patchedHtml, "utf8"));
      patchedFiles.push("index.html");
    }

    // 2. Patch entry JS bundle (assets/index-*.js)
    const assetsNode = clientNode.assets?.files;
    if (assetsNode) {
      for (const [fileName, entry] of Object.entries(assetsNode)) {
        if (/^index-[A-Za-z0-9_-]+\.js$/.test(fileName) && !entry.unpacked) {
          const origJs = readFileEntry(entry).toString("utf8");
          const patchedJs = patchJsContent(origJs, modCode, false);
          appendFileEntry(entry, Buffer.from(patchedJs, "utf8"));
          patchedFiles.push(`assets/${fileName}`);
        }
      }
    }
  });

  fs.writeFileSync(asarPath, finalBuf);
  return { status: "patched", path: `${asarPath} (${patchedFiles.join(", ")})` };
}

function patchAppAsar(asarPath, modCode, remove = false) {
  if (!fs.existsSync(asarPath)) {
    return { status: "skipped", reason: `Not found: ${asarPath}` };
  }

  const backupPath = `${asarPath}.bak`;
  if (remove) {
    if (fs.existsSync(backupPath)) {
      fs.copyFileSync(backupPath, asarPath);
      return { status: "restored", path: asarPath };
    }
    return { status: "skipped", reason: "No .bak file found to restore" };
  }

  // Refresh the backup whenever the live asar is unpatched (first install, or a T3 update replaced it),
  // so we never rebuild from a stale backup of an older T3 version.
  if (!fs.existsSync(backupPath) || !fs.readFileSync(asarPath).includes(JS_MARKER_START)) {
    fs.copyFileSync(asarPath, backupPath);
  }

  const sourcePath = fs.existsSync(backupPath) ? backupPath : asarPath;
  const buf = fs.readFileSync(sourcePath);

  const patchedFiles = [];
  const finalBuf = buildUpdatedAsarBuffer(buf, ({ header, readFileEntry, appendFileEntry }) => {
    const distElectron =
      header?.files?.apps?.files?.desktop?.files?.["dist-electron"]?.files;
    const preloadEntry = distElectron?.["preload.cjs"];
    if (preloadEntry && !preloadEntry.unpacked) {
      const origPreload = readFileEntry(preloadEntry).toString("utf8");
      const patchedPreload = patchPreloadContent(origPreload, modCode, false);
      appendFileEntry(preloadEntry, Buffer.from(patchedPreload, "utf8"));
      patchedFiles.push("preload.cjs");
    }
  });

  fs.writeFileSync(asarPath, finalBuf);
  return { status: "patched", path: `${asarPath} (${patchedFiles.join(", ")})` };
}

function readState(stateFile) {
  try {
    const mods = JSON.parse(fs.readFileSync(stateFile, "utf8")).mods;
    return Array.isArray(mods) ? mods.filter((m) => m in MODS) : null;
  } catch {
    return null; // no state yet: earlier installs always had both mods
  }
}

function main() {
  const home = os.homedir();
  const t3Dir = path.join(home, ".t3");
  const stateFile = path.join(t3Dir, "userdata", "t3-mods.json");

  for (const name of [removeMod, ...(onlyMods ?? "").split(",")].filter(Boolean)) {
    if (!(name in MODS)) {
      console.error(`Unknown mod "${name}". Known mods: ${Object.keys(MODS).join(", ")}`);
      process.exit(1);
    }
  }
  let mods = onlyMods ? onlyMods.split(",").filter(Boolean) : readState(stateFile) ?? Object.keys(MODS);
  if (removeMod) mods = mods.filter((m) => m !== removeMod);
  if (removeAll) mods = [];
  const isUninstall = mods.length === 0; // nothing left: restore T3's original files
  const modCode = mods.map((m) => fs.readFileSync(path.join(__dirname, MODS[m]), "utf8")).join("\n;\n");

  console.log(isUninstall ? "=== Removing all T3 mods ===" : `=== Installing T3 mods: ${mods.join(", ")} ===`);

  // 1. Matrix Rain theme JSON in ~/.t3/userdata/themes
  const themesDir = path.join(t3Dir, "userdata", "themes");
  if (fs.existsSync(path.join(t3Dir, "userdata"))) {
    const destTheme = path.join(themesDir, "matrix-rain.theme.json");
    if (mods.includes("matrix")) {
      fs.mkdirSync(themesDir, { recursive: true });
      fs.copyFileSync(THEME_JSON_PATH, destTheme);
      console.log("[+] Installed theme file:", destTheme);
    } else if (fs.existsSync(destTheme)) {
      fs.unlinkSync(destTheme);
      console.log("[+] Removed theme file:", destTheme);
    }
  }

  // 2. Patch ~/.t3/runtime/versions/*/client/index.html AND assets/index-*.js if present
  const runtimeVersionsDir = path.join(t3Dir, "runtime", "versions");
  if (fs.existsSync(runtimeVersionsDir)) {
    for (const ver of fs.readdirSync(runtimeVersionsDir)) {
      const clientDir = path.join(runtimeVersionsDir, ver, "client");
      const clientIndex = path.join(clientDir, "index.html");
      if (fs.existsSync(clientIndex)) {
        const html = fs.readFileSync(clientIndex, "utf8");
        fs.writeFileSync(clientIndex, patchHtmlContent(html, modCode, isUninstall), "utf8");
        console.log(`[+] ${isUninstall ? "Restored" : "Patched"} runtime client HTML:`, clientIndex);
      }
      const assetsDir = path.join(clientDir, "assets");
      if (fs.existsSync(assetsDir)) {
        for (const f of fs.readdirSync(assetsDir)) {
          if (/^index-[A-Za-z0-9_-]+\.js$/.test(f)) {
            const jsPath = path.join(assetsDir, f);
            const jsContent = fs.readFileSync(jsPath, "utf8");
            fs.writeFileSync(jsPath, patchJsContent(jsContent, modCode, isUninstall), "utf8");
            console.log(`[+] ${isUninstall ? "Restored" : "Patched"} runtime client JS:`, jsPath);
          }
        }
      }
    }
  }

  // 3. Patch Local AppData Programs/t3code/resources/server.asar AND app.asar (rebuilt from the clean .bak each time)
  const localAppData = process.env.LOCALAPPDATA || path.join(home, "AppData", "Local");
  const resourcesDir = path.join(localAppData, "Programs", "t3code", "resources");
  let ok = true;

  try {
    const resServer = patchServerAsar(path.join(resourcesDir, "server.asar"), modCode, isUninstall);
    console.log(`[+] Desktop server.asar: ${resServer.status}`, resServer.reason || resServer.path || "");
  } catch (err) {
    ok = false;
    console.warn("[!] Could not write to server.asar:", err.message);
  }

  try {
    const resApp = patchAppAsar(path.join(resourcesDir, "app.asar"), modCode, isUninstall);
    console.log(`[+] Desktop app.asar: ${resApp.status}`, resApp.reason || resApp.path || "");
  } catch (err) {
    ok = false;
    console.warn("[!] Could not write to app.asar:", err.message);
  }

  if (!ok) {
    console.warn("\n[!] T3 Code is probably still running. Quit it completely and run this again.");
    process.exitCode = 1;
    return;
  }
  if (fs.existsSync(path.join(t3Dir, "userdata"))) {
    if (isUninstall) fs.rmSync(stateFile, { force: true });
    else fs.writeFileSync(stateFile, JSON.stringify({ mods }, null, 2));
  }
  console.log(`\nDone! Installed mods: ${mods.length ? mods.join(", ") : "none"}. Start T3 Code to see the change.`);
}

main();
