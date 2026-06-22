#!/usr/bin/env node
/**
 * i18n coverage checker + regression guard.
 *
 * Scans src/** for every static `t('key', 'default'?)` reference and reports which keys are missing
 * from the vi / ko locale files (those silently render the English inline default). Also flags
 * hardcoded user-facing strings (alert/confirm/placeholder/title/aria) that never go through t().
 *
 * Usage:
 *   node scripts/check-i18n.js            human report; exits 1 if any gaps (use as a pre-release guard)
 *   node scripts/check-i18n.js --json     emit { missingByLocale, hardcoded } as JSON (for tooling)
 *
 * Resolution note: i18next v23 has ignoreJSONStructure:true, so a flat-dotted key like
 * "modelManagement.title" resolves the same as a nested one — coverage is checked by flattening each
 * namespace object to dotted keys and testing membership.
 */
const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '..', 'src');
const LOCALES = path.join(SRC, 'i18n', 'locales');
const LANGS = ['en', 'vi', 'ko'];

const CODE_EXT = new Set(['.js', '.jsx', '.ts', '.tsx']);
const isSkippedFile = (p) => /\.test\.|\.spec\.|LiquidGlassDemo\./.test(p);
const isSkippedDir = (p) => /[\\/](node_modules|build|dist|__tests__|__mocks__)[\\/]/.test(p + path.sep);

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!isSkippedDir(p)) walk(p, out); }
    else if (CODE_EXT.has(path.extname(e.name)) && !isSkippedFile(p)) out.push(p);
  }
  return out;
}

// Flatten a namespace object to dotted keys (covers both nested {a:{b}} and flat "a.b" keys).
const flat = (o, pfx = '') =>
  Object.entries(o || {}).flatMap(([k, v]) =>
    v && typeof v === 'object' && !Array.isArray(v) ? flat(v, pfx + k + '.') : [[pfx + k, v]]);

function loadLocale(lang) {
  const dir = path.join(LOCALES, lang);
  const ns = {};
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    ns[f.replace('.json', '')] = new Map(flat(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))));
  }
  return ns;
}

// Capture `t('key')` / `t('key', 'default')` / `i18n.t(...)`. Quote-aware bodies so a default may contain
// the other quote type (e.g. 'Enable "X"…') or escaped quotes without truncating. Template-interpolated
// keys still slip through here but are dropped downstream by the `[^a-zA-Z0-9_.]` key filter.
const T_RE = /\bt\(\s*(['"`])((?:\\.|(?!\1).)*?)\1\s*(?:,\s*(['"`])((?:\\.|(?!\3).)*?)\3)?/g;

function collectKeys(files) {
  const keys = new Map(); // key -> englishDefault (from the first inline default seen, if any)
  for (const f of files) {
    const txt = fs.readFileSync(f, 'utf8');
    let m;
    while ((m = T_RE.exec(txt))) {
      const key = m[2];
      const def = m[4];
      if (!key.includes('.') || /[^a-zA-Z0-9_.]/.test(key)) continue; // namespaced static keys only
      if (!keys.has(key) || (def && !keys.get(key))) keys.set(key, def || keys.get(key) || null);
    }
  }
  return keys;
}

// Conservative hardcoded-string detection for the guard (clear, low-false-positive cases).
const VN = 'àáảãạăằắẳẵặâầấẩẫậđèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ';
function collectHardcoded(files) {
  const hits = [];
  const reAlert = /\b(?:alert|confirm)\(\s*[`'"][^`'"]*[A-Za-z]{3,}/;
  // Prose placeholder only: literal value with a space (skips kebab/identifier examples like "my-custom-tts-model").
  const rePlaceholder = /placeholder\s*=\s*[`'"]([^`'"]*[A-Za-z][^`'"]* [^`'"]*|[^`'"]* [^`'"]*[A-Za-z][^`'"]*)[`'"]/;
  const reVnAttr = new RegExp('(?:title|aria-label|placeholder)\\s*=\\s*[`\'"][^`\'"]*[' + VN + ']', 'i');
  for (const f of files) {
    const rel = path.relative(path.resolve(__dirname, '..'), f).replace(/\\/g, '/');
    fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((line, i) => {
      let kind = null;
      if (reAlert.test(line)) kind = 'alert/confirm';
      else if (reVnAttr.test(line)) kind = 'non-English in attr (lang mismatch)';
      else if (rePlaceholder.test(line)) kind = 'placeholder';
      if (kind) hits.push({ file: rel, line: i + 1, kind, text: line.trim().slice(0, 110) });
    });
  }
  return hits;
}

function resolves(loc, key) {
  const i = key.indexOf('.');
  const ns = key.slice(0, i), sub = key.slice(i + 1);
  return loc[ns] && loc[ns].has(sub);
}

function main() {
  const files = walk(SRC);
  const keys = collectKeys(files);
  const locales = Object.fromEntries(LANGS.map((l) => [l, loadLocale(l)]));
  const en = locales.en;

  const missingByLocale = { vi: [], ko: [] };
  for (const [key, inlineDef] of keys) {
    const ns = key.slice(0, key.indexOf('.')), sub = key.slice(key.indexOf('.') + 1);
    const enVal = en[ns] && en[ns].get(sub);
    const english = inlineDef || enVal || null;
    for (const loc of ['vi', 'ko']) {
      if (!resolves(locales[loc], key)) missingByLocale[loc].push({ key, ns, sub, english });
    }
  }
  const hardcoded = collectHardcoded(files);

  if (process.argv.includes('--json')) {
    process.stdout.write(JSON.stringify({ missingByLocale, hardcoded }, null, 2));
    return;
  }

  const byNs = (arr) => {
    const m = {};
    for (const x of arr) m[x.ns] = (m[x.ns] || 0) + 1;
    return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([n, c]) => `${n}:${c}`).join('  ');
  };
  console.log(`i18n coverage — ${keys.size} unique static t() keys referenced in src/`);
  console.log(`  vi missing: ${missingByLocale.vi.length}` + (missingByLocale.vi.length ? `   [${byNs(missingByLocale.vi)}]` : ''));
  console.log(`  ko missing: ${missingByLocale.ko.length}` + (missingByLocale.ko.length ? `   [${byNs(missingByLocale.ko)}]` : ''));
  console.log(`  hardcoded user strings: ${hardcoded.length}`);
  for (const h of hardcoded.slice(0, 30)) console.log(`    ${h.file}:${h.line}  (${h.kind})  ${h.text}`);

  const gaps = missingByLocale.vi.length + missingByLocale.ko.length + hardcoded.length;
  if (gaps) { console.error(`\n✗ ${gaps} i18n gap(s) found.`); process.exit(1); }
  console.log('\n✓ i18n clean: every t() key is covered in vi+ko and no hardcoded user strings.');
}

main();
