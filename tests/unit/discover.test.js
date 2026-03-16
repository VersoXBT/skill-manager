import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { FixtureBuilder } from '../helpers/fixture-builder.js'
import { discoverSkills } from '../../scripts/lib/discover.js'

describe('discoverSkills', () => {
  let teardown

  afterEach(async () => {
    if (teardown) {
      await teardown()
      teardown = null
    }
  })

  it('discovers skills in a custom scanPaths directory', async () => {
    const fixture = await new FixtureBuilder()
      .withSkill('alpha', {
        frontmatter: { name: 'alpha', description: 'Alpha skill' },
        body: '# Alpha\n\nAlpha body.',
      })
      .build()
    teardown = fixture.teardown

    const skills = discoverSkills({ scanPaths: [fixture.root] })

    assert.equal(skills.length, 1)
    assert.equal(skills[0].name, 'alpha')
  })

  it('returns correct name from frontmatter', async () => {
    const fixture = await new FixtureBuilder()
      .withSkill('dir-name', {
        frontmatter: { name: 'frontmatter-name', description: 'Test skill' },
        body: '# Test',
      })
      .build()
    teardown = fixture.teardown

    const skills = discoverSkills({ scanPaths: [fixture.root] })

    assert.equal(skills[0].name, 'frontmatter-name')
  })

  it('falls back to directory name when frontmatter has no name', async () => {
    const fixture = await new FixtureBuilder()
      .withSkill('my-dir-name', {
        frontmatter: { description: 'No name field here' },
        body: '# Test',
      })
      .build()
    teardown = fixture.teardown

    const skills = discoverSkills({ scanPaths: [fixture.root] })

    assert.equal(skills[0].name, 'my-dir-name')
  })

  it('computes charCount and estimatedTokens correctly', async () => {
    const body = '# Test\n\nSome body content.'
    const frontmatter = { name: 'metrics', description: 'Metrics test' }
    const fixture = await new FixtureBuilder()
      .withSkill('metrics', { frontmatter, body })
      .build()
    teardown = fixture.teardown

    const skills = discoverSkills({ scanPaths: [fixture.root] })
    const skill = skills[0]

    assert.equal(typeof skill.charCount, 'number')
    assert.ok(skill.charCount > 0)
    assert.equal(skill.estimatedTokens, Math.ceil(skill.charCount / 4))
  })

  it('detects symlinks correctly', async () => {
    // Use a name that sorts after the real skill so the real one is seen first
    const fixture = await new FixtureBuilder()
      .withSkill('aaa-real', {
        frontmatter: { name: 'aaa-real', description: 'The real skill' },
        body: '# Real',
      })
      .withSymlink('zzz-link', 'aaa-real')
      .build()
    teardown = fixture.teardown

    // Scan both entries -- real dir first (aaa-real), then symlink (zzz-link).
    // The symlink resolves to the same real path, so it is deduped.
    // The surviving entry is the real one, which was collected first.
    const skills = discoverSkills({ scanPaths: [fixture.root] })

    assert.equal(skills.length, 1)
    assert.equal(skills[0].isSymlink, false)
  })

  it('skips broken symlinks', async () => {
    const fixture = await new FixtureBuilder()
      .withSkill('good-skill', {
        frontmatter: { name: 'good-skill', description: 'A good skill' },
        body: '# Good',
      })
      .withBrokenSymlink('bad-link')
      .build()
    teardown = fixture.teardown

    const skills = discoverSkills({ scanPaths: [fixture.root] })

    assert.equal(skills.length, 1)
    assert.equal(skills[0].name, 'good-skill')
  })

  it('skips empty directories', async () => {
    const fixture = await new FixtureBuilder()
      .withSkill('valid-skill', {
        frontmatter: { name: 'valid-skill', description: 'Valid' },
        body: '# Valid',
      })
      .withEmptyDir('empty-dir')
      .build()
    teardown = fixture.teardown

    const skills = discoverSkills({ scanPaths: [fixture.root] })

    assert.equal(skills.length, 1)
    assert.equal(skills[0].name, 'valid-skill')
  })

  it('returns empty array for nonexistent scanPath', () => {
    const skills = discoverSkills({
      scanPaths: ['/tmp/__nonexistent_skill_manager_path__'],
    })

    assert.deepEqual(skills, [])
  })

  it('sorts results alphabetically by name', async () => {
    const fixture = await new FixtureBuilder()
      .withSkill('charlie', {
        frontmatter: { name: 'charlie', description: 'Charlie skill' },
        body: '# Charlie',
      })
      .withSkill('alpha', {
        frontmatter: { name: 'alpha', description: 'Alpha skill' },
        body: '# Alpha',
      })
      .withSkill('bravo', {
        frontmatter: { name: 'bravo', description: 'Bravo skill' },
        body: '# Bravo',
      })
      .build()
    teardown = fixture.teardown

    const skills = discoverSkills({ scanPaths: [fixture.root] })

    assert.deepEqual(
      skills.map(s => s.name),
      ['alpha', 'bravo', 'charlie'],
    )
  })

  it('filters out ignoredSkills', async () => {
    const fixture = await new FixtureBuilder()
      .withSkill('keep-me', {
        frontmatter: { name: 'keep-me', description: 'Should stay' },
        body: '# Keep',
      })
      .withSkill('drop-me', {
        frontmatter: { name: 'drop-me', description: 'Should be ignored' },
        body: '# Drop',
      })
      .build()
    teardown = fixture.teardown

    const skills = discoverSkills({
      scanPaths: [fixture.root],
      ignoredSkills: ['drop-me'],
    })

    assert.equal(skills.length, 1)
    assert.equal(skills[0].name, 'keep-me')
  })

  it('deduplicates when same skill appears via symlink', async () => {
    const fixture = await new FixtureBuilder()
      .withSkill('original', {
        frontmatter: { name: 'original', description: 'The original skill' },
        body: '# Original',
      })
      .withSymlink('alias', 'original')
      .build()
    teardown = fixture.teardown

    const skills = discoverSkills({ scanPaths: [fixture.root] })

    assert.equal(skills.length, 1)
  })
})
