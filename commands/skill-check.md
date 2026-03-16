---
description: Show all installed skills, their sources, structure issues, and available updates
argument-hint: [--fix] [--json] [--no-update]
allowed-tools: ["Bash", "Read", "Write", "Edit", "Glob", "Grep", "Agent"]
---

# Skill Check

Show the user everything they have installed and flag anything that needs attention.

## Step 1: Run the audit

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/index.js" check $ARGUMENTS
```

## Step 2: Present the results

The script outputs a markdown report. Present it to the user with these additions:

1. **Group skills by category** — look at each skill's name and description and group them (e.g. backend, frontend, blockchain, testing, devops, security, ai/ml, workflow, tooling, coding, etc.). Use your judgement.
2. **Show the full inventory** — every skill with its description, source, GitHub repo (user/repo short link), and token count. The Repo column is resolved automatically from plugin.json, skill-lock, or marketplace git remotes.
3. **Summarize structure issues** — don't list every "missing version" individually, just say "X skills missing version field" and list the ones with real problems (missing frontmatter, empty files)
4. **Show available updates** clearly

## Step 3: Fix Mode (only if --fix flag present)

If `$ARGUMENTS` contains `--fix`:

1. Run with `--json --fix`:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/index.js" check --json --fix $ARGUMENTS
   ```

2. Present the fix plan — what will be fixed, which files
3. Ask for confirmation
4. Apply fixes using the Edit tool:
   - **STRUCT-002**: Add minimal frontmatter (name, description placeholder, version)
   - **STRUCT-003**: Add name field from directory name
   - **STRUCT-005**: Add `version: 0.1.0`
5. Re-run audit to show before/after

## Protection Rules

- **Plugin/official skills**: NEVER modify. Report only. Suggest `claude plugin update <name>`.
- **User-created skills** (`~/.claude/skills/` non-symlink): CAN be fixed.
