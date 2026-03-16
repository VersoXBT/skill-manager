/**
 * Shared data types and factory functions for skill-manager.
 * All modules import from here. All returned objects are frozen (immutable).
 *
 * @typedef {'critical'|'high'|'medium'|'low'|'info'} Severity
 *
 * @typedef {Object} Finding
 * @property {string} skillPath - Absolute path to SKILL.md
 * @property {string} skillName - Name from frontmatter or directory
 * @property {string} checkId - e.g. 'STRUCT-001', 'DUP-002'
 * @property {Severity} severity
 * @property {string} category - 'structure'|'tokens'|'duplicates'|'freshness'|'updates'
 * @property {string} message - Human-readable description
 * @property {string} [suggestion] - Recommended fix
 * @property {boolean} [autoFixable] - Can skill-fix handle it
 * @property {Object} [meta] - Extra data (scores, thresholds, etc.)
 *
 * @typedef {Object} SkillInfo
 * @property {string} name
 * @property {string} path - Absolute path to SKILL.md
 * @property {string} dirPath - Absolute path to skill directory
 * @property {'user-manual'|'plugin-cache'|'plugin-marketplace'|'project'|'standalone'} source
 * @property {string|null} sourcePlugin - Plugin name if from plugin
 * @property {Object} frontmatter - Parsed YAML frontmatter
 * @property {string} body - Markdown content after frontmatter
 * @property {number} charCount
 * @property {number} estimatedTokens
 * @property {Date} mtime - Last modification time
 * @property {boolean} isSymlink
 * @property {string|null} symlinkTarget
 * @property {string|null} pluginVersion - From installed_plugins.json
 * @property {string|null} marketplace - Marketplace name
 * @property {string|null} repositoryUrl - Source repository URL
 * @property {string|null} installedCommitSha - Git commit SHA at install time
 * @property {string|null} sourceUrl - From .skill-lock.json
 * @property {string|null} skillFolderHash - Content hash from .skill-lock.json
 * @property {string|null} updatedAt - Last update timestamp
 *
 * @typedef {Object} AuditReport
 * @property {string} generatedAt - ISO timestamp
 * @property {string} version - skill-manager version
 * @property {number} healthScore - 0-100
 * @property {string} grade - A/B/C/D/F
 * @property {SkillInfo[]} skills
 * @property {Finding[]} findings
 * @property {Object} summary - Counts by severity
 * @property {Object} config - Config that was used
 */

const SEVERITY_ORDER = Object.freeze({
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
})

const SEVERITY_DEDUCTIONS = Object.freeze({
  critical: 15,
  high: 8,
  medium: 3,
  low: 1,
  info: 0,
})

/**
 * @param {Partial<Finding>} partial
 * @returns {Readonly<Finding>}
 */
export function createFinding(partial) {
  return Object.freeze({
    skillPath: partial.skillPath ?? '',
    skillName: partial.skillName ?? 'unknown',
    checkId: partial.checkId ?? 'UNKNOWN',
    severity: partial.severity ?? 'info',
    category: partial.category ?? 'structure',
    message: partial.message ?? '',
    suggestion: partial.suggestion ?? null,
    autoFixable: partial.autoFixable ?? false,
    meta: partial.meta ? Object.freeze({ ...partial.meta }) : null,
  })
}

/**
 * @param {number} healthScore
 * @returns {string}
 */
export function computeGrade(healthScore) {
  if (healthScore >= 90) return 'A'
  if (healthScore >= 80) return 'B'
  if (healthScore >= 70) return 'C'
  if (healthScore >= 60) return 'D'
  return 'F'
}

/**
 * @param {Finding[]} findings
 * @returns {number}
 */
export function computeHealthScore(findings) {
  let score = 100
  for (const finding of findings) {
    score -= SEVERITY_DEDUCTIONS[finding.severity] ?? 0
  }
  return Math.max(0, Math.min(100, score))
}

/**
 * @param {SkillInfo[]} skills
 * @param {Finding[]} findings
 * @param {Object} config
 * @returns {Readonly<AuditReport>}
 */
export function createAuditReport(skills, findings, config) {
  const healthScore = computeHealthScore(findings)
  const summary = { critical: 0, high: 0, medium: 0, low: 0, info: 0 }
  for (const f of findings) {
    summary[f.severity] = (summary[f.severity] ?? 0) + 1
  }

  return Object.freeze({
    generatedAt: new Date().toISOString(),
    version: '0.1.0',
    healthScore,
    grade: computeGrade(healthScore),
    skills,
    findings: [...findings].sort(
      (a, b) => (SEVERITY_ORDER[a.severity] ?? 4) - (SEVERITY_ORDER[b.severity] ?? 4)
    ),
    summary: Object.freeze(summary),
    config,
  })
}

export { SEVERITY_ORDER, SEVERITY_DEDUCTIONS }
