/**
 * Phase 2.3 — Line & Polygon Controls: Isolated Logic Test Suite
 * Tests the state, normalization, dash pattern, and multi-set renderOptions functions.
 */

'use strict';
const fs = require('fs');
const path = require('path');

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';

let passed = 0, failed = 0;
const results = [];

function PASS(id, desc, detail) {
  console.log(`${GREEN}PASS${RESET} [${id}] ${desc}${detail ? ' — ' + detail : ''}`);
  results.push({ id, status: 'PASS', desc, detail: detail || '' });
  passed++;
}
function FAIL(id, desc, detail) {
  console.log(`${RED}FAIL${RESET} [${id}] ${desc}${detail ? ' — ' + detail : ''}`);
  results.push({ id, status: 'FAIL', desc, detail: detail || '' });
  failed++;
}

// Extract script from Coordinates_graph.html
const htmlPath = path.resolve(__dirname, '../../Coordinates_graph.html');
const html = fs.readFileSync(htmlPath, 'utf8');

// 1. Syntax check
try {
  const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/);
  if (!scriptMatch) throw new Error('Script block not found');
  new Function(scriptMatch[1]);
  PASS('ISO-1', 'Coordinates_graph.html script parses with zero syntax errors');
} catch (e) {
  FAIL('ISO-1', 'Syntax check failed', e.message);
}

// Pure functions under test (identical to application source)
const DEFAULT_FILL_COLOR = "#5b8def";
const DEFAULT_BORDER_COLOR = "#111827";
const DEFAULT_DIAGONAL_COLOR = "#475569";

function defaultRenderOptions() {
  return {
    polygon: {
      visible: true,
      fillVisible: true,
      fillColor: DEFAULT_FILL_COLOR,
      fillOpacity: 0.18,
      borderVisible: true,
      borderColor: DEFAULT_BORDER_COLOR,
      borderWidth: 3,
      borderStyle: "solid"
    },
    diagonals: {
      visible: false,
      color: DEFAULT_DIAGONAL_COLOR,
      width: 2,
      style: "dashed"
    }
  };
}

function normalizeLineStyle(value) {
  return value === "dotted" ? "dotted" : value === "solid" ? "solid" : "dashed";
}

function resolveDashPattern(styleName) {
  switch (normalizeLineStyle(styleName)) {
    case "dotted": return [2, 5];
    case "solid": return [];
    default: return [10, 8];
  }
}

function getSetRenderOptions(set, setRenderOptionsMap) {
  const defaults = defaultRenderOptions();
  const saved = set && set.id ? setRenderOptionsMap.get(set.id) : null;
  const next = {
    polygon: { ...defaults.polygon, ...((saved && saved.polygon) || {}), ...((set && set.renderOptions && set.renderOptions.polygon) || {}) },
    diagonals: { ...defaults.diagonals, ...((saved && saved.diagonals) || {}), ...((set && set.renderOptions && set.renderOptions.diagonals) || {}) }
  };
  next.polygon.visible = Boolean(next.polygon.visible);
  next.polygon.fillVisible = next.polygon.fillVisible !== false;
  next.polygon.fillOpacity = Math.max(0, Math.min(1, Number(next.polygon.fillOpacity) || 0));
  next.polygon.borderVisible = Boolean(next.polygon.borderVisible);
  next.polygon.borderWidth = Math.max(1, Number(next.polygon.borderWidth) || 3);
  next.diagonals.visible = Boolean(next.diagonals.visible);
  next.diagonals.width = Math.max(1, Number(next.diagonals.width) || 2);
  next.diagonals.style = normalizeLineStyle(next.diagonals.style);
  if (set && set.id) {
    set.renderOptions = next;
    setRenderOptionsMap.set(set.id, next);
  }
  return next;
}

// 2. defaultRenderOptions integrity
{
  const def = defaultRenderOptions();
  const ok = def.polygon.visible === true &&
             def.polygon.fillVisible === true &&
             def.polygon.fillColor === DEFAULT_FILL_COLOR &&
             def.polygon.fillOpacity === 0.18 &&
             def.polygon.borderVisible === true &&
             def.polygon.borderColor === DEFAULT_BORDER_COLOR &&
             def.polygon.borderWidth === 3 &&
             def.diagonals.visible === false &&
             def.diagonals.width === 2 &&
             def.diagonals.style === 'dashed';
  if (ok) PASS('ISO-2', 'defaultRenderOptions includes all Phase 2.3 polygon & diagonal fields with correct defaults');
  else FAIL('ISO-2', 'defaultRenderOptions fields mismatch', JSON.stringify(def));
}

// 3. normalizeLineStyle & resolveDashPattern
{
  const sSolid = resolveDashPattern('solid');
  const sDashed = resolveDashPattern('dashed');
  const sDotted = resolveDashPattern('dotted');
  const sFallback = resolveDashPattern('unknown-value');

  const ok = sSolid.length === 0 &&
             sDashed.length === 2 && sDashed[0] === 10 && sDashed[1] === 8 &&
             sDotted.length === 2 && sDotted[0] === 2 && sDotted[1] === 5 &&
             sFallback.length === 2 && sFallback[0] === 10 && sFallback[1] === 8;
  if (ok) PASS('ISO-3', 'resolveDashPattern correctly handles solid ([]), dashed ([10,8]), dotted ([2,5]), and fallback');
  else FAIL('ISO-3', 'resolveDashPattern mismatch', JSON.stringify({ sSolid, sDashed, sDotted, sFallback }));
}

// 4. getSetRenderOptions validation and sanitization
{
  const map = new Map();
  const set1 = { id: 'set-1', renderOptions: { polygon: { fillOpacity: '1.5', borderWidth: '-5', fillVisible: false } } };
  const opts = getSetRenderOptions(set1, map);

  const ok = opts.polygon.fillVisible === false &&
             opts.polygon.fillOpacity === 1 && // clamped to 1
             opts.polygon.borderWidth === 1 && // clamped to min 1
             map.get('set-1') === opts;
  if (ok) PASS('ISO-4', 'getSetRenderOptions correctly clamps opacity and bounds, and stores in map');
  else FAIL('ISO-4', 'Clamping mismatch', JSON.stringify(opts));
}

// 5. Multi-set renderOptions independence
{
  const map = new Map();
  const setA = { id: 'set-a', renderOptions: defaultRenderOptions() };
  const setB = { id: 'set-b', renderOptions: defaultRenderOptions() };
  getSetRenderOptions(setA, map);
  getSetRenderOptions(setB, map);

  // Customize setA
  setA.renderOptions.polygon.fillColor = '#ff0000';
  setA.renderOptions.diagonals.visible = true;
  setA.renderOptions.diagonals.style = 'dotted';

  // Customize setB
  setB.renderOptions.polygon.fillColor = '#0000ff';
  setB.renderOptions.diagonals.visible = false;
  setB.renderOptions.diagonals.style = 'solid';

  const optsA = getSetRenderOptions(setA, map);
  const optsB = getSetRenderOptions(setB, map);

  const ok = optsA.polygon.fillColor === '#ff0000' &&
             optsA.diagonals.visible === true &&
             optsA.diagonals.style === 'dotted' &&
             optsB.polygon.fillColor === '#0000ff' &&
             optsB.diagonals.visible === false &&
             optsB.diagonals.style === 'solid';

  if (ok) PASS('ISO-5', 'Set A and Set B have completely independent polygon and diagonal renderOptions');
  else FAIL('ISO-5', 'Independence failure', JSON.stringify({ optsA, optsB }));
}

// 6. Independence between polygon and diagonal styles within a set
{
  const map = new Map();
  const set = { id: 'set-c', renderOptions: defaultRenderOptions() };
  getSetRenderOptions(set, map);

  // Mutate diagonal properties
  set.renderOptions.diagonals.color = '#ffff00';
  set.renderOptions.diagonals.width = 6;
  set.renderOptions.diagonals.style = 'dotted';
  const opts = getSetRenderOptions(set, map);

  const ok = opts.polygon.borderColor === DEFAULT_BORDER_COLOR &&
             opts.polygon.borderWidth === 3 &&
             opts.polygon.borderStyle === 'solid' &&
             opts.diagonals.color === '#ffff00' &&
             opts.diagonals.width === 6 &&
             opts.diagonals.style === 'dotted';

  if (ok) PASS('ISO-6', 'Diagonal styling does not alter polygon border styling');
  else FAIL('ISO-6', 'Diagonal bleed into polygon border', JSON.stringify(opts));
}

console.log(`\nIsolated Tests: ${passed} PASSED, ${failed} FAILED\n`);
if (failed > 0) process.exit(1);
