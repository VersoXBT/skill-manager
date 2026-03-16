# Health Score Rubric

## Scoring Algorithm

The health score starts at 100 and deducts points per finding:

| Severity | Deduction |
|----------|-----------|
| critical | -15 |
| high | -8 |
| medium | -3 |
| low | -1 |
| info | 0 |

Score is clamped to [0, 100].

## Grade Scale

| Grade | Score Range | Meaning |
|-------|-----------|---------|
| A | 90-100 | Excellent. Skills are well-structured and maintained. |
| B | 80-89 | Good. Minor issues that should be addressed. |
| C | 70-79 | Fair. Several quality issues need attention. |
| D | 60-69 | Poor. Significant issues affecting skill quality. |
| F | < 60 | Failing. Critical issues require immediate attention. |

## Improving Your Score

1. **Quick wins**: Add missing `version` fields to frontmatter (medium severity, -3 each)
2. **High impact**: Fix broken file references and add missing descriptions
3. **Long term**: Split bloated skills into progressive disclosure (SKILL.md + references/)
4. **Security**: Remove any hardcoded secrets or dangerous command patterns
