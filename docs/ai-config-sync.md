# AI Config Sync — `.claude` ↔ `.windsurf`

Guide for the two npm scripts that keep the AI-assistant configuration consistent:

| Command | Mode | What it does |
|---|---|---|
| `npm run sync:ai` | **write / fix** | Regenerates `.windsurf/` from `.claude/`. Run it after editing any rule, skill, or command. |
| `npm run check:ai-sync` | **check / verify** | Read-only. Exits with an error if `.windsurf/` is missing, stale, or has orphan files. Used by CI. |

Both wrap `scripts/sync-claude-windsurf.mjs` (the only logic; the npm scripts are just aliases).

---

## Why this exists (the concept)

This repo ships its AI rules twice: once for **Claude Code** (`.claude/`) and once for **Windsurf** (`.windsurf/`). They contain the same rules, skills, and commands.

Maintaining the same content in two places by hand is a **DRY violation** (Don't Repeat Yourself): the two trees inevitably drift, and you end up with contradictory rules — which is exactly the bug this mechanism was created to fix.

The fix applies the **Single Source of Truth (SSOT)** principle:

- **`.claude/` is canonical.** It is the *only* place you edit.
- **`.windsurf/` is generated.** It is treated like build output — never edited by hand.

This converts "two copies kept in sync manually" (fragile) into "one source + a deterministic generator" (safe). It is the same model as source code → compiled output: you change the source, you re-run the generator.

---

## The mapping (canonical → generated)

| `.claude/` (edit here) | `.windsurf/` (generated) |
|---|---|
| `rules/backend-nest.md` | `rules/backend-nest.md` |
| `skills/<NAME>/SKILL.md` | `skills/<NAME>/SKILL.md` |
| `commands/<NAME>.md` | `workflows/<NAME>.md` |

> Claude calls them **commands**; Windsurf calls them **workflows**. The generator renames the folder automatically.

### Content transform

Every generated file gets its internal path references rewritten so a Windsurf file never points back into `.claude/`:

```
".claude/commands/"  →  ".windsurf/workflows/"
".claude/"           →  ".windsurf/"
```

(Backslash/Windows-path variants are handled too.) This is why you must **never edit `.windsurf/` directly** — the next `npm run sync:ai` overwrites it.

`.claude/settings.json`, `.claude/settings.local.json`, and `.claude/agents/` are Claude-specific and intentionally **not** mirrored.

---

## When to run each

### `npm run sync:ai` — after editing AI config

Run it whenever you change anything under `.claude/rules/`, `.claude/skills/`, or `.claude/commands/`:

```bash
# 1. Edit the canonical file
#    e.g. .claude/skills/ARCHITECTURE-NEST-CRUD/SKILL.md
# 2. Regenerate the mirror
npm run sync:ai
# 3. Commit BOTH trees together
git add .claude .windsurf
git commit -m "docs: update CRUD architecture skill"
```

Sample output:

```
✓ Synced .windsurf from .claude (1 change(s)):
  - skills/ARCHITECTURE-NEST-CRUD/SKILL.md
```

### `npm run check:ai-sync` — to verify (CI / pre-commit)

Read-only. Fails loudly if the trees diverged (e.g. someone edited `.windsurf/` by hand or forgot to run `sync:ai`):

```
✗ .windsurf is OUT OF SYNC with .claude:

  STALE   : skills/ARCHITECTURE-NEST-CRUD/SKILL.md

Fix with:  npm run sync:ai
```

Failure categories:

- **`MISSING`** — a `.claude/` file has no `.windsurf/` counterpart yet.
- **`STALE`** — the `.windsurf/` file's content no longer matches the transformed canonical source.
- **`ORPHAN`** — a `.windsurf/` file exists with no `.claude/` source (a stray/deleted-on-canonical file). `sync:ai` deletes these.

---

## CI enforcement

`.github/workflows/ai-config-sync.yml` runs `check:ai-sync` on every push/PR that touches `.claude/**`, `.windsurf/**`, or the script. A PR that edits `.claude/` without re-running `sync:ai` fails the check — so the two trees **cannot drift again**.

Optional local guard (pre-commit hook):

```bash
# .git/hooks/pre-commit
npm run check:ai-sync || {
  echo "Run: npm run sync:ai"; exit 1;
}
```

---

## Golden rules

1. **Edit `.claude/` only.** `.windsurf/` is generated output.
2. **Run `npm run sync:ai`** after every AI-config change.
3. **Commit both trees** in the same commit.
4. **Never hand-edit `.windsurf/`** — it will be overwritten.
5. If CI says out of sync → `npm run sync:ai`, then commit.
