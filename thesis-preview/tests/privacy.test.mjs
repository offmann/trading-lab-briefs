import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function filesIn(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    if (entry.isDirectory()) out.push(...filesIn(full));
    else out.push(full);
  }
  return out;
}

function collectKeys(value, out = new Set()) {
  if (!value || typeof value !== "object") return out;
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, out);
    return out;
  }
  for (const [k, v] of Object.entries(value)) {
    out.add(k);
    collectKeys(v, out);
  }
  return out;
}

const files = filesIn(root);
const sources = files.filter((file) => !file.endsWith(`${path.sep}tests${path.sep}privacy.test.mjs`));

test("the preview bundle and archive.json have no notes content, secrets, or portfolio figures", () => {
  const banned = [
    /RISK_PROFILE/,
    /Revolut/i,
    /0\.15\s*BTC/i,
    /accumulate bias/i,
    /core wealth/i,
    /AKIA[0-9A-Z]{8,}/,
    /ghp_[A-Za-z0-9]{10,}/,
    /sk-[A-Za-z0-9]{10,}/,
    /-----BEGIN/,
    /\bpassword\b/i,
    /\$\d/,
    /\b\d+(?:\.\d+)?\s*(?:shares|bps|MW|GW)\b/i,
    /portfolio weight/i,
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  ];
  for (const file of sources) {
    const text = fs.readFileSync(file, "utf8");
    for (const pattern of banned) {
      assert.equal(pattern.test(text), false, `${path.relative(root, file)} matched ${pattern}`);
    }
  }
});

test("archive.json contains no holdings, allocation, trigger-price, or personal keys and never invents scout times", () => {
  const archivePath = path.join(root, "content", "archive.json");
  const archive = JSON.parse(fs.readFileSync(archivePath, "utf8"));
  const keys = collectKeys(archive);

  const forbiddenKeys = [
    "holdings",
    "position",
    "positions",
    "shares",
    "quantity",
    "allocation",
    "allocations",
    "weight",
    "weights",
    "costBasis",
    "fillPrice",
    "triggerPrice",
    "accountBalance",
    "ownerId",
    "email",
    "phone",
  ];
  for (const key of forbiddenKeys) {
    assert.equal(keys.has(key), false, `archive.json must not contain key "${key}"`);
  }

  for (const msg of archive.messages) {
    if (msg.type === "scout") {
      assert.equal(msg.sentAt, null, `${msg.id} must keep sentAt null when clock time was not recorded`);
    } else {
      assert.match(msg.sentAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/);
    }
  }
});

test("JS modules never use unsafe HTML injection, date-range pickers, or the old limited-sample banner", () => {
  const jsDir = path.join(root, "js");
  for (const entry of fs.readdirSync(jsDir)) {
    if (!entry.endsWith(".js")) continue;
    const code = fs.readFileSync(path.join(jsDir, entry), "utf8");
    assert.doesNotMatch(code, /innerHTML|insertAdjacentHTML|document\.write|eval\(/);
    assert.doesNotMatch(code, /Limited sample of research notes/i);
    assert.doesNotMatch(code, /type:\s*"date"/);
  }

  const app = fs.readFileSync(path.join(jsDir, "app.js"), "utf8");
  const notes = fs.readFileSync(path.join(jsDir, "notes.js"), "utf8");
  assert.match(app, /textContent/);
  assert.match(notes, /private notes store/);
  assert.match(app, /REMOTE_NOTICE/);
  assert.equal((app.match(/role: "tab"/g) || []).length, 1);

  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.match(html, /noindex/);
  assert.doesNotMatch(html, /type="date"/);
});

test("the future contract stays honest about review, access, and non-publication", () => {
  const contract = fs.readFileSync(path.join(root, "CONTRACT.md"), "utf8");
  assert.match(contract, /Cloudflare Access/);
  assert.match(contract, /Workers Static Assets/);
  assert.match(contract, /idempoten/i);
  assert.match(contract, /does not authorize/i);
  assert.match(contract, /not sent to your advisor/i);
  assert.match(contract, /Do not deploy/);
  assert.match(contract, /D1/);
  assert.doesNotMatch(contract, /wrangler\.toml/);
});
