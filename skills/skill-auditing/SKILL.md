---
name: skill-auditing
description: >
  Activates when the user discusses skill quality, wants to audit their skills,
  mentions "skill manager", "check my skills", "skill health", "skill audit",
  "skill conflicts", "outdated skills", "skill duplicates", "skill updates",
  "newer version", "outdated plugins", or expresses concern about skill quality,
  maintenance, updates, or conflicts between installed skills.
version: 0.1.0
---

# Skill Auditing

## Quick Start

Audit all installed skills (free, zero LLM cost):

```
/skill-check
```

Deep analysis with LLM-powered review:

```
/skill-check --deep
```

Fix auto-fixable issues (user-owned skills only):

```
/skill-check --fix
```

## What Gets Checked

- **Structure**: Frontmatter validation (name, description, version), file integrity, broken references
- **Tokens**: Context window cost estimation per skill, bloat detection
- **Duplicates**: Conflicting skills from different plugins, overlapping trigger phrases
- **Freshness**: Stale skills (not updated in 6+ months), outdated library references
- **Updates**: Checks GitHub repos for newer versions of plugins and standalone skills

## Options

| Flag | Effect |
|------|--------|
| `--fix` | Apply auto-fixable issues (with confirmation, user-owned skills only) |
| `--verbose` | Show raw similarity scores and update check details |
| `--deep` | Enable LLM-powered Tier 2 analysis (uses subscription messages) |
| `--json` | Output machine-readable JSON |
| `--no-update` | Skip GitHub update checks (offline mode) |
