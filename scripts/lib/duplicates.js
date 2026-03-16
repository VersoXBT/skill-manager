import { realpathSync } from 'node:fs'
import { createFinding } from '../../schemas/findings.js'

const STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'can', 'for', 'and', 'but', 'or', 'not',
  'to', 'of', 'in', 'on', 'at', 'by', 'with', 'from', 'this', 'that',
  'it', 'its',
])

/** Normalized Levenshtein distance: 0 = identical, 1 = completely different. */
export function normalizedLevenshtein(a, b) {
  if (a === b) return 0
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 0
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  const curr = new Array(b.length + 1)
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j]
  }
  return prev[b.length] / maxLen
}

function tokenize(text) {
  return text.toLowerCase().split(/\W+/).filter(w => w.length > 0 && !STOPWORDS.has(w))
}

function jaccardOnSets(setA, setB) {
  if (setA.size === 0 && setB.size === 0) return 0
  if (setA.size === 0 || setB.size === 0) return 0
  let intersection = 0
  for (const w of setA) { if (setB.has(w)) intersection++ }
  return intersection / (setA.size + setB.size - intersection)
}

/** Jaccard similarity on filtered word sets: 1 = identical, 0 = disjoint. */
export function jaccardSimilarity(textA, textB) {
  const setA = new Set(tokenize(textA))
  const setB = new Set(tokenize(textB))
  if (setA.size === 0 || setB.size === 0) return 0
  return jaccardOnSets(setA, setB)
}

function extractHeadings(body) {
  const headings = new Set()
  for (const line of body.split('\n')) {
    const m = line.match(/^#{1,6}\s+(.+)/)
    if (m) headings.add(m[1].trim().toLowerCase())
  }
  return headings
}

/** Heading overlap via Jaccard on heading sets: 1 = identical, 0 = disjoint. */
export function headingOverlap(bodyA, bodyB) {
  return jaccardOnSets(extractHeadings(bodyA), extractHeadings(bodyB))
}

function extractTriggerPhrases(description) {
  const phrases = new Set()
  const regex = /"([^"]+)"|'([^']+)'/g
  let m
  while ((m = regex.exec(description)) !== null) {
    phrases.add((m[1] ?? m[2]).toLowerCase().trim())
  }
  return phrases
}

function safeRealpath(p) {
  try { return realpathSync(p) } catch { return p }
}

function countShared(setA, setB) {
  let n = 0
  for (const t of setA) { if (setB.has(t)) n++ }
  return n
}

/** Detect near-duplicate and conflicting skills. */
export function detectDuplicates(skills, config = {}) {
  const thresholds = {
    duplicateLevenshtein: 0.3,
    duplicateJaccard: 0.6,
    duplicateHeading: 0.5,
    ...config.thresholds,
  }
  const ignored = new Set(config.ignoredSkills ?? [])
  const filtered = skills.filter(s => !ignored.has(s.name))
  const findings = []

  for (let i = 0; i < filtered.length; i++) {
    for (let j = i + 1; j < filtered.length; j++) {
      const a = filtered[i]
      const b = filtered[j]
      if (safeRealpath(a.path) === safeRealpath(b.path)) continue

      const [first, second] = a.name.localeCompare(b.name) <= 0 ? [a, b] : [b, a]
      const descA = a.frontmatter?.description ?? ''
      const descB = b.frontmatter?.description ?? ''
      const nameSim = 1 - normalizedLevenshtein(a.name.toLowerCase(), b.name.toLowerCase())
      const descSim = jaccardSimilarity(descA, descB)
      const headSim = headingOverlap(a.body ?? '', b.body ?? '')
      const sharedTriggers = countShared(extractTriggerPhrases(descA), extractTriggerPhrases(descB))

      const meta = {
        nameSimilarity: nameSim,
        descriptionSimilarity: descSim,
        headingOverlap: headSim,
        sharedTriggerPhrases: sharedTriggers,
      }

      const bodyA = a.body ?? ''
      const bodyB = b.body ?? ''
      const exactMatch = bodyA === bodyB && bodyA.length > 0
      const descAbove = descSim > thresholds.duplicateJaccard
      const headAbove = headSim > thresholds.duplicateHeading
      const pct = (v) => `${(v * 100).toFixed(0)}%`

      if (exactMatch) {
        meta.classification = 'conflict'
        findings.push(createFinding({
          skillPath: first.path, skillName: first.name,
          checkId: 'DUP-001', severity: 'high', category: 'duplicates',
          message: `"${first.name}" and "${second.name}" have identical body content.`,
          suggestion: 'Remove one or merge into a single skill.',
          autoFixable: false, meta,
        }))
      } else if (nameSim > 0.7 && (descAbove || headAbove)) {
        meta.classification = 'conflict'
        findings.push(createFinding({
          skillPath: first.path, skillName: first.name,
          checkId: 'DUP-002', severity: 'medium', category: 'duplicates',
          message: `"${first.name}" and "${second.name}" appear to conflict (name similarity ${pct(nameSim)}).`,
          suggestion: 'Review both skills and consolidate overlapping instructions.',
          autoFixable: false, meta,
        }))
      } else if (descAbove || headAbove) {
        meta.classification = 'overlap'
        findings.push(createFinding({
          skillPath: first.path, skillName: first.name,
          checkId: 'DUP-003', severity: 'low', category: 'duplicates',
          message: `"${first.name}" and "${second.name}" have overlapping content (desc ${pct(descSim)}, headings ${pct(headSim)}).`,
          suggestion: 'Consider merging shared sections to reduce redundancy.',
          autoFixable: false, meta,
        }))
      }
    }
  }
  return findings
}
