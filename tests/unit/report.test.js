import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { formatMarkdown, formatJson } from '../../scripts/lib/report.js'
import {
  createAuditReport,
  createFinding,
  computeHealthScore,
  computeGrade,
} from '../../schemas/findings.js'

function mockReport(findings = []) {
  return createAuditReport(
    [{
      name: 'test-skill',
      path: '/fake/SKILL.md',
      dirPath: '/fake',
      source: 'user-manual',
      frontmatter: {},
      body: '',
      charCount: 100,
      estimatedTokens: 25,
      mtime: new Date(),
      isSymlink: false,
      symlinkTarget: null,
      sourcePlugin: null,
    }],
    findings,
    {},
  )
}

describe('computeHealthScore', () => {
  it('returns 100 for zero findings', () => {
    const score = computeHealthScore([])

    assert.equal(score, 100)
  })

  it('deducts correctly for a critical finding (-15)', () => {
    const findings = [
      createFinding({ severity: 'critical', checkId: 'TEST-001', message: 'crit' }),
    ]

    const score = computeHealthScore(findings)

    assert.equal(score, 85)
  })

  it('deducts correctly for mixed findings', () => {
    const findings = [
      createFinding({ severity: 'critical', checkId: 'TEST-001', message: 'crit' }),
      createFinding({ severity: 'high', checkId: 'TEST-002', message: 'high' }),
      createFinding({ severity: 'medium', checkId: 'TEST-003', message: 'med' }),
    ]

    // 100 - 15 (critical) - 8 (high) - 3 (medium) = 74
    const score = computeHealthScore(findings)

    assert.equal(score, 74)
  })

  it('never goes below 0', () => {
    const findings = Array.from({ length: 10 }, (_, i) =>
      createFinding({ severity: 'critical', checkId: `TEST-${i}`, message: `crit ${i}` }),
    )

    // 10 * 15 = 150 deduction, but floor is 0
    const score = computeHealthScore(findings)

    assert.equal(score, 0)
  })
})

describe('computeGrade', () => {
  it('returns correct grades for each threshold', () => {
    assert.equal(computeGrade(95), 'A')
    assert.equal(computeGrade(85), 'B')
    assert.equal(computeGrade(75), 'C')
    assert.equal(computeGrade(65), 'D')
    assert.equal(computeGrade(50), 'F')
  })
})

describe('formatMarkdown', () => {
  it('returns string containing "Skill Manager Audit Report"', () => {
    const report = mockReport()

    const md = formatMarkdown(report)

    assert.equal(typeof md, 'string')
    assert.ok(md.includes('Skill Manager Audit Report'))
  })

  it('contains health score section', () => {
    const report = mockReport()

    const md = formatMarkdown(report)

    assert.ok(md.includes('## Health Score:'))
    assert.ok(md.includes('/100'))
  })

  it('contains summary table', () => {
    const findings = [
      createFinding({ severity: 'critical', checkId: 'T-1', message: 'problem', skillName: 'test-skill' }),
    ]
    const report = mockReport(findings)

    const md = formatMarkdown(report)

    assert.ok(md.includes('## Summary'))
    assert.ok(md.includes('| Severity | Count |'))
    assert.ok(md.includes('| critical | 1 |'))
  })

  it('renders "Updates Available" section when update findings exist', () => {
    const report = mockReport([
      createFinding({
        checkId: 'UPDATE-001',
        severity: 'low',
        category: 'updates',
        skillName: 'test-plugin',
        message: 'Newer version available',
        suggestion: 'Run: claude plugin update test-plugin',
      }),
    ])
    const md = formatMarkdown(report)
    assert.ok(md.includes('## Updates Available'))
    assert.ok(md.includes('test-plugin'))
  })

  it('does not render updates section when no update findings', () => {
    const report = mockReport([])
    const md = formatMarkdown(report)
    assert.ok(!md.includes('Updates Available'))
  })
})

describe('formatJson', () => {
  it('returns valid JSON', () => {
    const report = mockReport()

    const json = formatJson(report)

    assert.doesNotThrow(() => JSON.parse(json))
  })

  it('parses back to object with correct healthScore', () => {
    const findings = [
      createFinding({ severity: 'high', checkId: 'T-1', message: 'issue', skillName: 'test-skill' }),
    ]
    const report = mockReport(findings)

    const parsed = JSON.parse(formatJson(report))

    assert.equal(parsed.healthScore, 92)
    assert.equal(parsed.grade, 'A')
  })
})
