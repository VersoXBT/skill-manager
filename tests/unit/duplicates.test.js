import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  detectDuplicates,
  normalizedLevenshtein,
  jaccardSimilarity,
  headingOverlap,
} from '../../scripts/lib/duplicates.js'

function mockSkill(name, description, body) {
  return {
    name,
    path: `/fake/${name}/SKILL.md`,
    dirPath: `/fake/${name}`,
    frontmatter: { name, description },
    body,
    charCount: body.length,
    estimatedTokens: Math.ceil(body.length / 4),
    mtime: new Date(),
    isSymlink: false,
    symlinkTarget: null,
  }
}

describe('normalizedLevenshtein', () => {
  it('returns 0 for identical strings', () => {
    assert.equal(normalizedLevenshtein('hello', 'hello'), 0)
  })

  it('returns correct distance for similar names', () => {
    const distance = normalizedLevenshtein('agent-browser', 'agentic-browser')

    assert.ok(distance > 0, 'distance should be greater than 0')
    assert.ok(distance < 0.5, 'distance should be less than 0.5 for similar strings')
  })

  it('handles empty strings', () => {
    assert.equal(normalizedLevenshtein('', ''), 0)
    assert.equal(normalizedLevenshtein('abc', ''), 1)
    assert.equal(normalizedLevenshtein('', 'abc'), 1)
  })
})

describe('jaccardSimilarity', () => {
  it('returns 0 for disjoint sets', () => {
    const similarity = jaccardSimilarity(
      'alpha bravo charlie',
      'delta echo foxtrot',
    )

    assert.equal(similarity, 0)
  })

  it('returns > 0.5 for overlapping descriptions', () => {
    const similarity = jaccardSimilarity(
      'deploy kubernetes cluster infrastructure',
      'deploy kubernetes cluster management',
    )

    assert.ok(similarity > 0.5, `expected > 0.5 but got ${similarity}`)
  })

  it('returns 0 for empty inputs', () => {
    assert.equal(jaccardSimilarity('', ''), 0)
    assert.equal(jaccardSimilarity('hello', ''), 0)
    assert.equal(jaccardSimilarity('', 'hello'), 0)
  })
})

describe('headingOverlap', () => {
  it('returns 1 for identical heading sets', () => {
    const bodyA = '# Setup\n## Config\n### Usage'
    const bodyB = '# Setup\n## Config\n### Usage'

    assert.equal(headingOverlap(bodyA, bodyB), 1)
  })

  it('returns 0 for completely different headings', () => {
    const bodyA = '# Installation\n## Prerequisites'
    const bodyB = '# Deployment\n## Monitoring'

    assert.equal(headingOverlap(bodyA, bodyB), 0)
  })
})

describe('detectDuplicates', () => {
  it('returns empty for single skill', () => {
    const skills = [mockSkill('alpha', 'A skill', '# Alpha\nContent here.')]

    const findings = detectDuplicates(skills)

    assert.equal(findings.length, 0)
  })

  it('DUP-001: detects exact body match', () => {
    const sharedBody = '# Shared\n\nIdentical content across both skills.'
    const skills = [
      mockSkill('skill-a', 'First skill', sharedBody),
      mockSkill('skill-b', 'Second skill', sharedBody),
    ]

    const findings = detectDuplicates(skills)

    assert.ok(findings.length >= 1, 'should have at least one finding')
    const dup = findings.find(f => f.checkId === 'DUP-001')
    assert.ok(dup, 'should find DUP-001')
    assert.equal(dup.severity, 'high')
    assert.match(dup.message, /identical body content/)
  })

  it('DUP-002: detects high name similarity + description overlap', () => {
    const skills = [
      mockSkill(
        'deploy-kubernetes',
        'deploy kubernetes cluster infrastructure management',
        '# Deploy K8s\n\nDeploy steps.',
      ),
      mockSkill(
        'deploy-kubernete',
        'deploy kubernetes cluster infrastructure orchestration',
        '# Deploy Kube\n\nOther deploy steps.',
      ),
    ]

    const findings = detectDuplicates(skills)

    const dup = findings.find(f => f.checkId === 'DUP-002')
    assert.ok(dup, 'should find DUP-002')
    assert.equal(dup.severity, 'medium')
    assert.match(dup.message, /appear to conflict/)
  })

  it('returns no findings for completely different skills', () => {
    const skills = [
      mockSkill(
        'alpha-cooking',
        'recipes and meal planning',
        '# Cooking\n## Recipes\nMake food.',
      ),
      mockSkill(
        'zeta-astronomy',
        'telescope calibration stargazing',
        '# Astronomy\n## Stars\nLook at stars.',
      ),
    ]

    const findings = detectDuplicates(skills)

    assert.equal(findings.length, 0)
  })

  it('skips self-comparison', () => {
    const skill = mockSkill('only', 'the only skill', '# Only\nContent.')
    const skills = [skill]

    const findings = detectDuplicates(skills)

    assert.equal(findings.length, 0)
  })
})
