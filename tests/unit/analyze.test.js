import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { analyzeStructure } from '../../scripts/lib/analyze.js'

function mockSkill(overrides = {}) {
  return {
    name: 'test-skill',
    path: '/fake/test-skill/SKILL.md',
    dirPath: '/fake/test-skill',
    frontmatter: {
      name: 'test-skill',
      description: 'A test skill for unit testing',
      version: '1.0.0',
    },
    body: '# Test Skill\n\nSome body content here.',
    charCount: 100,
    ...overrides,
  }
}

describe('analyzeStructure', () => {
  it('returns no findings for a valid skill with all fields', () => {
    const skills = [mockSkill()]

    const findings = analyzeStructure(skills)

    assert.equal(findings.length, 0)
  })

  it('STRUCT-001: detects empty SKILL.md', () => {
    const skills = [mockSkill({ charCount: 0 })]

    const findings = analyzeStructure(skills)
    const match = findings.find(f => f.checkId === 'STRUCT-001')

    assert.ok(match, 'Expected STRUCT-001 finding')
    assert.equal(match.severity, 'critical')
    assert.ok(match.message.includes('empty'))
  })

  it('STRUCT-002: detects missing frontmatter', () => {
    const skills = [mockSkill({ frontmatter: {} })]

    const findings = analyzeStructure(skills)
    const match = findings.find(f => f.checkId === 'STRUCT-002')

    assert.ok(match, 'Expected STRUCT-002 finding')
    assert.equal(match.severity, 'high')
  })

  it('STRUCT-003: detects missing name', () => {
    const skills = [mockSkill({
      frontmatter: { description: 'A test skill for unit testing', version: '1.0.0' },
    })]

    const findings = analyzeStructure(skills)
    const match = findings.find(f => f.checkId === 'STRUCT-003')

    assert.ok(match, 'Expected STRUCT-003 finding')
    assert.equal(match.severity, 'high')
  })

  it('STRUCT-004: detects missing description', () => {
    const skills = [mockSkill({
      frontmatter: { name: 'test-skill', version: '1.0.0' },
    })]

    const findings = analyzeStructure(skills)
    const match = findings.find(f => f.checkId === 'STRUCT-004')

    assert.ok(match, 'Expected STRUCT-004 finding')
    assert.equal(match.severity, 'high')
  })

  it('STRUCT-005: detects missing version', () => {
    const skills = [mockSkill({
      frontmatter: { name: 'test-skill', description: 'A test skill for unit testing' },
    })]

    const findings = analyzeStructure(skills)
    const match = findings.find(f => f.checkId === 'STRUCT-005')

    assert.ok(match, 'Expected STRUCT-005 finding')
    assert.equal(match.severity, 'medium')
  })

  it('STRUCT-007: detects description shorter than 20 chars', () => {
    const skills = [mockSkill({
      frontmatter: { name: 'test-skill', description: 'Short', version: '1.0.0' },
    })]

    const findings = analyzeStructure(skills)
    const match = findings.find(f => f.checkId === 'STRUCT-007')

    assert.ok(match, 'Expected STRUCT-007 finding')
    assert.equal(match.severity, 'low')
    assert.ok(match.message.includes('too short'))
  })

  it('STRUCT-008: detects body > 3000 words without references/', () => {
    // Generate a body with more than 3000 words
    const words = Array.from({ length: 3100 }, (_, i) => `word${i}`)
    const longBody = words.join(' ')
    const skills = [mockSkill({ body: longBody })]

    const findings = analyzeStructure(skills)
    const match = findings.find(f => f.checkId === 'STRUCT-008')

    assert.ok(match, 'Expected STRUCT-008 finding')
    assert.equal(match.severity, 'info')
    assert.ok(match.meta.wordCount > 3000)
  })

  it('applies severity overrides from config', () => {
    const skills = [mockSkill({ charCount: 0 })]

    const findings = analyzeStructure(skills, {
      severityOverrides: { 'STRUCT-001': 'low' },
    })
    const match = findings.find(f => f.checkId === 'STRUCT-001')

    assert.ok(match, 'Expected STRUCT-001 finding')
    assert.equal(match.severity, 'low')
  })

  it('skips ignored skills', () => {
    const skills = [mockSkill({ charCount: 0 })]

    const findings = analyzeStructure(skills, {
      ignoredSkills: ['test-skill'],
    })

    assert.equal(findings.length, 0)
  })
})
