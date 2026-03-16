import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { estimateTokens } from '../../scripts/lib/tokens.js'

function mockSkill(overrides = {}) {
  return {
    name: 'test-skill',
    path: '/fake/SKILL.md',
    dirPath: '/fake/test-skill',
    charCount: 400,
    estimatedTokens: 100,
    frontmatter: {},
    body: '',
    ...overrides,
  }
}

describe('estimateTokens', () => {
  it('returns no findings for skill under warning threshold', () => {
    const skills = [mockSkill({ estimatedTokens: 500 })]

    const findings = estimateTokens(skills)

    assert.equal(findings.length, 0)
  })

  it('TOKEN-002: finds skill above warning threshold', () => {
    const skills = [mockSkill({ estimatedTokens: 9000 })]

    const findings = estimateTokens(skills)

    assert.equal(findings.length, 1)
    assert.equal(findings[0].checkId, 'TOKEN-002')
    assert.equal(findings[0].severity, 'medium')
    assert.match(findings[0].message, /9000/)
  })

  it('TOKEN-001: finds skill above critical threshold', () => {
    const skills = [mockSkill({ estimatedTokens: 25000 })]

    const findings = estimateTokens(skills)

    assert.equal(findings.length, 1)
    assert.equal(findings[0].checkId, 'TOKEN-001')
    assert.equal(findings[0].severity, 'high')
    assert.match(findings[0].message, /25000/)
  })

  it('uses config thresholds when provided', () => {
    const skills = [mockSkill({ estimatedTokens: 500 })]
    const config = { thresholds: { tokenWarning: 400, tokenCritical: 600 } }

    const findings = estimateTokens(skills, config)

    assert.equal(findings.length, 1)
    assert.equal(findings[0].checkId, 'TOKEN-002')
    assert.equal(findings[0].severity, 'medium')
  })

  it('skips ignored skills', () => {
    const skills = [mockSkill({ name: 'ignored-skill', estimatedTokens: 25000 })]
    const config = { ignoredSkills: ['ignored-skill'] }

    const findings = estimateTokens(skills, config)

    assert.equal(findings.length, 0)
  })

  it('finding meta includes breakdown with disclaimer', () => {
    const skills = [mockSkill({ estimatedTokens: 9000 })]

    const findings = estimateTokens(skills)

    assert.equal(findings.length, 1)
    const { meta } = findings[0]
    assert.ok(meta.breakdown, 'meta should have a breakdown property')
    assert.equal(meta.breakdown['SKILL.md'], 9000)
    assert.ok(
      meta.disclaimer.includes('approximation'),
      'disclaimer should mention approximation',
    )
    assert.equal(meta.totalTokens, 9000)
    assert.equal(meta.category, 'heavy')
  })
})
