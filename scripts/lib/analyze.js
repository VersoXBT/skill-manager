import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { createFinding } from '../../schemas/findings.js'

const RELATIVE_PATH_RE = /(?:^|\s)((?:\.\/|references\/|scripts\/)[^\s,)>"']+)/gm

const DEFAULT_CHECKS = Object.freeze({
  'STRUCT-001': 'critical',
  'STRUCT-002': 'high',
  'STRUCT-003': 'high',
  'STRUCT-004': 'high',
  'STRUCT-005': 'medium',
  'STRUCT-006': 'medium',
  'STRUCT-007': 'low',
  'STRUCT-008': 'info',
})

/**
 * Resolve effective severity for a check, applying config overrides.
 * @param {string} checkId
 * @param {Object} severityOverrides
 * @returns {import('../../schemas/findings.js').Severity}
 */
function resolveSeverity(checkId, severityOverrides) {
  return severityOverrides[checkId] ?? DEFAULT_CHECKS[checkId]
}

/**
 * Count words in a string.
 * @param {string} text
 * @returns {number}
 */
function countWords(text) {
  return text.split(/\s+/).filter(Boolean).length
}

/**
 * Extract relative file paths referenced in body text.
 * @param {string} body
 * @returns {string[]}
 */
function extractReferencedPaths(body) {
  const paths = []
  let match
  while ((match = RELATIVE_PATH_RE.exec(body)) !== null) {
    paths.push(match[1])
  }
  return paths
}

/**
 * Run all structural checks on a single skill.
 * @param {import('../../schemas/findings.js').SkillInfo} skill
 * @param {Object} overrides
 * @returns {import('../../schemas/findings.js').Finding[]}
 */
function analyzeSkill(skill, overrides) {
  const findings = []
  const base = { skillPath: skill.path, skillName: skill.name, category: 'structure' }

  if (skill.charCount === 0) {
    findings.push(createFinding({
      ...base,
      checkId: 'STRUCT-001',
      severity: resolveSeverity('STRUCT-001', overrides),
      message: 'SKILL.md is empty (0 characters)',
      suggestion: 'Add frontmatter with name/description and meaningful content',
      autoFixable: false,
    }))
  }

  if (Object.keys(skill.frontmatter).length === 0) {
    findings.push(createFinding({
      ...base,
      checkId: 'STRUCT-002',
      severity: resolveSeverity('STRUCT-002', overrides),
      message: 'No YAML frontmatter detected',
      suggestion: 'Add a --- delimited frontmatter block with at least name and description fields',
      autoFixable: true,
    }))
  }

  if (!skill.frontmatter.name) {
    findings.push(createFinding({
      ...base,
      checkId: 'STRUCT-003',
      severity: resolveSeverity('STRUCT-003', overrides),
      message: 'Missing required "name" field in frontmatter',
      suggestion: 'Add "name: your-skill-name" to frontmatter',
      autoFixable: true,
    }))
  }

  if (!skill.frontmatter.description) {
    findings.push(createFinding({
      ...base,
      checkId: 'STRUCT-004',
      severity: resolveSeverity('STRUCT-004', overrides),
      message: 'Missing required "description" field in frontmatter',
      suggestion: 'Add a "description:" field summarizing what this skill does',
      autoFixable: false,
    }))
  }

  if (!skill.frontmatter.version) {
    findings.push(createFinding({
      ...base,
      checkId: 'STRUCT-005',
      severity: resolveSeverity('STRUCT-005', overrides),
      message: 'Missing "version" field in frontmatter',
      suggestion: 'Add "version: 1.0.0" to frontmatter for change tracking',
      autoFixable: true,
    }))
  }

  const referencedPaths = extractReferencedPaths(skill.body)
  for (const relPath of referencedPaths) {
    const absolute = join(skill.dirPath, relPath)
    if (!existsSync(absolute)) {
      findings.push(createFinding({
        ...base,
        checkId: 'STRUCT-006',
        severity: resolveSeverity('STRUCT-006', overrides),
        message: `Referenced path does not exist: ${relPath}`,
        suggestion: `Create the missing file or fix the path in SKILL.md`,
        autoFixable: false,
        meta: { missingPath: relPath },
      }))
    }
  }

  if (skill.frontmatter.description && skill.frontmatter.description.length < 20) {
    findings.push(createFinding({
      ...base,
      checkId: 'STRUCT-007',
      severity: resolveSeverity('STRUCT-007', overrides),
      message: `Description is too short (${skill.frontmatter.description.length} chars, minimum 20)`,
      suggestion: 'Expand the description to clearly explain the skill purpose and capabilities',
      autoFixable: false,
    }))
  }

  const wordCount = countWords(skill.body)
  if (wordCount > 3000 && !existsSync(join(skill.dirPath, 'references'))) {
    findings.push(createFinding({
      ...base,
      checkId: 'STRUCT-008',
      severity: resolveSeverity('STRUCT-008', overrides),
      message: `Large skill (${wordCount} words) with no references/ directory`,
      suggestion: 'Split supporting content into a references/ subdirectory to improve readability',
      autoFixable: false,
      meta: { wordCount },
    }))
  }

  return findings
}

/**
 * Analyze structural integrity of all discovered skills.
 * @param {import('../../schemas/findings.js').SkillInfo[]} skills
 * @param {Object} config
 * @returns {import('../../schemas/findings.js').Finding[]}
 */
export function analyzeStructure(skills, config = {}) {
  const overrides = config.severityOverrides ?? {}
  const ignored = new Set(config.ignoredSkills ?? [])
  const findings = []

  for (const skill of skills) {
    if (ignored.has(skill.name)) continue

    try {
      const skillFindings = analyzeSkill(skill, overrides)
      findings.push(...skillFindings)
    } catch (error) {
      findings.push(createFinding({
        skillPath: skill.path,
        skillName: skill.name,
        checkId: 'INTERNAL',
        severity: 'critical',
        category: 'structure',
        message: `Internal error analyzing skill: ${error.message}`,
        suggestion: 'Report this bug to skill-manager maintainers',
        autoFixable: false,
        meta: { error: error.message },
      }))
    }
  }

  return findings
}
