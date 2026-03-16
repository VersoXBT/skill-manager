/**
 * Structural analysis — checks frontmatter basics.
 * Returns plain issue objects, not severity-scored findings.
 */

/**
 * Check a single skill for structural problems.
 * @param {Object} skill
 * @returns {Object[]}
 */
function checkSkill(skill) {
  const issues = []
  const base = { skillName: skill.name, skillPath: skill.path, category: 'structure' }

  if (skill.charCount === 0) {
    issues.push({
      ...base,
      checkId: 'STRUCT-001',
      message: 'SKILL.md is empty',
      suggestion: 'Add frontmatter and content',
      autoFixable: false,
    })
    return issues
  }

  if (Object.keys(skill.frontmatter).length === 0) {
    issues.push({
      ...base,
      checkId: 'STRUCT-002',
      message: 'No frontmatter',
      suggestion: 'Add --- delimited frontmatter with name and description',
      autoFixable: true,
    })
  }

  if (!skill.frontmatter.name) {
    issues.push({
      ...base,
      checkId: 'STRUCT-003',
      message: 'Missing name in frontmatter',
      suggestion: 'Add "name: your-skill-name" to frontmatter',
      autoFixable: true,
    })
  }

  if (!skill.frontmatter.description) {
    issues.push({
      ...base,
      checkId: 'STRUCT-004',
      message: 'Missing description in frontmatter',
      suggestion: 'Add a description field',
      autoFixable: false,
    })
  }

  if (!skill.frontmatter.version) {
    issues.push({
      ...base,
      checkId: 'STRUCT-005',
      message: 'Missing version in frontmatter',
      suggestion: 'Add "version: 1.0.0"',
      autoFixable: true,
    })
  }

  return issues
}

/**
 * Run structural checks on all skills.
 * @param {Object[]} skills
 * @param {Object} config
 * @returns {Object[]}
 */
export function checkStructure(skills, config = {}) {
  const ignored = new Set(config.ignoredSkills ?? [])
  const issues = []

  for (const skill of skills) {
    if (ignored.has(skill.name)) continue
    try {
      issues.push(...checkSkill(skill))
    } catch {
      // skip broken skills
    }
  }

  return issues
}
