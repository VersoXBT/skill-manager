import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createFinding } from '../../schemas/findings.js'

const DEPRECATION_PATTERNS = [
  { pattern: /text-davinci-\d{3}/i, message: 'References deprecated OpenAI model' },
  { pattern: /gpt-4-\d{4}/i, message: 'References deprecated GPT-4 snapshot model' },
  { pattern: /claude-2/i, message: 'References deprecated Claude 2 model' },
  { pattern: /claude-3(?!\.)/i, message: 'References deprecated Claude 3 model (use Claude 4.x)' },
  { pattern: /\bcreate-react-app\b/i, message: 'References create-react-app (deprecated, use Vite or Next.js)' },
  { pattern: /\bmoment\.?js\b/i, message: 'References moment.js (prefer date-fns or Temporal)' },
  { pattern: /\bNode\.?js\s*(?:1[0-8]|[0-9])\b/i, message: 'References outdated Node.js version (current LTS: 22)' },
  { pattern: /\bReact\s*(?:1[0-7]|[0-9])\b/i, message: 'References outdated React version (current: 19)' },
  { pattern: /\bNext\.?js\s*(?:1[0-3]|[0-9])\b/i, message: 'References outdated Next.js version (current: 15)' },
  { pattern: /\bTypeScript\s*4\b/i, message: 'References TypeScript 4.x (current: 5.x)' },
  { pattern: /\bPython\s*3\.(?:[0-9]|10)\b/i, message: 'References outdated Python version (current: 3.13)' },
  { pattern: /\bExpress\s*4\b/i, message: 'References Express 4 (Express 5 is current)' },
  { pattern: /\bDjango\s*[0-4]\b/i, message: 'References outdated Django version (current: 5.x)' },
]

/** Scan content line-by-line for deprecated patterns. */
function scanContent(content, file, skill) {
  const findings = []
  const lines = content.split('\n')
  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    for (const { pattern, message } of DEPRECATION_PATTERNS) {
      const re = new RegExp(pattern.source, pattern.flags)
      if (re.test(lines[lineNum])) {
        findings.push(createFinding({
          skillPath: skill.path,
          skillName: skill.name,
          checkId: 'FRESH-002',
          severity: 'low',
          category: 'freshness',
          message: `${message} in "${skill.name}"`,
          suggestion: 'Update to current version or remove outdated reference.',
          meta: { file, line: lineNum + 1, match: lines[lineNum].trim() },
        }))
      }
    }
  }
  return findings
}

/** Collect reference file contents from references/ subdirectory. */
function readReferenceFiles(dirPath) {
  const refsDir = join(dirPath, 'references')
  try {
    return readdirSync(refsDir, { withFileTypes: true })
      .filter(entry => entry.isFile())
      .map(entry => {
        const filePath = join(refsDir, entry.name)
        try {
          return { file: `references/${entry.name}`, content: readFileSync(filePath, 'utf-8') }
        } catch { return null }
      })
      .filter(Boolean)
  } catch { return [] }
}

/**
 * Detect stale skills and outdated library/pattern references.
 * @param {import('../../schemas/findings.js').SkillInfo[]} skills
 * @param {Object} config
 * @returns {import('../../schemas/findings.js').Finding[]}
 */
export function scanFreshness(skills, config = {}) {
  const staleMonths = config.thresholds?.freshnessStaleMonths ?? 6
  const ignored = new Set(config.ignoredSkills ?? [])
  const findings = []
  const now = new Date()

  for (const skill of skills) {
    if (ignored.has(skill.name)) continue
    try {
      const ageMs = now.getTime() - new Date(skill.mtime).getTime()
      const ageMonths = ageMs / (1000 * 60 * 60 * 24 * 30.44)

      if (ageMonths > staleMonths) {
        findings.push(createFinding({
          skillPath: skill.path,
          skillName: skill.name,
          checkId: 'FRESH-001',
          severity: 'medium',
          category: 'freshness',
          message: `Skill "${skill.name}" not modified in ${Math.floor(ageMonths)} months (threshold: ${staleMonths})`,
          suggestion: 'Review and update this skill to ensure it reflects current best practices.',
          meta: { lastModified: skill.mtime, ageMonths: Math.round(ageMonths * 10) / 10 },
        }))
      }

      findings.push(...scanContent(skill.body, 'SKILL.md', skill))

      for (const ref of readReferenceFiles(skill.dirPath)) {
        findings.push(...scanContent(ref.content, ref.file, skill))
      }
    } catch { /* skip problematic skills */ }
  }
  return findings
}
