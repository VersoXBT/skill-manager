import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { checkStructure } from '../../scripts/lib/analyze.js'

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

describe('checkStructure', () => {
  it('returns no issues for a valid skill', () => {
    const issues = checkStructure([mockSkill()])
    assert.equal(issues.length, 0)
  })

  it('STRUCT-001: detects empty SKILL.md', () => {
    const issues = checkStructure([mockSkill({ charCount: 0 })])
    const found = issues.find(i => i.checkId === 'STRUCT-001')
    assert.ok(found)
  })

  it('STRUCT-002: detects missing frontmatter', () => {
    const issues = checkStructure([mockSkill({ frontmatter: {} })])
    const found = issues.find(i => i.checkId === 'STRUCT-002')
    assert.ok(found)
  })

  it('STRUCT-003: detects missing name', () => {
    const issues = checkStructure([mockSkill({
      frontmatter: { description: 'A skill', version: '1.0.0' },
    })])
    const found = issues.find(i => i.checkId === 'STRUCT-003')
    assert.ok(found)
  })

  it('STRUCT-004: detects missing description', () => {
    const issues = checkStructure([mockSkill({
      frontmatter: { name: 'test', version: '1.0.0' },
    })])
    const found = issues.find(i => i.checkId === 'STRUCT-004')
    assert.ok(found)
  })

  it('STRUCT-005: detects missing version', () => {
    const issues = checkStructure([mockSkill({
      frontmatter: { name: 'test', description: 'A skill' },
    })])
    const found = issues.find(i => i.checkId === 'STRUCT-005')
    assert.ok(found)
  })

  it('skips ignored skills', () => {
    const issues = checkStructure(
      [mockSkill({ name: 'ignored', frontmatter: {} })],
      { ignoredSkills: ['ignored'] },
    )
    assert.equal(issues.length, 0)
  })
})
