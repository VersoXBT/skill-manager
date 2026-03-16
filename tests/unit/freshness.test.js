import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { scanFreshness } from '../../scripts/lib/freshness.js'

function mockSkill(overrides = {}) {
  return {
    name: 'test-skill',
    path: '/fake/SKILL.md',
    dirPath: '/fake/test-skill',
    body: '# Test\n\nClean content.',
    mtime: new Date(),
    frontmatter: { name: 'test-skill', description: 'test' },
    charCount: 100,
    ...overrides,
  }
}

function monthsAgo(months) {
  const date = new Date()
  date.setMonth(date.getMonth() - months)
  return date
}

describe('scanFreshness', () => {
  it('returns no findings for recently modified skill', () => {
    const skills = [mockSkill()]

    const findings = scanFreshness(skills)

    assert.equal(findings.length, 0)
  })

  it('FRESH-001: detects stale skill', () => {
    const skills = [mockSkill({ mtime: monthsAgo(8) })]

    const findings = scanFreshness(skills)

    const stale = findings.find(f => f.checkId === 'FRESH-001')
    assert.ok(stale, 'should find FRESH-001')
    assert.equal(stale.severity, 'medium')
    assert.match(stale.message, /not modified in/)
  })

  it('FRESH-002: detects deprecated model reference (text-davinci-003)', () => {
    const skills = [mockSkill({
      body: '# Models\n\nUse text-davinci-003 for completions.',
    })]

    const findings = scanFreshness(skills)

    const dep = findings.find(f => f.checkId === 'FRESH-002')
    assert.ok(dep, 'should find FRESH-002')
    assert.equal(dep.severity, 'low')
    assert.match(dep.message, /deprecated OpenAI model/)
  })

  it('FRESH-002: detects deprecated Claude model (claude-2)', () => {
    const skills = [mockSkill({
      body: '# Models\n\nUse claude-2 for reasoning tasks.',
    })]

    const findings = scanFreshness(skills)

    const dep = findings.find(f => f.checkId === 'FRESH-002')
    assert.ok(dep, 'should find FRESH-002')
    assert.match(dep.message, /deprecated Claude 2/)
  })

  it('returns no findings for clean skill with no deprecated patterns', () => {
    const skills = [mockSkill({
      body: '# Clean Skill\n\nNo deprecated references here.',
    })]

    const findings = scanFreshness(skills)

    assert.equal(findings.length, 0)
  })

  it('skips ignored skills', () => {
    const skills = [mockSkill({
      name: 'stale-ignored',
      mtime: monthsAgo(12),
      body: '# Old\n\nUse text-davinci-003 for everything.',
    })]
    const config = { ignoredSkills: ['stale-ignored'] }

    const findings = scanFreshness(skills, config)

    assert.equal(findings.length, 0)
  })

  it('reports correct line number for deprecation match', () => {
    const skills = [mockSkill({
      body: '# Header\n\nSome intro.\n\nUse text-davinci-003 here.',
    })]

    const findings = scanFreshness(skills)

    const dep = findings.find(f => f.checkId === 'FRESH-002')
    assert.ok(dep, 'should find FRESH-002')
    assert.equal(dep.meta.line, 5, 'text-davinci-003 is on line 5 of the body')
    assert.equal(dep.meta.file, 'SKILL.md')
  })
})
