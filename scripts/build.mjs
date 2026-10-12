#!/usr/bin/env node
// ACHA Card — dependency-free bundler.
// Concatenates src/*.js in the documented order, strips the single-line relative imports and the
// `export ` keyword, validates the module graph, wraps everything in an IIFE and writes dist/acha-card.js.
//
//   node scripts/build.mjs           build + node --check of the bundle
//   node scripts/build.mjs --check   also node --check every source file first
//   node scripts/build.mjs --quiet   less output
//
// Fails loudly (exit 1) on: missing file, leftover import/export, an import of a name the target file
// does not export, an import of a file that is bundled later, duplicate top-level identifiers.

import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, renameSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const OUT = join(ROOT, 'dist', 'acha-card.js');
const ORDER = [
  'utils.js',
  'i18n.js',
  'profiles.js',
  'styles.js',
  'dial.js',
  'unit.js',
  'sheet.js',
  'panel.js',
  'editor.js',
  'acha-card.js',
];

const args = new Set(process.argv.slice(2));
const QUIET = args.has('--quiet');
const CHECK_SRC = args.has('--check');

const IMPORT_RE = /^\s*import\s*\{([^}]*)\}\s*from\s*['"]\.\/([\w.-]+\.js)['"]\s*;?\s*$/;
const EXPORT_RE = /^export\s+((?:async\s+)?function\*?|const|let|class)\s+([A-Za-z_$][\w$]*)/;
const TOP_DECL_RE = /^(?:async\s+)?(?:function\*?|const|let|var|class)\s+([A-Za-z_$][\w$]*)/;

const errors = [];
const log = (...a) => {
  if (!QUIET) console.log(...a);
};
const fail = (msg) => errors.push(msg);

function nodeCheck(file) {
  execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
}

// ------------------------------------------------------------------ read + parse every module
const modules = [];
for (const name of ORDER) {
  const path = join(SRC, name);
  if (!existsSync(path)) {
    fail(`missing source file src/${name}`);
    continue;
  }
  if (CHECK_SRC) {
    try {
      nodeCheck(path);
    } catch (e) {
      fail(`node --check failed for src/${name}:\n${String(e.stderr || e.message)}`);
    }
  }
  const text = readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
  const lines = text.split('\n');
  const imports = []; // { names, from, line }
  const exports = new Set();
  const decls = []; // { id, line }
  const body = [];
  lines.forEach((line, i) => {
    const im = line.match(IMPORT_RE);
    if (im) {
      const names = im[1]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      for (const n of names) {
        if (/\sas\s/.test(n)) fail(`src/${name}:${i + 1}: aliased import "${n}" is not supported by the bundler`);
      }
      imports.push({ names, from: im[2], line: i + 1 });
      return; // strip
    }
    const ex = line.match(EXPORT_RE);
    if (ex) {
      exports.add(ex[2]);
      decls.push({ id: ex[2], line: i + 1 });
      body.push(line.replace(/^export\s+/, ''));
      return;
    }
    const d = line.match(TOP_DECL_RE);
    if (d) decls.push({ id: d[1], line: i + 1 });
    body.push(line);
  });
  modules.push({ name, path, imports, exports, decls, body: body.join('\n') });
}

// ------------------------------------------------------------------ validate
const byName = new Map(modules.map((m) => [m.name, m]));
for (const m of modules) {
  // leftovers the bundler would silently break on
  m.body.split('\n').forEach((line, i) => {
    if (/^\s*import\b(?!\s*\()/.test(line) || /^\s*import\s*\(/.test(line)) fail(`src/${m.name}: leftover import → "${line.trim()}"`);
    if (/^\s*export\b/.test(line)) fail(`src/${m.name}: leftover export (only "export const|function|class" allowed) → "${line.trim()}"`);
  });
  if (/\bimport\s*\(\s*['"`]/.test(m.body)) fail(`src/${m.name}: dynamic import() is not allowed`);
  if (/\bimport\.meta\b/.test(m.body)) fail(`src/${m.name}: import.meta is not allowed`);
  for (const im of m.imports) {
    const target = byName.get(im.from);
    if (!target) {
      if (ORDER.includes(im.from)) continue; // already reported as missing
      fail(`src/${m.name}:${im.line}: imports unknown file ./${im.from}`);
      continue;
    }
    if (ORDER.indexOf(im.from) > ORDER.indexOf(m.name)) {
      fail(`src/${m.name}:${im.line}: imports ./${im.from}, which is bundled AFTER it (bundle order: ${ORDER.join(', ')})`);
    }
    for (const n of im.names) {
      if (!target.exports.has(n)) fail(`src/${m.name}:${im.line}: "${n}" is not exported by ./${im.from}`);
    }
  }
}
const seen = new Map();
for (const m of modules) {
  for (const d of m.decls) {
    const prev = seen.get(d.id);
    if (prev) fail(`duplicate top-level identifier "${d.id}" in src/${m.name}:${d.line} (also src/${prev.file}:${prev.line})`);
    else seen.set(d.id, { file: m.name, line: d.line });
  }
}

if (errors.length) {
  console.error('\n✖ ACHA build failed:\n  - ' + errors.join('\n  - ') + '\n');
  process.exit(1);
}

// ------------------------------------------------------------------ emit
let version = '0.0.0';
const card = byName.get('acha-card.js');
const vm = card && card.body.match(/ACHA_CARD_VERSION\s*=\s*['"]([^'"]+)['"]/);
if (vm) version = vm[1];
else {
  try {
    version = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version || version;
  } catch (e) {
    /* keep default */
  }
}

const banner = `/*! ACHA Climate Card v${version} | custom:acha-card for Home Assistant | MIT | built ${new Date().toISOString()} */`;
const parts = modules.map((m) => `// ===== src/${m.name} =====\n${m.body.trim()}\n`);
const bundle = `${banner}\n(function () {\n'use strict';\n\n${parts.join('\n')}\n})();\n`;

// Write to a temp file and check it first: a failed build must never replace the last good dist (HACS serves it).
mkdirSync(dirname(OUT), { recursive: true });
const TMP = OUT.replace(/\.js$/, '.tmp.js'); // keep .js so node --check knows the format
writeFileSync(TMP, bundle);

try {
  nodeCheck(TMP);
} catch (e) {
  rmSync(TMP, { force: true });
  console.error(`✖ node --check failed for the bundle (dist/acha-card.js left untouched):\n${String(e.stderr || e.message)}`);
  process.exit(1);
}
renameSync(TMP, OUT);

const kb = (statSync(OUT).size / 1024).toFixed(1);
log(`✔ dist/acha-card.js v${version} — ${modules.length} modules, ${seen.size} top-level names, ${kb} KiB (node --check ok)`);
