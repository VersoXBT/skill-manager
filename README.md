# skill-manager — Audit & Fix Your Claude Code Skills

> **Your 50+ Claude Code skills are fighting each other and you don't know it.** Skills from different plugins give contradictory instructions, bloated skills eat your context window, stale patterns reference deprecated libraries, and you have no idea which plugins have newer versions.

`skill-manager` is a Claude Code plugin that runs a comprehensive audit of all your installed skills, commands, and agents — **for free**. No API keys, no external services.

## Install

```bash
claude plugin add VersoXBT/skill-manager
```

## Usage

```bash
# Run your first audit
/skill-check

# Fix auto-fixable issues (user-owned skills only)
/skill-check --fix

# Deep LLM-powered analysis (opt-in, uses subscription messages)
/skill-check --deep

# Machine-readable output
/skill-check --json

# Offline mode (skip GitHub update checks)
/skill-check --no-update

# Verbose output with raw scores
/skill-check --verbose
```

## Sample Output

```
# Skill Manager Audit Report

Generated: 2026-03-16 | Skills scanned: 128 | Issues: 258

## Health Score: 62/100 (D)

## Critical Issues
- [TOKEN-001] pptx: ~277,091 tokens (critical threshold: 20,000)

## High Issues
- [DUP-001] brainstorming ↔ superpowers:brainstorming: 94% name similarity
- [FRESH-002] azure-ai: References deprecated library "msrest"

## Updates Available
- azure-ai: Source repo has newer commits (installed: 2026-02-26, latest: 2026-03-14)
```

## What It Checks

| Category | Checks | Finding IDs |
|----------|--------|-------------|
| **Structure** | Frontmatter validation, file integrity, broken refs | STRUCT-001 to 008 |
| **Tokens** | Context window cost per skill, bloat detection | TOKEN-001, 002 |
| **Duplicates** | Name similarity, description overlap, heading overlap | DUP-001 to 003 |
| **Freshness** | Stale mtime, deprecated library references | FRESH-001, 002 |
| **Updates** | GitHub repo checks for newer plugin/skill versions | UPDATE-001, 002 |

## Two-Tier Architecture

**Tier 1 (always free):** Structural analysis, token estimation, duplicate detection, freshness scanning, and GitHub update checking. Runs in seconds with zero LLM cost.

**Tier 2 (opt-in with `--deep`):** LLM-powered quality analysis via the `skill-analyzer` agent. Reviews trigger reliability, instruction clarity, token efficiency, and integration quality. Uses Haiku for cost efficiency.

## Health Score

Your skills get a health score from 0-100:

| Grade | Score | Meaning |
|-------|-------|---------|
| **A** | 90-100 | Excellent — well-structured, no conflicts |
| **B** | 80-89 | Good — minor issues to address |
| **C** | 70-79 | Fair — several quality issues need attention |
| **D** | 60-69 | Poor — significant issues affecting quality |
| **F** | < 60 | Failing — critical issues, immediate action needed |

Deductions: critical (-15), high (-8), medium (-3), low (-1).

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
  "ignoredSkills": ["my-experimental-skill"],
  "severityOverrides": {
    "STRUCT-005": "low"
  },
  "thresholds": {
    "tokenWarning": 10000,
    "tokenCritical": 25000,
    "freshnessStaleMonths": 12
  }
}
```

## FAQ

**Does it use my subscription messages?**
Tier 1 analysis is completely free. Deep analysis (`--deep`) is opt-in and uses Haiku for cost efficiency.

**Will it modify my skills?**
`/skill-check` is read-only by default. `--fix` shows diffs and asks for confirmation. It never touches plugin or Anthropic skills.

**How does update checking work?**
Uses `gh` CLI (authenticated, 5000 req/hr) with `fetch()` fallback (60 req/hr). Results are cached for 1 hour. Use `--no-update` for offline mode.

**How many skills does it support?**
Tested with 200+ skills across 10+ plugins. Runs in under 5 seconds on Tier 1.

## Contributing

Issues and PRs welcome. If you find a false positive or a check that should exist, open an issue.

## License

MIT
