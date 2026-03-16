import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { FixtureBuilder } from '../helpers/fixture-builder.js'
import { discoverSkills } from '../../scripts/lib/discover.js'
import { checkStructure } from '../../scripts/lib/analyze.js'
import { formatReport } from '../../scripts/lib/report.js'

describe('full pipeline', () => {
  const teardowns = []

  afterEach(async () => {
    for (const fn of teardowns) await fn()
    teardowns.length = 0
  })

  it('clean skill: discovers 1 skill, no issues', async () => {
    const { root, teardown } = await new FixtureBuilder()
      .withSkill('my-skill', {
        frontmatter: {
          name: 'my-skill',
          description: 'A well-formed skill for integration testing purposes',
          version: '1.0.0',
        },
        body: '# My Skill\n\nThis is a well-formed skill.',
      })
      .build()
    teardowns.push(teardown)

    const skills = discoverSkills({ scanPaths: [root] })
    assert.equal(skills.length, 1)

    const issues = checkStructure(skills)
    assert.equal(issues.length, 0)
  })

  it('empty skill: finds STRUCT-001 and STRUCT-002', async () => {
    const { root, teardown } = await new FixtureBuilder()
      .withEmptySkill('bad-skill')
      .build()
    teardowns.push(teardown)

    const skills = discoverSkills({ scanPaths: [root] })
    assert.equal(skills.length, 1)

    const issues = checkStructure(skills)
    const ids = issues.map(i => i.checkId)
    assert.ok(ids.includes('STRUCT-001'), 'empty skill should trigger STRUCT-001')
  })

  it('multiple skills: generates report with all skills', async () => {
    const { root, teardown } = await new FixtureBuilder()
      .withSkill('alpha', {
        frontmatter: { name: 'alpha', description: 'Alpha skill', version: '1.0.0' },
        body: '# Alpha\n\nAlpha content.',
      })
      .withSkill('beta', {
        frontmatter: { name: 'beta', description: 'Beta skill', version: '2.0.0' },
        body: '# Beta\n\nBeta content.',
      })
      .build()
    teardowns.push(teardown)

    const skills = discoverSkills({ scanPaths: [root] })
    assert.equal(skills.length, 2)

    const issues = checkStructure(skills)
    const report = formatReport({ skills, issues, updates: [], config: {} })

    assert.ok(report.includes('Skill Manager Report'))
    assert.ok(report.includes('alpha'))
    assert.ok(report.includes('beta'))
  })

  it('empty directory: zero skills', async () => {
    const { root, teardown } = await new FixtureBuilder()
      .withEmptyDir('not-a-skill')
      .build()
    teardowns.push(teardown)

    const skills = discoverSkills({ scanPaths: [root] })
    assert.equal(skills.length, 0)
  })
})
