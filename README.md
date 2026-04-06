<div align="center">

[![Stars](https://img.shields.io/github/stars/VersoXBT/skill-manager?style=flat-square&logo=github&label=Stars)](https://github.com/VersoXBT/skill-manager)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![Claude Code Plugin](https://img.shields.io/badge/Claude%20Code-Plugin-blueviolet?style=flat-square&logo=anthropic)](https://claude.ai/code)

</div>

# skill-manager — See Everything You Have Installed

> Know what skills, plugins, and agents you're running. See where they come from, what needs fixing, and what has updates.

`skill-manager` is a Claude Code plugin that scans all your installed skills and gives you a clean inventory with structural checks and update notifications.

## Install

Run in your terminal:

```bash
claude plugin install skill-manager@skill-manager
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

1. **Inventory** — Lists every skill with description, source, GitHub repo link, and token count
2. **Structure checks** — Validates frontmatter (name, description, version)
3. **Update checks** — Queries GitHub for newer versions of plugins and standalone skills

Claude groups your skills by category and presents a clean report:

```
## Skills
| Skill       | Description                        | Source     | Repo                | Tokens |
|-------------|------------------------------------|------------|---------------------|--------|
| fastapi     | Build Python APIs with FastAPI...  | manual     |                     | ~6808  |
| helius      | Build Solana apps with Helius...   | standalone | sendaifun/skills    | ~2715  |
| find-skills | Discover installable agent skills  | standalone | vercel-labs/skills  | ~1157  |
| tdd-workflow| TDD with 80%+ coverage             | everything-cc |                  | ~2406  |

## Structure Issues
- 2 skills missing frontmatter entirely
- 88 skills missing version field

## Updates Available
- azure-ai: newer version available (2026-02-26 → 2026-03-14)
```

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

## Contributors

<!-- ALL-CONTRIBUTORS-LIST:START -->
<table>
  <tr>
    <td align="center"><a href="https://github.com/VersoXBT"><img src="https://avatars.githubusercontent.com/u/202813801?v=4" width="80px;" alt=""/><br /><sub><b>VersoXBT</b></sub></a><br />💻 📖</td>
    <td align="center"><a href="https://github.com/claude"><img src="https://avatars.githubusercontent.com/u/81847?v=4" width="80px;" alt=""/><br /><sub><b>Claude</b></sub></a><br />🤖 💡</td>
  </tr>
</table>
<!-- ALL-CONTRIBUTORS-LIST:END -->
