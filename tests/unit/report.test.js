import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { formatReport, formatJson } from '../../scripts/lib/report.js'

function mockReport(issues = [], updates = []) {
  return {
    skills: [{
      name: 'test-skill',
      path: '/fake/SKILL.md',
      dirPath: '/fake',
      source: 'user-manual',
      frontmatter: { description: 'A test skill' },
      body: '',
      charCount: 100,
      estimatedTokens: 25,
    }],
    issues,
    updates,
    config: {},
  }
}

describe('formatReport', () => {
  it('includes report header', () => {
    const md = formatReport(mockReport())
    assert.ok(md.includes('Skill Manager Report'))
    assert.ok(md.includes('1 skills scanned'))
  })

  it('includes skills table with description and source', () => {
    const md = formatReport(mockReport())
    assert.ok(md.includes('| Skill | Description | Source | Tokens |'))
    assert.ok(md.includes('test-skill'))
    assert.ok(md.includes('manual'))
  })

  it('shows structure issues section when issues exist', () => {
    const issues = [{
      skillName: 'bad-skill',
      checkId: 'STRUCT-002',
      category: 'structure',
      message: 'No frontmatter',
      suggestion: 'Add frontmatter',
    }]
    const md = formatReport(mockReport(issues))
    assert.ok(md.includes('Structure Issues'))
    assert.ok(md.includes('bad-skill'))
  })

  it('hides structure issues section when none exist', () => {
    const md = formatReport(mockReport())
    assert.ok(!md.includes('Structure Issues'))
  })

  it('shows updates section', () => {
    const updates = [{
      skillName: 'old-skill',
      checkId: 'UPDATE-001',
      category: 'updates',
      message: 'Newer version available',
      suggestion: 'Update it',
    }]
    const md = formatReport(mockReport([], updates))
    assert.ok(md.includes('Updates Available'))
    assert.ok(md.includes('old-skill'))
  })
})

describe('formatJson', () => {
  it('returns valid JSON', () => {
    const json = formatJson(mockReport())
    assert.doesNotThrow(() => JSON.parse(json))
  })

  it('includes skills array', () => {
    const parsed = JSON.parse(formatJson(mockReport()))
    assert.equal(parsed.skills.length, 1)
    assert.equal(parsed.skills[0].name, 'test-skill')
  })
})
