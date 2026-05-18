#!/usr/bin/env node
/**
 * sync-claude-windsurf.mjs
 *
 * Keeps `.windsurf/` a deterministic mirror of `.claude/` so the two AI-config
 * trees can never drift again.
 *
 *   `.claude/` is the SINGLE canonical source. `.windsurf/` is generated.
 *
 * Mapping (canonical → mirror):
 *   .claude/rules/backend-nest.md   → .windsurf/rules/backend-nest.md
 *   .claude/skills/<X>/SKILL.md     → .windsurf/skills/<X>/SKILL.md
 *   .claude/commands/<X>.md         → .windsurf/workflows/<X>.md
 *
 * Content transform applied to every mirrored file:
 *   ".claude/commands/" → ".windsurf/workflows/"
 *   ".claude/"          → ".windsurf/"
 *   ".claude\commands\" → ".windsurf\workflows\"   (Windows-style paths)
 *   ".claude\"          → ".windsurf\"
 *
 * Modes:
 *   (default)   check  — exit 1 if the mirror is missing/stale/has orphans
 *   --write     fix    — regenerate the mirror from the canonical source
 *
 * Usage:
 *   node scripts/sync-claude-windsurf.mjs            # check (CI)
 *   node scripts/sync-claude-windsurf.mjs --write    # auto-fix locally
 */

import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CLAUDE = join(ROOT, '.claude');
const WINDSURF = join(ROOT, '.windsurf');
const WRITE = process.argv.includes('--write');

/** @returns {string} content rewritten for the .windsurf tree */
function transform(content) {
  return content
    .replaceAll('.claude/commands/', '.windsurf/workflows/')
    .replaceAll('.claude/', '.windsurf/')
    .replaceAll('.claude\\commands\\', '.windsurf\\workflows\\')
    .replaceAll('.claude\\', '.windsurf\\');
}

/** Collect canonical source files and their mirror destinations. */
function plan() {
  /** @type {{src:string,dst:string,rel:string}[]} */
  const entries = [];

  const rule = join(CLAUDE, 'rules', 'backend-nest.md');
  if (existsSync(rule)) {
    entries.push({ src: rule, dst: join(WINDSURF, 'rules', 'backend-nest.md'), rel: 'rules/backend-nest.md' });
  }

  const skillsDir = join(CLAUDE, 'skills');
  if (existsSync(skillsDir)) {
    for (const name of readdirSync(skillsDir)) {
      const src = join(skillsDir, name, 'SKILL.md');
      if (existsSync(src) && statSync(src).isFile()) {
        entries.push({ src, dst: join(WINDSURF, 'skills', name, 'SKILL.md'), rel: `skills/${name}/SKILL.md` });
      }
    }
  }

  const commandsDir = join(CLAUDE, 'commands');
  if (existsSync(commandsDir)) {
    for (const name of readdirSync(commandsDir)) {
      if (!name.endsWith('.md')) continue;
      entries.push({
        src: join(commandsDir, name),
        dst: join(WINDSURF, 'workflows', name),
        rel: `commands/${name} → workflows/${name}`,
      });
    }
  }
  return entries;
}

/** Managed mirror files that must have a canonical source (else they are orphans). */
function mirrorManagedFiles() {
  const files = [];
  const walk = (base, sub) => {
    const dir = join(base, sub);
    if (!existsSync(dir)) return;
    for (const name of readdirSync(dir)) {
      const abs = join(dir, name);
      if (statSync(abs).isDirectory()) walk(base, join(sub, name));
      else if (name.endsWith('.md')) files.push(abs);
    }
  };
  walk(WINDSURF, 'rules');
  walk(WINDSURF, 'skills');
  walk(WINDSURF, 'workflows');
  return files;
}

const entries = plan();
const expectedDst = new Set(entries.map((e) => e.dst));
const drift = [];
const fixed = [];

for (const { src, dst, rel } of entries) {
  const expected = transform(readFileSync(src, 'utf8'));
  const actual = existsSync(dst) ? readFileSync(dst, 'utf8') : null;
  if (actual === expected) continue;

  if (WRITE) {
    mkdirSync(dirname(dst), { recursive: true });
    writeFileSync(dst, expected);
    fixed.push(rel);
  } else {
    drift.push(actual === null ? `MISSING : ${rel}` : `STALE   : ${rel}`);
  }
}

for (const orphan of mirrorManagedFiles()) {
  if (expectedDst.has(orphan)) continue;
  const relOrphan = relative(ROOT, orphan);
  if (WRITE) {
    rmSync(orphan);
    fixed.push(`removed orphan ${relOrphan}`);
  } else {
    drift.push(`ORPHAN  : ${relOrphan} (no canonical source in .claude/)`);
  }
}

if (WRITE) {
  if (fixed.length === 0) {
    console.log('✓ .windsurf already in sync with .claude — nothing to write.');
  } else {
    console.log(`✓ Synced .windsurf from .claude (${fixed.length} change(s)):`);
    for (const f of fixed) console.log(`  - ${f}`);
  }
  process.exit(0);
}

if (drift.length === 0) {
  console.log(`✓ .windsurf is in sync with .claude (${entries.length} file(s) checked).`);
  process.exit(0);
}

console.error('✗ .windsurf is OUT OF SYNC with .claude:\n');
for (const d of drift) console.error(`  ${d}`);
console.error('\nFix with:  npm run sync:ai');
process.exit(1);
