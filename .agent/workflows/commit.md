---
description: Create a git commit for staged changes only, strictly adhering to Conventional Commits and project invariants.
argument-hint: "[optional commit message]"
---

Automate git commits following the repository's Conventional Commits standard and `AGENTS.md` invariants.

## Step 1 — Check Staged Area

Check what is currently staged:

```bash
git diff --cached --name-only
```

- **If the output is empty:**
  Stop immediately. Inform the user in English:
  > "⚠️ **No changes in the staged area.** Stage your intended files first using `git add <files>` before committing."
  Do **NOT** stage any files automatically. Do **NOT** commit. End turn.

## Step 2 — Verify Project Invariants (`AGENTS.md`)

Before committing, check the staged diff:

```bash
git diff --cached -U0
```

## Step 3 — Determine the Commit Message

### Case A: The user passed a message in `$ARGUMENTS` (e.g. `/commit "feat(engine): add scc"`)
Validate that it strictly follows Conventional Commits:
- **Format:** `<type>(<scope>): <description>` or `<type>: <description>`
- **Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`
- **Rules:** English only, imperative mood, lowercase description, no period at the end, first line <= 72 characters.
- If it deviates from the convention, format it cleanly in English and proceed.

### Case B: No argument was passed (`$ARGUMENTS` is empty)
Infer the best type, scope, and concise English description by inspecting the staged files:
- Only docs/markdown (`SPEC.md`, `README*`, `docs/*`) -> `docs(spec): ...` or `docs: ...`
- Pure tests (`*.test.ts`, `__tests__/*`) -> `test(engine): ...`
- Engine routing (`src/engine/*`) -> `feat(engine): ...` or `fix(engine): ...`
- Map bridge / UI (`src/map-bridge/*`, `src/components/*`, `src/ui/*`) -> `feat(ui): ...` or `fix(ui): ...`
- Scripts & pipeline (`tools/*`) -> `chore(tools): ...` or `feat(tools): ...`

## Step 4 — Execute Commit

Commit **ONLY** the staged files:

```bash
git commit -m "<validated conventional commit message>"
```

## Step 5 — Report Output

Report the result strictly in English:
- Commit hash and branch.
- Formatted commit message.
- Summary of committed files.
- Mention any remaining unstaged/untracked files if present.
