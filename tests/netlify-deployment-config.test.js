"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const config = fs.readFileSync(path.join(root, "netlify.toml"), "utf8");

test("Netlify static deployment uses the curated build and project-handler rewrite", () => {
  assert.match(config, /\[build\][\s\S]*?command\s*=\s*"node scripts\/prepare-vercel\.mjs"[\s\S]*?publish\s*=\s*"dist"/);
  assert.match(config, /\[\[redirects\]\][\s\S]*?from\s*=\s*"\/open-project"[\s\S]*?to\s*=\s*"\/index\.html"[\s\S]*?status\s*=\s*200/);
  assert.match(config, /for\s*=\s*"\/service-worker\.js"[\s\S]*?Cache-Control\s*=\s*"no-cache, no-store, must-revalidate"/);
  assert.match(config, /for\s*=\s*"\/manifest\.webmanifest"[\s\S]*?Cache-Control\s*=\s*"no-cache, must-revalidate"/);
});
