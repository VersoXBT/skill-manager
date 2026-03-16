#!/usr/bin/env node

/**
 * skill-manager CLI entry point.
 * Usage:
 *   node scripts/index.js check [--fix] [--verbose] [--deep] [--json] [--no-update] [--scan-path <path>]
 *   node scripts/index.js cache [clear|show]
 */

import { loadConfig } from './lib/config.js'
import { discoverSkills } from './lib/discover.js'
import { analyzeStructure } from './lib/analyze.js'
import { estimateTokens } from './lib/tokens.js'
import { formatMarkdown, formatJson } from './lib/report.js'
import { saveAudit, loadLastAudit, clearCache } from './lib/cache.js'
import { createAuditReport } from '../schemas/findings.js'

function parseArgs(argv) {
  const args = argv.slice(2)
  const command = args[0] ?? 'check'
  const flags = {}

  for (let i = 1; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--verbose') flags.verbose = true
    else if (arg === '--deep') flags.deep = true
    else if (arg === '--json') flags.json = true
    else if (arg === '--fix') flags.fix = true
    else if (arg === '--dry-run') flags.dryRun = true
    else if (arg === '--no-cache') flags.noCache = true
    else if (arg === '--no-update') flags.noUpdate = true
    else if (arg === '--scan-path' && args[i + 1]) {
      flags.scanPath = args[++i]
    }
    else if (arg === 'clear' || arg === 'show') flags.subcommand = arg
  }

  return { command, flags }
}

/**
 * Determine if a skill can be modified by --fix.
 * Only user-created, non-symlinked skills are fixable.
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
    if (flags.json) {
      process.stdout.write(JSON.stringify({ error: msg }))
    } else {
      process.stdout.write(msg + '\n')
    }
    return
  }

  // Run all Tier 1 checks (synchronous)
  let findings = []
  try { findings.push(...analyzeStructure(skills, config)) } catch { /* continue */ }
  try { findings.push(...estimateTokens(skills, config)) } catch { /* continue */ }

  try {
    const { detectDuplicates } = await import('./lib/duplicates.js')
    findings.push(...detectDuplicates(skills, config))
  } catch { /* module not loaded */ }

  try {
    const { scanFreshness } = await import('./lib/freshness.js')
    findings.push(...scanFreshness(skills, config))
  } catch { /* module not loaded */ }


  // Async update checking (network dependent)
  if (!flags.noUpdate) {
    try {
      const { checkUpdates } = await import('./lib/updates.js')
      const updateFindings = await checkUpdates(skills, config)
      findings.push(...updateFindings)
    } catch { /* network failure or module not loaded */ }
  }

  const report = createAuditReport(skills, findings, config)
  saveAudit(report)

  // Standard report output
  if (flags.json && !flags.fix) {
    process.stdout.write(formatJson(report))
  } else if (!flags.fix) {
    process.stdout.write(formatMarkdown(report))
  }

  // --fix mode: output fixable findings as JSON for the command to apply
  if (flags.fix) {
    const allFixable = report.findings.filter(f => f.autoFixable)
    const userFixable = allFixable.filter(f => {
      const skill = skills.find(s => s.path === f.skillPath)
      return skill && isFixableSkill(skill)
    })
    const pluginIssues = allFixable.length - userFixable.length

    process.stdout.write(JSON.stringify({
      mode: 'fix',
      report: flags.json ? report : undefined,
      fixable: userFixable,
      totalFindings: report.findings.length,
      fixableCount: userFixable.length,
      pluginIssues,
      healthScore: report.healthScore,
      grade: report.grade,
    }, null, 2))
  }

  if (report.summary.critical > 0) {
    process.exitCode = 2
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
      healthScore: audit.healthScore,
      grade: audit.grade,
      skillCount: audit.skills?.length ?? 0,
      findingCount: audit.findings?.length ?? 0,
    }, null, 2) + '\n')
    return
  }

  process.stdout.write('Usage: node scripts/index.js cache [clear|show]\n')
}

// Main
const { command, flags } = parseArgs(process.argv)

try {
  if (command === 'check') await runCheck(flags)
  else if (command === 'fix') {
    process.stdout.write('The /skill-fix command has been merged into /skill-check --fix\n')
    process.stdout.write('Run: /skill-check --fix\n')
  }
  else if (command === 'cache') runCache(flags)
  else process.stdout.write(`Unknown command: ${command}\nUsage: node scripts/index.js [check|fix|cache]\n`)
} catch (error) {
  process.stderr.write(`skill-manager error: ${error.message}\n`)
  process.exitCode = 1
}
