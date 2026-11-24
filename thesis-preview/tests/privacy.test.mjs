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

const files = filesIn(root);
const sources = files.filter((file) => !file.endsWith(`${path.sep}tests${path.sep}privacy.test.mjs`));

test("the preview bundle has no notes content, secrets, or portfolio figures", () => {
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

test("research data does not invent sentAt values", () => {
  const data = fs.readFileSync(path.join(root, "js", "data.js"), "utf8");
  assert.doesNotMatch(data, /sentAt/);
  assert.doesNotMatch(data, /T\d{2}:\d{2}:\d{2}/);
});

test("notes render as text and the page is not a trading screen", () => {
  const app = fs.readFileSync(path.join(root, "js", "app.js"), "utf8");
  assert.doesNotMatch(app, /innerHTML|insertAdjacentHTML|document\.write|eval\(/);
  assert.match(app, /textContent/);
  assert.match(app, /Saved on this browser only/);
  assert.equal((app.match(/role: "tab"/g) || []).length, 1);
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.match(html, /noindex/);
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
