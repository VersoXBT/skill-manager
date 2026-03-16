import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { FixtureBuilder } from '../helpers/fixture-builder.js'
import { discoverSkills } from '../../scripts/lib/discover.js'
import { analyzeStructure } from '../../scripts/lib/analyze.js'
import { estimateTokens } from '../../scripts/lib/tokens.js'
import { createAuditReport } from '../../schemas/findings.js'
import { formatMarkdown } from '../../scripts/lib/report.js'

describe('full pipeline', () => {
  const teardowns = []

  afterEach(async () => {
    for (const fn of teardowns) {
      await fn()
    }
    teardowns.length = 0
  })

  it('clean skill: discovers 1 skill, no critical findings, score >= 80', async () => {
    const { root, teardown } = await new FixtureBuilder()
      .withSkill('my-skill', {
        frontmatter: {
          name: 'my-skill',
          description: 'A well-formed skill for integration testing purposes',
          version: '1.0.0',
        },
        body: '# My Skill\n\nThis is a well-formed skill with proper content for testing.',
      })
      .build()
    teardowns.push(teardown)

    const skills = discoverSkills({ scanPaths: [root] })

    assert.equal(skills.length, 1)
    assert.equal(skills[0].name, 'my-skill')

    const structFindings = analyzeStructure(skills)
    const tokenFindings = estimateTokens(skills)
    const allFindings = [...structFindings, ...tokenFindings]

    const criticals = allFindings.filter(f => f.severity === 'critical')
    assert.equal(criticals.length, 0)

    const report = createAuditReport(skills, allFindings, {})

    assert.ok(report.healthScore >= 80, `Expected score >= 80, got ${report.healthScore}`)
  })

  it('problematic skill (empty, no frontmatter): finds STRUCT-001/002, low score', async () => {
    const { root, teardown } = await new FixtureBuilder()
      .withEmptySkill('bad-skill')
      .build()
    teardowns.push(teardown)

    const skills = discoverSkills({ scanPaths: [root] })

    assert.equal(skills.length, 1)

    const structFindings = analyzeStructure(skills)
    const tokenFindings = estimateTokens(skills)
    const allFindings = [...structFindings, ...tokenFindings]

    const checkIds = allFindings.map(f => f.checkId)
    assert.ok(checkIds.includes('STRUCT-001'), 'Expected STRUCT-001 for empty skill')
    assert.ok(checkIds.includes('STRUCT-002'), 'Expected STRUCT-002 for missing frontmatter')

    const report = createAuditReport(skills, allFindings, {})

    assert.ok(report.healthScore < 80, `Expected score < 80, got ${report.healthScore}`)
  })

  it('multiple skills: discovers all and generates markdown report', async () => {
    const { root, teardown } = await new FixtureBuilder()
      .withSkill('alpha', {
        frontmatter: {
          name: 'alpha',
          description: 'Alpha skill for multi-skill integration test',
          version: '1.0.0',
        },
        body: '# Alpha\n\nAlpha content.',
      })
      .withSkill('beta', {
        frontmatter: {
          name: 'beta',
          description: 'Beta skill for multi-skill integration test',
          version: '2.0.0',
        },
        body: '# Beta\n\nBeta content.',
      })
      .withSkill('gamma', {
        frontmatter: {
          name: 'gamma',
          description: 'Gamma skill for multi-skill integration test',
        },
        body: '# Gamma\n\nGamma content.',
      })
      .build()
    teardowns.push(teardown)

    const skills = discoverSkills({ scanPaths: [root] })

    assert.equal(skills.length, 3)

    const structFindings = analyzeStructure(skills)
    const tokenFindings = estimateTokens(skills)
    const allFindings = [...structFindings, ...tokenFindings]
    const report = createAuditReport(skills, allFindings, {})
    const md = formatMarkdown(report)

    assert.ok(md.includes('Skill Manager Audit Report'))
    assert.ok(md.includes('alpha'))
    assert.ok(md.includes('beta'))
    assert.ok(md.includes('gamma'))
  })

  it('empty directory produces zero skills', async () => {
    const { root, teardown } = await new FixtureBuilder()
      .withEmptyDir('not-a-skill')
      .build()
    teardowns.push(teardown)

    const skills = discoverSkills({ scanPaths: [root] })

    assert.equal(skills.length, 0)
  })
})
