import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  saveAudit,
  loadLastAudit,
  clearCache,
  loadUpdateCache,
  saveUpdateCache,
  isUpdateCacheValid,
  UPDATE_CACHE_TTL_MS,
} from '../../scripts/lib/cache.js'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

async function makeTempDir() {
  return mkdtemp(join(tmpdir(), 'skill-manager-cache-test-'))
}

describe('cache', () => {
  const tempDirs = []

  afterEach(async () => {
    for (const dir of tempDirs) {
      await rm(dir, { recursive: true, force: true })
    }
    tempDirs.length = 0
  })

  it('saveAudit + loadLastAudit roundtrip saves and loads correctly', async () => {
    const dataDir = await makeTempDir()
    tempDirs.push(dataDir)

    const report = {
      generatedAt: new Date().toISOString(),
      version: '0.1.0',
      healthScore: 92,
      grade: 'A',
      skills: [],
      findings: [],
      summary: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
      config: {},
    }

    saveAudit(report, { dataDir })
    const loaded = loadLastAudit({ dataDir })

    assert.deepEqual(loaded, report)
  })

  it('loadLastAudit returns null when cache does not exist', async () => {
    const dataDir = await makeTempDir()
    tempDirs.push(dataDir)

    const loaded = loadLastAudit({ dataDir })

    assert.equal(loaded, null)
  })

  it('loadLastAudit returns null for corrupt JSON file', async () => {
    const dataDir = await makeTempDir()
    tempDirs.push(dataDir)

    await writeFile(join(dataDir, 'last-audit.json'), 'not valid json {{{', 'utf8')

    const loaded = loadLastAudit({ dataDir })

    assert.equal(loaded, null)
  })

  it('clearCache removes the cache file', async () => {
    const dataDir = await makeTempDir()
    tempDirs.push(dataDir)

    const report = { healthScore: 100 }
    saveAudit(report, { dataDir })

    // Verify it was saved
    assert.notEqual(loadLastAudit({ dataDir }), null)

    clearCache({ dataDir })

    const loaded = loadLastAudit({ dataDir })
    assert.equal(loaded, null)
  })

  it('clearCache handles already-empty directory', async () => {
    const dataDir = await makeTempDir()
    tempDirs.push(dataDir)

    // Should not throw when there is no cache file
    assert.doesNotThrow(() => clearCache({ dataDir }))
  })
})

describe('update cache', () => {
  it('saveUpdateCache + loadUpdateCache roundtrip', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'skill-manager-test-'))
    const entries = new Map([['owner/repo', { latestSha: 'abc123', latestDate: '2026-03-15', checkedAt: new Date().toISOString() }]])
    saveUpdateCache(entries, { dataDir: dir })
    const loaded = loadUpdateCache({ dataDir: dir })
    assert.equal(loaded.entries.size, 1)
    assert.equal(loaded.entries.get('owner/repo').latestSha, 'abc123')
    await rm(dir, { recursive: true, force: true })
  })

  it('loadUpdateCache returns empty map for missing file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'skill-manager-test-'))
    const loaded = loadUpdateCache({ dataDir: dir })
    assert.equal(loaded.entries.size, 0)
    await rm(dir, { recursive: true, force: true })
  })

  it('loadUpdateCache filters out stale entries', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'skill-manager-test-'))
    const staleDate = new Date(Date.now() - UPDATE_CACHE_TTL_MS - 1000).toISOString()
    const entries = new Map([['owner/repo', { latestSha: 'abc', latestDate: '2026-01-01', checkedAt: staleDate }]])
    saveUpdateCache(entries, { dataDir: dir })
    const loaded = loadUpdateCache({ dataDir: dir })
    assert.equal(loaded.entries.size, 0)
    await rm(dir, { recursive: true, force: true })
  })

  it('isUpdateCacheValid returns true for fresh entry', () => {
    assert.ok(isUpdateCacheValid({ checkedAt: new Date().toISOString() }))
  })

  it('isUpdateCacheValid returns false for stale entry', () => {
    const old = new Date(Date.now() - UPDATE_CACHE_TTL_MS - 1000).toISOString()
    assert.ok(!isUpdateCacheValid({ checkedAt: old }))
  })
})
