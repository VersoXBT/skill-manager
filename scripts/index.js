#!/usr/bin/env node

/**
 * skill-manager CLI.
 * Usage:
 *   node scripts/index.js check [--fix] [--json] [--no-update] [--scan-path <path>]
 *   node scripts/index.js cache [clear|show]
 */

import { loadConfig } from './lib/config.js'
import { discoverSkills } from './lib/discover.js'
import { checkStructure } from './lib/analyze.js'
import { formatReport, formatJson } from './lib/report.js'
import { saveAudit, loadLastAudit, clearCache } from './lib/cache.js'

function parseArgs(argv) {
  const args = argv.slice(2)
  const command = args[0] ?? 'check'
  const flags = {}

  for (let i = 1; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--json') flags.json = true
    else if (arg === '--fix') flags.fix = true
    else if (arg === '--no-update') flags.noUpdate = true
    else if (arg === '--verbose') flags.verbose = true
    else if (arg === '--scan-path' && args[i + 1]) {
      flags.scanPath = args[++i]
    }
    else if (arg === 'clear' || arg === 'show') flags.subcommand = arg
  }

  return { command, flags }
}

/**
 * Only user-created, non-symlinked skills can be fixed.
 */
function isFixableSkill(skill) {
  if (skill.source === 'plugin-cache') return false
  if (skill.source === 'plugin-marketplace') return false
  if (skill.sourcePlugin) return false
  if (skill.sourceUrl) return false
  if (skill.source === 'user-manual' && !skill.isSymlink) return true
  if (skill.source === 'project') return true
  return false
}

async function runCheck(flags) {
  const config = loadConfig(flags)
  const scanConfig = config.scanPath
    ? { ...config, scanPaths: [config.scanPath] }
    : config

  const skills = discoverSkills(scanConfig)

  if (skills.length === 0) {
    const msg = 'No skills found. Check your installation or use --scan-path.'
    process.stdout.write(flags.json ? JSON.stringify({ error: msg }) : msg + '\n')
    return
  }

  // Structure checks
  const issues = checkStructure(skills, config)

  // Update checks
  let updates = []
  if (!flags.noUpdate) {
    try {
      const { checkUpdates } = await import('./lib/updates.js')
      updates = await checkUpdates(skills, config)
    } catch { /* network or module failure */ }
  }

  const report = { skills, issues, updates, config }

  // Standard output
  if (flags.json && !flags.fix) {
    process.stdout.write(formatJson(report))
  } else if (!flags.fix) {
    process.stdout.write(formatReport(report))
  }

  // Fix mode
  if (flags.fix) {
    const fixable = issues.filter(i => i.autoFixable)
    const userFixable = fixable.filter(i => {
      const skill = skills.find(s => s.path === i.skillPath)
      return skill && isFixableSkill(skill)
    })
    const pluginIssues = fixable.length - userFixable.length

    process.stdout.write(JSON.stringify({
      mode: 'fix',
      report: flags.json ? report : undefined,
      fixable: userFixable,
      totalIssues: issues.length,
      fixableCount: userFixable.length,
      pluginIssues,
    }, null, 2))
  }
}

function runCache(flags) {
  if (flags.subcommand === 'clear') {
    clearCache()
    process.stdout.write('Cache cleared.\n')
    return
  }

  if (flags.subcommand === 'show') {
    const audit = loadLastAudit()
    if (!audit) {
      process.stdout.write('No cached audit found.\n')
      return
    }
    process.stdout.write(JSON.stringify({
      generatedAt: audit.generatedAt,
      skillCount: audit.skills?.length ?? 0,
      issueCount: audit.issues?.length ?? 0,
    }, null, 2) + '\n')
    return
  }

  process.stdout.write('Usage: node scripts/index.js cache [clear|show]\n')
}

// Main
const { command, flags } = parseArgs(process.argv)

try {
  if (command === 'check') await runCheck(flags)
  else if (command === 'cache') runCache(flags)
  else process.stdout.write(`Unknown command: ${command}\n`)
} catch (error) {
  process.stderr.write(`skill-manager error: ${error.message}\n`)
  process.exitCode = 1
}
