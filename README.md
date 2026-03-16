# skill-manager — See Everything You Have Installed

> Know what skills, plugins, and agents you're running. See where they come from, what needs fixing, and what has updates.

`skill-manager` is a Claude Code plugin that scans all your installed skills and gives you a clean inventory with structural checks and update notifications.

## Install

```bash
claude plugin add VersoXBT/skill-manager
```

## Usage

```bash
# See all your skills, sources, and issues
/skill-check

# Fix structural issues (user-owned skills only)
/skill-check --fix

# Machine-readable output
/skill-check --json

# Offline mode (skip GitHub update checks)
/skill-check --no-update
```

## What It Does

1. **Inventory** — Lists every skill with its description, source (official, everything-cc, superpowers, manual, standalone), and token count
2. **Structure checks** — Validates frontmatter (name, description, version)
3. **Update checks** — Queries GitHub for newer versions of plugins and standalone skills

Claude groups your skills by category (backend, frontend, blockchain, testing, etc.) and presents everything in a readable format.

## Auto-Fix (`--fix`)

`/skill-check --fix` can automatically repair:
- Missing frontmatter (STRUCT-002)
- Missing `name` field (STRUCT-003)
- Missing `version` field (STRUCT-005)

All fixes show diffs and ask for confirmation before applying.

### Protection Rules

`--fix` **never modifies**:
- Plugin skills (everything-claude-code, superpowers, feature-dev, etc.)
- Anthropic official skills (skill-creator, code-review, figma, etc.)
- Standalone skills from external repositories

Only **user-created skills** in `~/.claude/skills/` and project-level `.claude/skills/` can be fixed.

## Configuration

Create `~/.claude/skill-manager/config.json` to customize:

```json
{
  "ignoredSkills": ["my-experimental-skill"]
}
```

## FAQ

**Will it modify my skills?**
`/skill-check` is read-only by default. `--fix` shows diffs and asks for confirmation. It never touches plugin or official skills.

**How does update checking work?**
Uses `gh` CLI (authenticated, 5000 req/hr) with `fetch()` fallback (60 req/hr). Results are cached for 1 hour. Use `--no-update` for offline mode.

## License

MIT
