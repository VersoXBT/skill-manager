import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { checkUpdates, parseGitHubRepo } from '../../scripts/lib/updates.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockPluginSkill(overrides = {}) {
  return {
    name: 'test-skill',
    path: '/fake/SKILL.md',
    dirPath: '/fake/test-skill',
    source: 'plugin-cache',
    sourcePlugin: 'test-plugin',
    frontmatter: {},
    body: '',
    charCount: 100,
    estimatedTokens: 25,
    mtime: new Date(),
    isSymlink: false,
    symlinkTarget: null,
    pluginVersion: null,
    marketplace: 'test-marketplace',
    repositoryUrl: 'https://github.com/owner/repo',
    installedCommitSha: 'aaa111bbb222',
    sourceUrl: null,
    skillFolderHash: null,
    updatedAt: null,
    ...overrides,
  }
}

function mockStandaloneSkill(overrides = {}) {
  return {
    name: 'standalone-skill',
    path: '/fake/SKILL.md',
    dirPath: '/fake/standalone',
    source: 'standalone',
    sourcePlugin: null,
    frontmatter: {},
    body: '',
    charCount: 100,
    estimatedTokens: 25,
    mtime: new Date(),
    isSymlink: false,
    symlinkTarget: null,
    pluginVersion: null,
    marketplace: null,
    repositoryUrl: null,
    installedCommitSha: null,
    sourceUrl: 'https://github.com/author/skills',
    skillFolderHash: 'hash123',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function mockFetcher(sha, date, remaining = 50) {
  return async () => ({
    ok: true,
    headers: { get: (h) => h === 'X-RateLimit-Remaining' ? String(remaining) : null },
    json: async () => [{ sha, commit: { committer: { date } } }],
  })
}

function failingFetcher(status = 500) {
  return async () => ({
    ok: false,
    status,
    headers: { get: () => null },
    json: async () => ({}),
  })
}

// ---------------------------------------------------------------------------
// parseGitHubRepo
// ---------------------------------------------------------------------------

describe('parseGitHubRepo', () => {
  it('parses https GitHub URL', () => {
    const result = parseGitHubRepo('https://github.com/anthropics/claude-plugins-official')

    assert.deepEqual(result, { owner: 'anthropics', repo: 'claude-plugins-official' })
  })

  it('parses URL with .git suffix', () => {
    const result = parseGitHubRepo('https://github.com/obra/superpowers.git')

    assert.deepEqual(result, { owner: 'obra', repo: 'superpowers' })
  })

  it('parses owner/repo shorthand', () => {
    const result = parseGitHubRepo('anthropics/claude-plugins-official')

    assert.deepEqual(result, { owner: 'anthropics', repo: 'claude-plugins-official' })
  })

  it('returns null for non-GitHub URL', () => {
    const result = parseGitHubRepo('https://gitlab.com/foo/bar')

    assert.equal(result, null)
  })

  it('returns null for empty string', () => {
    const result = parseGitHubRepo('')

    assert.equal(result, null)
  })

  it('returns null for null', () => {
    const result = parseGitHubRepo(null)

    assert.equal(result, null)
  })
})

// ---------------------------------------------------------------------------
// checkUpdates
// ---------------------------------------------------------------------------

describe('checkUpdates', () => {
  it('UPDATE-001: detects plugin with newer commit', async () => {
    const skills = [mockPluginSkill({ installedCommitSha: 'aaa111bbb222' })]

    const findings = await checkUpdates(skills, {
      _ghCli: null,
      _fetcher: mockFetcher('ccc333ddd444eee555', '2026-03-15'),
      _updateCache: { entries: new Map() },
    })

    const updateFindings = findings.filter(f => f.checkId === 'UPDATE-001')
    assert.equal(updateFindings.length, 1)
    assert.ok(updateFindings[0].message.includes('updates'))
  })

  it('no finding when plugin is up to date (same SHA prefix)', async () => {
    const skills = [mockPluginSkill({ installedCommitSha: 'aaa111bbb222' })]

    const findings = await checkUpdates(skills, {
      _ghCli: null,
      _fetcher: mockFetcher('aaa111bbb222ccc333ddd444', '2026-03-15'),
      _updateCache: { entries: new Map() },
    })

    const updateFindings = findings.filter(f => f.checkId === 'UPDATE-001')
    assert.equal(updateFindings.length, 0)
  })

  it('UPDATE-001: detects standalone skill with newer commits', async () => {
    const skills = [mockStandaloneSkill({ updatedAt: '2026-01-01T00:00:00Z' })]

    const findings = await checkUpdates(skills, {
      _ghCli: null,
      _fetcher: mockFetcher('newsha123456', '2026-03-15'),
      _updateCache: { entries: new Map() },
    })

    const updateFindings = findings.filter(f => f.checkId === 'UPDATE-001')
    assert.equal(updateFindings.length, 1)
    assert.ok(updateFindings[0].message.includes('newer commits'))
  })

  it('no finding when standalone skill repo has no newer commits', async () => {
    const skills = [mockStandaloneSkill({ updatedAt: '2026-03-15T00:00:00Z' })]

    const findings = await checkUpdates(skills, {
      _ghCli: null,
      _fetcher: mockFetcher('somesha123456', '2026-03-01'),
      _updateCache: { entries: new Map() },
    })

    const updateFindings = findings.filter(f => f.checkId === 'UPDATE-001')
    assert.equal(updateFindings.length, 0)
  })

  it('uses cache when entry is fresh', async () => {
    const skills = [mockPluginSkill({ installedCommitSha: 'aaa111' })]
    let fetchCallCount = 0

    const findings = await checkUpdates(skills, {
      _ghCli: null,
      _fetcher: async () => {
        fetchCallCount++
        return {
          ok: true,
          headers: { get: () => '50' },
          json: async () => [{ sha: 'zzz', commit: { committer: { date: '2026-03-15' } } }],
        }
      },
      _updateCache: {
        entries: new Map([['owner/repo', {
          latestSha: 'xxx999yyy888',
          latestDate: '2026-03-15',
          checkedAt: new Date().toISOString(),
        }]]),
      },
    })

    assert.equal(fetchCallCount, 0)
    // Should still emit UPDATE-001 because cached SHA differs from installed
    const updateFindings = findings.filter(f => f.checkId === 'UPDATE-001')
    assert.equal(updateFindings.length, 1)
  })

  it('UPDATE-002: emits when both gh and fetch fail', async () => {
    const skills = [mockPluginSkill()]

    const findings = await checkUpdates(skills, {
      _ghCli: null,
      _fetcher: failingFetcher(500),
      _updateCache: { entries: new Map() },
    })

    const failFindings = findings.filter(f => f.checkId === 'UPDATE-002')
    assert.equal(failFindings.length, 1)
    assert.ok(failFindings[0].message.includes('Update check failed'))
  })

  it('returns empty for skills with no repo URL', async () => {
    const skills = [mockPluginSkill({ repositoryUrl: null })]

    const findings = await checkUpdates(skills, {
      _ghCli: null,
      _fetcher: mockFetcher('sha123', '2026-03-15'),
      _updateCache: { entries: new Map() },
    })

    assert.equal(findings.length, 0)
  })

  it('returns empty for empty skills array', async () => {
    const findings = await checkUpdates([], {
      _ghCli: null,
      _updateCache: { entries: new Map() },
    })

    assert.equal(findings.length, 0)
  })

  it('groups skills by repo to minimize API calls', async () => {
    let fetchCallCount = 0
    const skills = [
      mockPluginSkill({ name: 'skill-a', installedCommitSha: 'aaa111' }),
      mockPluginSkill({ name: 'skill-b', installedCommitSha: 'aaa111' }),
      mockPluginSkill({ name: 'skill-c', installedCommitSha: 'aaa111' }),
    ]

    await checkUpdates(skills, {
      _ghCli: null,
      _fetcher: async () => {
        fetchCallCount++
        return {
          ok: true,
          headers: { get: () => '50' },
          json: async () => [{ sha: 'newsha999', commit: { committer: { date: '2026-03-15' } } }],
        }
      },
      _updateCache: { entries: new Map() },
    })

    assert.equal(fetchCallCount, 1)
  })

  it('stops after rate limit exhausted', async () => {
    const skillsRepoA = mockPluginSkill({
      name: 'skill-a',
      repositoryUrl: 'https://github.com/owner/repo-a',
      installedCommitSha: 'aaa111',
    })
    const skillsRepoB = mockPluginSkill({
      name: 'skill-b',
      repositoryUrl: 'https://github.com/owner/repo-b',
      installedCommitSha: 'bbb222',
    })

    // First call fails with low rate limit, triggering rate limit exhaustion
    const findings = await checkUpdates([skillsRepoA, skillsRepoB], {
      _ghCli: null,
      _fetcher: async () => ({
        ok: false,
        status: 403,
        headers: { get: (h) => h === 'X-RateLimit-Remaining' ? '0' : null },
        json: async () => ({}),
      }),
      _updateCache: { entries: new Map() },
    })

    // Both repos should get UPDATE-002 findings
    const rateLimitFindings = findings.filter(f => f.checkId === 'UPDATE-002')
    assert.ok(rateLimitFindings.length >= 2)
  })
})
