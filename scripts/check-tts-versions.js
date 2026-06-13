#!/usr/bin/env node
/**
 * check-tts-versions.js
 *
 * Reports the currently pinned TTS engine versions (parsed from setup-narration.js) against the
 * latest available upstream refs, so re-locking to a newer known-good version is a routine step.
 *
 * Usage:
 *   node scripts/check-tts-versions.js
 *
 * It only READS upstream metadata via `git ls-remote` (no clones, no installs) and never modifies
 * anything. When something is out of date it prints the exact constant to edit in setup-narration.js.
 * After updating a pin, run `npm run setup:narration:uv` to rebuild + verify, then commit.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SETUP_FILE = path.join(__dirname, '..', 'setup-narration.js');

// Each engine declares how to find its current pin in setup-narration.js and how to resolve the
// latest upstream ref. `kind: 'tag'` picks the highest semver-looking tag; `kind: 'head'` reports
// the default-branch HEAD commit (for repos that don't tag releases reliably).
const ENGINES = [
  {
    name: 'F5-TTS',
    repo: 'https://github.com/SWivid/F5-TTS.git',
    constant: 'F5_TTS_REF',
    kind: 'tag',
  },
  {
    name: 'Chatterbox',
    repo: 'https://github.com/resemble-ai/chatterbox.git',
    constant: 'CHATTERBOX_REF',
    // Track release tags only. HEAD pulls an unpinned resemble-perth git@master and fails to build,
    // so we never want "latest commit" suggestions here -- only genuine new releases.
    kind: 'tag',
  },
  {
    name: 'ChromeCookieUnlock (yt-dlp plugin)',
    repo: 'https://github.com/seproDev/yt-dlp-ChromeCookieUnlock.git',
    constant: 'YTDLP_COOKIE_PLUGIN_REF',
    kind: 'head',
  },
];

function readCurrentPin(constant) {
  const src = fs.readFileSync(SETUP_FILE, 'utf8');
  // Matches: const NAME = process.env.NAME || 'value';
  const re = new RegExp(`${constant}\\s*=\\s*process\\.env\\.${constant}\\s*\\|\\|\\s*['"]([^'"]+)['"]`);
  const match = src.match(re);
  return match ? match[1] : null;
}

function semverKey(tag) {
  // Turn "1.1.20" / "v0.1.2" into a comparable numeric tuple; non-semver tags sort last.
  const cleaned = tag.replace(/^v/, '');
  const parts = cleaned.split('.').map(Number);
  if (parts.some(Number.isNaN)) return null;
  return parts;
}

function compareSemver(a, b) {
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i++) {
    const diff = (a[i] || 0) - (b[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function latestTag(repo) {
  const out = execSync(`git ls-remote --tags --refs ${repo}`, { encoding: 'utf8' });
  const tags = out
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => line.replace(/^[0-9a-f]+\s+refs\/tags\//, ''))
    .map(tag => ({ tag, key: semverKey(tag) }))
    .filter(t => t.key);
  if (tags.length === 0) return null;
  tags.sort((a, b) => compareSemver(a.key, b.key));
  return tags[tags.length - 1].tag;
}

function headCommit(repo) {
  const out = execSync(`git ls-remote ${repo} HEAD`, { encoding: 'utf8' }).trim();
  return out.split(/\s+/)[0] || null;
}

// Decide whether a pin is current. Tags are compared SEMANTICALLY (so '1.1.2' is NOT treated as
// equal to '1.1.20' just because it's a textual prefix); HEAD commit SHAs use prefix matching
// because pins may be abbreviated.
function isUpToDate(kind, current, latest) {
  if (!latest || !current) return false;
  if (latest === current) return true;
  if (kind === 'tag') {
    const a = semverKey(current);
    const b = semverKey(latest);
    if (a && b) return compareSemver(a, b) >= 0; // pin at or ahead of the highest upstream tag
    return false; // non-semver tag: only an exact match (handled above) counts as up to date
  }
  return latest.startsWith(current) || current.startsWith(latest);
}

function main() {
  console.log('Checking pinned TTS engine versions against upstream...\n');
  let anyStale = false;

  let anyError = false;
  for (const engine of ENGINES) {
    const current = readCurrentPin(engine.constant);
    let latest = null;
    try {
      latest = engine.kind === 'tag' ? latestTag(engine.repo) : headCommit(engine.repo);
    } catch (err) {
      console.log(`  ${engine.name}: could not reach upstream (${err.message.split('\n')[0]})`);
      anyError = true;
      continue;
    }

    // A missing pin is a PARSE problem (constant renamed/reformatted), not a stale pin -- don't
    // emit a misleading "bump to latest" instruction for it.
    if (!current) {
      console.log(`  ${engine.name} [CANNOT PARSE PIN]`);
      console.log(`      could not find ${engine.constant} in setup-narration.js`);
      console.log(`      latest upstream:            ${latest || '(unknown)'}`);
      console.log('');
      anyError = true;
      continue;
    }

    const upToDate = isUpToDate(engine.kind, current, latest);
    const status = upToDate ? 'up to date' : 'UPDATE AVAILABLE';
    console.log(`  ${engine.name} [${status}]`);
    console.log(`      pinned (${engine.constant}): ${current}`);
    console.log(`      latest upstream:            ${latest || '(unknown)'}`);
    if (!upToDate && latest) {
      anyStale = true;
      console.log(`      -> to bump: set ${engine.constant} default to '${latest}' in setup-narration.js`);
    }
    console.log('');
  }

  if (anyStale) {
    console.log('One or more pins are behind upstream.');
    console.log('After editing a pin: run `npm run setup:narration:uv` to rebuild + verify, then commit the change.');
    process.exitCode = 1;
  } else if (anyError) {
    console.log('Could not determine freshness for one or more engines (see above).');
    process.exitCode = 1;
  } else {
    console.log('All pins are up to date.');
  }
}

main();
