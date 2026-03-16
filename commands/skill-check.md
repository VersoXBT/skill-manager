---
description: Audit all installed skills for quality, freshness, conflicts, and updates
argument-hint: [--fix] [--verbose] [--deep] [--json] [--no-update]
allowed-tools: ["Bash", "Read", "Write", "Edit", "Glob", "Grep", "Agent"]
---

# Skill Check

Run a comprehensive audit of all installed Claude Code skills.

## Step 1: Run Full Audit

Execute the skill-manager analysis engine:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/index.js" check $ARGUMENTS
```

Parse and present the output. The report includes:
- Health score (0-100) with letter grade
- Findings grouped by severity
- Updates available for plugins and standalone skills
- Token budget overview

## Step 2: Deep Analysis (only if --deep flag present)

If `$ARGUMENTS` contains `--deep`:

1. Re-run with `--json` to get structured data
2. For each skill with critical/high findings, dispatch the `skill-analyzer` agent
3. Present deep analysis alongside the Tier 1 report

Before starting, inform the user about message cost and ask for confirmation.

## Step 3: Fix Mode (only if --fix flag present)

If `$ARGUMENTS` contains `--fix`:

1. Run with `--json --fix` to get fixable findings:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/index.js" check --json --fix $ARGUMENTS
   ```

2. Parse the JSON output. Present the fix plan grouped by skill:
   - Number of auto-fixable issues
   - What each fix does
   - Which files will be modified
   - Plugin issues that CANNOT be fixed (report count only)

3. Ask for user confirmation before proceeding.

4. Apply fixes using the Edit tool:

   ### STRUCT-002 (No frontmatter)
   Add minimal YAML frontmatter:
   ```yaml
   ---
   name: skill-name
   description: TODO - add a description
   version: 0.1.0
   ---
   ```

   ### STRUCT-003 (Missing name)
   Add `name` field derived from the skill's directory name.

   ### STRUCT-005 (Missing version)
   Add `version: 0.1.0` to existing frontmatter.

5. After applying, re-run audit to show before/after score comparison.

## Protection Rules

- **Plugin skills** (everything-claude-code, superpowers, feature-dev, etc.): NEVER modify. Report only. Suggest `claude plugin update <name>`.
- **Anthropic official skills** (skill-creator, code-review, figma, context7, etc.): NEVER modify. Report only.
- **Standalone skills from external repos**: NEVER modify. Report only.
- **User-created skills** (`~/.claude/skills/` non-symlink, `.claude/skills/`): CAN be fixed.
- **Size guard**: Content rewrites (not structural fixes) are capped at 20% size increase.

## Important Notes

- Without --fix, this audit is **read-only**
- Token estimates use charCount/4 approximation (+/-20% variance)
- Update checks require network access (use --no-update for offline mode)
- Use `--verbose` for raw similarity scores and update check details
