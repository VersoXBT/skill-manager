/**
 * Update checker for installed plugins and standalone skills.
 * Compares installed versions against latest GitHub commits.
 * Zero npm dependencies -- uses gh CLI or native fetch.
 */

import { execSync } from 'node:child_process'
import { createFinding } from '../../schemas/findings.js'
import { loadUpdateCache, saveUpdateCache, isUpdateCacheValid } from './cache.js'

/**
 * Parse a GitHub URL or owner/repo shorthand into { owner, repo }.
 * @param {string} url
 * @returns {{ owner: string, repo: string } | null}
 */
export function parseGitHubRepo(url) {
  if (!url || typeof url !== 'string') return null
  const httpsMatch = url.match(/github\.com\/([^/\s]+)\/([^/\s.]+?)(?:\.git)?(?:\/|$)/)
  if (httpsMatch) return { owner: httpsMatch[1], repo: httpsMatch[2] }
  const shortMatch = url.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/)
  if (shortMatch) return { owner: shortMatch[1], repo: shortMatch[2] }
  return null
}

// ---------------------------------------------------------------------------
// GitHub API layer
// ---------------------------------------------------------------------------

/** @param {string} owner @param {string} repo @param {Function|null|undefined} ghCliOverride */
function tryGhCli(owner, repo, ghCliOverride) {
  if (ghCliOverride === null) return null
  try {
    const cmd = `gh api repos/${owner}/${repo}/commits?per_page=1 --jq '.[0] | {sha: .sha, date: .commit.committer.date}'`
    const result = ghCliOverride
      ? ghCliOverride(cmd)
      : execSync(cmd, { timeout: 10000, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] })
    return JSON.parse(result.trim())
  } catch {
    return null
  }
}

/** @param {string} owner @param {string} repo @param {Function|undefined} fetchFn */
async function tryFetch(owner, repo, fetchFn) {
  const doFetch = fetchFn ?? globalThis.fetch
  if (!doFetch) return { data: null, rateLimitRemaining: null }
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    const res = await doFetch(
      `https://api.github.com/repos/${owner}/${repo}/commits?per_page=1`,
      {
        signal: controller.signal,
        headers: { 'Accept': 'application/vnd.github+json', 'User-Agent': 'skill-manager' },
      },
    )
    clearTimeout(timeout)
    const rateLimitRemaining = parseInt(res.headers?.get?.('X-RateLimit-Remaining') ?? '-1', 10)
    if (!res.ok) {
      return { data: null, rateLimitRemaining, status: res.status }
    }
    const json = await res.json()
    const commit = json[0]
    if (!commit) return { data: null, rateLimitRemaining }
    return {
      data: { sha: commit.sha, date: commit.commit?.committer?.date ?? null },
      rateLimitRemaining,
    }
  } catch {
    return { data: null, rateLimitRemaining: null }
  }
}

async function getLatestCommit(owner, repo, config) {
  const ghResult = tryGhCli(owner, repo, config._ghCli)
  if (ghResult?.sha) return { data: ghResult, source: 'gh' }
  const fetchResult = await tryFetch(owner, repo, config._fetcher)
  return {
    data: fetchResult.data,
    source: 'fetch',
    rateLimitRemaining: fetchResult.rateLimitRemaining,
    status: fetchResult.status,
  }
}

// ---------------------------------------------------------------------------
// Finding helpers
// ---------------------------------------------------------------------------

function emitPluginUpdateFindings(info, cacheEntry, findings) {
  if (!info.installedCommitSha) return
  const installed = info.installedCommitSha.toLowerCase()
  const latest = cacheEntry.latestSha.toLowerCase()
  if (latest.startsWith(installed) || installed.startsWith(latest)) return

  for (const skill of info.skills) {
    const pluginName = skill.sourcePlugin ?? skill.name
    findings.push(createFinding({
      skillPath: skill.path,
      skillName: skill.name,
      checkId: 'UPDATE-001',
      severity: 'low',
      category: 'updates',
      message: `Plugin "${pluginName}" may have updates (installed: ${installed.slice(0, 12)}, latest: ${latest.slice(0, 12)})`,
      suggestion: `Run: claude plugin update ${pluginName}`,
      meta: { pluginName, installedSha: installed, latestSha: latest, latestDate: cacheEntry.latestDate },
    }))
  }
}

function emitStandaloneUpdateFindings(info, cacheEntry, findings) {
  for (const skill of info.skills) {
    const skillUpdatedAt = skill.updatedAt ? new Date(skill.updatedAt) : null
    const latestDate = cacheEntry.latestDate ? new Date(cacheEntry.latestDate) : null
    if (!skillUpdatedAt || !latestDate) return
    if (latestDate <= skillUpdatedAt) return

    findings.push(createFinding({
      skillPath: skill.path,
      skillName: skill.name,
      checkId: 'UPDATE-001',
      severity: 'info',
      category: 'updates',
      message: `Skill "${skill.name}" source repo has newer commits (last updated: ${skillUpdatedAt.toISOString().slice(0, 10)}, latest: ${latestDate.toISOString().slice(0, 10)})`,
      suggestion: 'Consider updating this skill to get the latest version.',
      meta: { latestSha: cacheEntry.latestSha, latestDate: cacheEntry.latestDate, skillUpdatedAt: skill.updatedAt },
    }))
  }
}

// ---------------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------------

function emitRateLimitFinding(skill, findings, message) {
  findings.push(createFinding({
    skillPath: skill.path,
    skillName: skill.name,
    checkId: 'UPDATE-002',
    severity: 'info',
    category: 'updates',
    message,
  }))
}

/**
 * Check if installed plugins and standalone skills have newer versions on GitHub.
 * @param {import('../../schemas/findings.js').SkillInfo[]} skills
 * @param {Object} [config]
 * @returns {Promise<import('../../schemas/findings.js').Finding[]>}
 */
export async function checkUpdates(skills, config = {}) {
  const findings = []
  const cache = config._updateCache ?? loadUpdateCache()
  const newCacheEntries = new Map(cache.entries)
  let rateLimitExhausted = false
  let consecutiveFailures = 0

  // Group plugin skills by their source repo
  const pluginRepos = new Map()
  const standaloneRepos = new Map()

  for (const skill of skills) {
    if (skill.source === 'plugin-cache' || skill.source === 'plugin-marketplace') {
      const repoUrl = skill.repositoryUrl
      if (!repoUrl) continue
      const parsed = parseGitHubRepo(repoUrl)
      if (!parsed) continue
      const key = `${parsed.owner}/${parsed.repo}`
      if (!pluginRepos.has(key)) {
        pluginRepos.set(key, { ...parsed, skills: [], installedCommitSha: skill.installedCommitSha })
      }
      pluginRepos.get(key).skills.push(skill)
    } else if (skill.sourceUrl) {
      const parsed = parseGitHubRepo(skill.sourceUrl)
      if (!parsed) continue
      const key = `${parsed.owner}/${parsed.repo}`
      if (!standaloneRepos.has(key)) {
        standaloneRepos.set(key, { ...parsed, skills: [] })
      }
      standaloneRepos.get(key).skills.push(skill)
    }
  }

  // Check plugin repos (sequential for rate-limit safety)
  for (const [repoKey, info] of pluginRepos) {
    if (rateLimitExhausted) {
      for (const skill of info.skills) {
        emitRateLimitFinding(skill, findings, 'GitHub API rate limit reached. Try again later or install gh CLI.')
      }
      continue
    }

    const cached = newCacheEntries.get(repoKey)
    if (cached && isUpdateCacheValid(cached)) {
      emitPluginUpdateFindings(info, cached, findings)
      continue
    }

    const result = await getLatestCommit(info.owner, info.repo, config)
    if (result.rateLimitRemaining !== null && result.rateLimitRemaining < 5) {
      rateLimitExhausted = true
    }
    if (result.data) {
      consecutiveFailures = 0
      const entry = { latestSha: result.data.sha, latestDate: result.data.date, checkedAt: new Date().toISOString() }
      newCacheEntries.set(repoKey, entry)
      emitPluginUpdateFindings(info, entry, findings)
    } else {
      consecutiveFailures++
      if (consecutiveFailures >= 3) {
        rateLimitExhausted = true
      }
      const reason = result.status === 404 ? 'Repository not found'
        : result.status === 403 ? 'Rate limit exceeded'
        : 'Network error or timeout'
      for (const skill of info.skills) {
        emitRateLimitFinding(skill, findings, `Update check failed for ${repoKey}: ${reason}`)
      }
    }
  }

  // Check standalone repos (compare by date, not SHA)
  for (const [repoKey, info] of standaloneRepos) {
    if (rateLimitExhausted) {
      for (const skill of info.skills) {
        emitRateLimitFinding(skill, findings, 'GitHub API rate limit reached.')
      }
      continue
    }

    const cached = newCacheEntries.get(repoKey)
    if (cached && isUpdateCacheValid(cached)) {
      emitStandaloneUpdateFindings(info, cached, findings)
      continue
    }

    const result = await getLatestCommit(info.owner, info.repo, config)
    if (result.rateLimitRemaining !== null && result.rateLimitRemaining < 5) {
      rateLimitExhausted = true
    }
    if (result.data) {
      consecutiveFailures = 0
      const entry = { latestSha: result.data.sha, latestDate: result.data.date, checkedAt: new Date().toISOString() }
      newCacheEntries.set(repoKey, entry)
      emitStandaloneUpdateFindings(info, entry, findings)
    } else {
      consecutiveFailures++
      if (consecutiveFailures >= 3) {
        rateLimitExhausted = true
      }
      for (const skill of info.skills) {
        emitRateLimitFinding(skill, findings, `Update check failed for ${repoKey}`)
      }
    }
  }

  // Persist updated cache (skip if caller injected their own)
  if (!config._updateCache) {
    saveUpdateCache(newCacheEntries)
  }

  return findings
}
