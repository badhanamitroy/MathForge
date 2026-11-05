"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

const root = path.resolve(__dirname, "..");
const fontPath = path.join(root, "assets", "fonts", "NotoSansBengali-VF.ttf");
const font = fs.readFileSync(fontPath);

function fontTables(bytes) {
  const count = bytes.readUInt16BE(4);
  const tables = new Map();
  for (let i = 0; i < count; i++) {
    const record = 12 + i * 16;
    tables.set(bytes.toString("ascii", record, record + 4), {
      offset: bytes.readUInt32BE(record + 8),
      length: bytes.readUInt32BE(record + 12)
    });
  }
  return tables;
}

function nameEntries(bytes, table) {
  const base = table.offset;
  const count = bytes.readUInt16BE(base + 2);
  const storage = base + bytes.readUInt16BE(base + 4);
  const entries = [];
  for (let i = 0; i < count; i++) {
    const record = base + 6 + i * 12;
    const platform = bytes.readUInt16BE(record);
    const nameId = bytes.readUInt16BE(record + 6);
    const length = bytes.readUInt16BE(record + 8);
    const offset = storage + bytes.readUInt16BE(record + 10);
    const raw = bytes.subarray(offset, offset + length);
    const value = platform === 0 || platform === 3
      ? Array.from({ length: raw.length / 2 }, (_, n) => String.fromCharCode(raw.readUInt16BE(n * 2))).join("")
      : raw.toString("latin1");
    entries.push({ nameId, value });
  }
  return entries;
}

function fixed16(bytes, offset) {
  return bytes.readInt32BE(offset) / 65536;
}

test("bundled Noto Sans Bengali font is the pinned official variable font with expected metadata and axes", () => {
  assert.equal(font.toString("ascii", 0, 4), "\u0000\u0001\u0000\u0000");
  assert.equal(crypto.createHash("sha256").update(font).digest("hex").toUpperCase(),
    "DCD42978094E584A849C84A51450EEAC40C8826057D566EA6D4B9627A403A05A");
  const tables = fontTables(font);
  const names = nameEntries(font, tables.get("name"));
  const valueFor = (id) => names.filter((entry) => entry.nameId === id).map((entry) => entry.value).join(" ");
  assert.match(valueFor(1), /Noto Sans Bengali/);
  assert.match(valueFor(5), /Version 3\.011/);
  assert.match(valueFor(0), /Copyright 2025 The Noto Project Authors/);
  assert.match(valueFor(13), /SIL Open Font License, Version 1\.1/);

  const fvar = tables.get("fvar");
  assert.ok(fvar, "variable font axes must be present");
  const axisOffset = fvar.offset + font.readUInt16BE(fvar.offset + 4);
  const axisCount = font.readUInt16BE(fvar.offset + 8);
  const axisSize = font.readUInt16BE(fvar.offset + 10);
  const axes = new Map();
  for (let i = 0; i < axisCount; i++) {
    const offset = axisOffset + i * axisSize;
    axes.set(font.toString("ascii", offset, offset + 4), {
      min: fixed16(font, offset + 4),
      max: fixed16(font, offset + 12)
    });
  }
  assert.deepEqual(axes.get("wght"), { min: 100, max: 900 });
  assert.deepEqual(axes.get("wdth"), { min: 62.5, max: 100 });
});

test("Noto Sans Bengali license and source attribution are bundled with the local font", () => {
  const license = fs.readFileSync(path.join(root, "assets", "fonts", "OFL-NotoSansBengali.txt"), "utf8");
  const notice = fs.readFileSync(path.join(root, "assets", "fonts", "README.md"), "utf8");
  assert.match(license, /Copyright 2022 The Noto Project Authors/);
  assert.match(license, /SIL Open Font License, Version 1\.1/);
  assert.match(notice, /google\/fonts\/ofl\/notosansbengali/);
  assert.match(notice, /85d80394cbbbb798ca0a41c983902e6cf77be3a3/);
  assert.match(notice, /DCD42978094E584A849C84A51450EEAC40C8826057D566EA6D4B9627A403A05A/);
});

test("workspace and all standalone HTML entry points use the bundled Bengali font and no font CDN", () => {
  const htmlFiles = ["index.html", "Coordinates_graph.html", "Equation.html", "Ogiveline.html", "Polygonal.html"];
  for (const file of htmlFiles) {
    const html = fs.readFileSync(path.join(root, file), "utf8");
    assert.match(html, /assets\/css\/common\.css/, file);
    assert.doesNotMatch(html, /fonts\.googleapis\.com|fonts\.gstatic\.com/i, file);
  }
  const css = fs.readFileSync(path.join(root, "assets", "css", "common.css"), "utf8");
  assert.match(css, /font-family:\s*["']?Noto Sans Bengali["']?[\s\S]*?url\(["']?\.\.\/fonts\/NotoSansBengali-VF\.ttf/i);
  assert.doesNotMatch(css, /kalpurush\.ttf/i);
  const worker = fs.readFileSync(path.join(root, "service-worker.js"), "utf8");
  assert.match(worker, /"assets\/fonts\/NotoSansBengali-VF\.ttf"/);
  assert.doesNotMatch(worker, /kalpurush\.ttf/i);
});

test("shared typography retains English/math font and includes the Noto Bengali fallback", () => {
  const context = { window: {}, Promise };
  vm.runInNewContext(fs.readFileSync(path.join(root, "assets", "js", "core", "graph-typography.js"), "utf8"), context);
  const typography = context.window.MathForgeGraphTypography;
  assert.equal(typography.familyStack("Times New Roman"), '"Times New Roman", "Noto Sans Bengali", serif');
  assert.equal(typography.familyStack("Noto Sans Bengali"), '"Noto Sans Bengali", "Times New Roman", serif');
});
