import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { createFinding } from '../../schemas/findings.js'

const SUPPORTING_DIRS = ['references', 'examples', 'scripts']
const DISCLAIMER = 'Token estimates use charCount/4 approximation (+/-20% variance)'

function categorize(tokens) {
  if (tokens > 20000) return 'bloated'
  if (tokens > 8000) return 'heavy'
  if (tokens >= 2000) return 'moderate'
  return 'light'
}

/** Recursively collect all file paths under a directory. */
function collectFiles(dirPath) {
  try {
    return readdirSync(dirPath, { withFileTypes: true }).flatMap(entry => {
      const full = join(dirPath, entry.name)
      if (entry.isDirectory()) return collectFiles(full)
      return entry.isFile() ? [full] : []
    })
  } catch { return [] }
}

/** Scan references/, examples/, scripts/ subdirs and tally char counts. */
function scanSupportingFiles(dirPath) {
  let totalChars = 0
  const breakdown = {}
  for (const subDir of SUPPORTING_DIRS) {
    const fullDir = join(dirPath, subDir)
    if (!existsSync(fullDir)) continue
    try { if (!statSync(fullDir).isDirectory()) continue } catch { continue }
    for (const filePath of collectFiles(fullDir)) {
      try {
        const chars = readFileSync(filePath, 'utf-8').length
        breakdown[filePath.slice(dirPath.length + 1)] = Math.ceil(chars / 4)
        totalChars += chars
      } catch { /* skip unreadable files */ }
    }
  }
  return { totalChars, breakdown }
}

/**
 * Estimate token costs and categorize skills by context window impact.
 * @param {import('../../schemas/findings.js').SkillInfo[]} skills
 * @param {Object} config
 * @returns {import('../../schemas/findings.js').Finding[]}
 */
export function estimateTokens(skills, config = {}) {
  const warnAt = config.thresholds?.tokenWarning ?? 8000
  const critAt = config.thresholds?.tokenCritical ?? 20000
  const ignored = new Set(config.ignoredSkills ?? [])
  const findings = []

  for (const skill of skills) {
    if (ignored.has(skill.name)) continue
    const skillMdTokens = skill.estimatedTokens
    const { totalChars, breakdown } = scanSupportingFiles(skill.dirPath)
    const supportingTokens = Math.ceil(totalChars / 4)
    const totalTokens = skillMdTokens + supportingTokens
    const category = categorize(totalTokens)
    const meta = Object.freeze({
      totalTokens, skillMdTokens, supportingTokens, category,
      breakdown: Object.freeze({ 'SKILL.md': skillMdTokens, ...breakdown }),
      disclaimer: DISCLAIMER,
    })

    if (totalTokens > critAt) {
      findings.push(createFinding({
        skillPath: skill.path, skillName: skill.name,
        checkId: 'TOKEN-001', severity: 'high', category: 'tokens',
        message: `Skill "${skill.name}" uses ~${totalTokens} tokens (critical threshold: ${critAt})`,
        suggestion: 'Split large content into references/ for progressive disclosure, or remove redundant examples.',
        meta,
      }))
    } else if (totalTokens > warnAt) {
      findings.push(createFinding({
        skillPath: skill.path, skillName: skill.name,
        checkId: 'TOKEN-002', severity: 'medium', category: 'tokens',
        message: `Skill "${skill.name}" uses ~${totalTokens} tokens (warning threshold: ${warnAt})`,
        suggestion: 'Move supplementary content to references/ for progressive disclosure.',
        meta,
      }))
    }
  }
  return findings
}
