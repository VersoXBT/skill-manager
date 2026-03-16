/**
 * Cache module for skill-manager. Stores and retrieves audit results.
 * Uses ~/.claude/skill-manager/last-audit.json by default.
 */

import { readFileSync, writeFileSync, mkdirSync, unlinkSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { homedir } from 'node:os'

const SCHEMA_VERSION = 2
const UPDATE_CACHE_FILE = 'update-cache.json'
const UPDATE_CACHE_TTL_MS = 60 * 60 * 1000  // 1 hour

/**
 * Get the default data directory.
 * @param {string} [overrideDir] - Override for testing
 * @returns {string}
 */
export function getDataDir(overrideDir) {
  return overrideDir ?? join(homedir(), '.claude', 'skill-manager')
}

/**
 * Save an audit report to cache.
 * @param {Object} report - AuditReport object
 * @param {Object} [options]
 * @param {string} [options.dataDir] - Override data directory for testing
 */
export function saveAudit(report, options = {}) {
  const dataDir = getDataDir(options.dataDir)
  try {
    mkdirSync(dataDir, { recursive: true })
    const cachePath = join(dataDir, 'last-audit.json')
    const data = {
      schemaVersion: SCHEMA_VERSION,
      savedAt: new Date().toISOString(),
      report,
    }
    writeFileSync(cachePath, JSON.stringify(data, null, 2), 'utf8')
  } catch (error) {
    process.stderr.write(`skill-manager: failed to save cache: ${error.message}\n`)
  }
}

/**
 * Load the last audit report from cache.
 * @param {Object} [options]
 * @param {string} [options.dataDir] - Override data directory for testing
 * @returns {Object|null} - The cached AuditReport, or null if unavailable
 */
export function loadLastAudit(options = {}) {
  const dataDir = getDataDir(options.dataDir)
  const cachePath = join(dataDir, 'last-audit.json')

  try {
    if (!existsSync(cachePath)) return null
    const raw = readFileSync(cachePath, 'utf8')
    const data = JSON.parse(raw)

    if (data.schemaVersion !== SCHEMA_VERSION && data.schemaVersion !== 1) {
      process.stderr.write('skill-manager: cache schema version mismatch, ignoring cached data\n')
      return null
    }

    return data.report ?? null
  } catch {
    return null
  }
}

/**
 * Clear the cache.
 * @param {Object} [options]
 * @param {string} [options.dataDir] - Override data directory for testing
 */
export function clearCache(options = {}) {
  const dataDir = getDataDir(options.dataDir)
  const cachePath = join(dataDir, 'last-audit.json')
  try {
    if (existsSync(cachePath)) {
      unlinkSync(cachePath)
    }
  } catch {
    // Ignore errors on clear
  }
}

/**
 * Load the update cache. Filters out stale entries.
 * @param {Object} [options]
 * @param {string} [options.dataDir] - Override for testing
 * @returns {{ entries: Map<string, {latestSha: string, latestDate: string, checkedAt: string}> }}
 */
export function loadUpdateCache(options = {}) {
  const dataDir = getDataDir(options.dataDir)
  const cachePath = join(dataDir, UPDATE_CACHE_FILE)
  try {
    if (!existsSync(cachePath)) return { entries: new Map() }
    const raw = JSON.parse(readFileSync(cachePath, 'utf8'))
    const entries = new Map()
    for (const [key, val] of Object.entries(raw.entries ?? {})) {
      if (isUpdateCacheValid(val)) {
        entries.set(key, val)
      }
    }
    return { entries }
  } catch {
    return { entries: new Map() }
  }
}

/**
 * Save update cache entries.
 * @param {Map<string, Object>} entries
 * @param {Object} [options]
 * @param {string} [options.dataDir] - Override for testing
 */
export function saveUpdateCache(entries, options = {}) {
  const dataDir = getDataDir(options.dataDir)
  try {
    mkdirSync(dataDir, { recursive: true })
    const cachePath = join(dataDir, UPDATE_CACHE_FILE)
    const obj = {}
    for (const [key, val] of entries) {
      obj[key] = val
    }
    writeFileSync(cachePath, JSON.stringify({ entries: obj }, null, 2), 'utf8')
  } catch {
    // Silently fail on cache write
  }
}

/**
 * Check if an update cache entry is still valid (within TTL).
 * @param {Object} entry
 * @returns {boolean}
 */
export function isUpdateCacheValid(entry) {
  if (!entry?.checkedAt) return false
  return (Date.now() - new Date(entry.checkedAt).getTime()) < UPDATE_CACHE_TTL_MS
}

export { UPDATE_CACHE_TTL_MS }
