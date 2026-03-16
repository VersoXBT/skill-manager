/**
 * Report generator for skill-manager.
 * Formats audit results as markdown or JSON.
 */

import { computeHealthScore, computeGrade } from '../../schemas/findings.js'

/**
 * Format an audit report as markdown.
 * @param {Object} report - AuditReport object
 * @returns {string}
 */
export function formatMarkdown(report) {
  const lines = []

  lines.push('# Skill Manager Audit Report')
  lines.push('')
  lines.push(`Generated: ${report.generatedAt} | Skills scanned: ${report.skills.length} | Issues: ${totalIssues(report.summary)}`)
  lines.push('')

  // Health Score
  lines.push(`## Health Score: ${report.healthScore}/100 (${report.grade})`)
  lines.push('')
  lines.push(healthBar(report.healthScore))
  lines.push('')

  // Summary
  lines.push('## Summary')
  lines.push('')
  lines.push('| Severity | Count |')
  lines.push('|----------|-------|')
  for (const sev of ['critical', 'high', 'medium', 'low', 'info']) {
    const count = report.summary[sev] ?? 0
    if (count > 0) {
      lines.push(`| ${sev} | ${count} |`)
    }
  }
  lines.push('')

  // Skills Inventory
  lines.push('## Skills Inventory')
  lines.push('')
  lines.push('| Skill | Source | Tokens | Issues |')
  lines.push('|-------|--------|--------|--------|')
  for (const skill of report.skills) {
    const issueCount = report.findings.filter(f => f.skillName === skill.name).length
    lines.push(`| ${skill.name} | ${skill.source} | ~${skill.estimatedTokens} | ${issueCount} |`)
  }
  lines.push('')

  // Findings by severity
  const grouped = groupBySeverity(report.findings)
  for (const sev of ['critical', 'high', 'medium', 'low', 'info']) {
    const findings = grouped[sev]
    if (!findings || findings.length === 0) continue

    lines.push(`## ${capitalize(sev)} Issues`)
    lines.push('')
    for (const f of findings) {
      lines.push(`- **[${f.checkId}]** ${f.skillName}: ${f.message}`)
      if (f.suggestion) {
        lines.push(`  - Fix: ${f.suggestion}`)
      }
    }
    lines.push('')
  }

  // Token Budget
  const tokenCategories = categorizeTokens(report.skills)
  if (Object.keys(tokenCategories).length > 0) {
    lines.push('## Token Budget Overview')
    lines.push('')
    lines.push('| Category | Skills | Total Tokens |')
    lines.push('|----------|--------|--------------|')
    for (const [cat, data] of Object.entries(tokenCategories)) {
      lines.push(`| ${cat} | ${data.count} | ~${data.tokens} |`)
    }
    lines.push('')
    lines.push('> Token estimates use charCount/4 approximation (+/-20% variance)')
    lines.push('')
  }

  // Updates Available
  const updateFindings = report.findings.filter(f => f.category === 'updates' && f.checkId === 'UPDATE-001')
  if (updateFindings.length > 0) {
    lines.push('## Updates Available')
    lines.push('')
    for (const f of updateFindings) {
      lines.push(`- **${f.skillName}**: ${f.message}`)
      if (f.suggestion) {
        lines.push(`  - ${f.suggestion}`)
      }
    }
    lines.push('')
  }

  // Update check failures (verbose only)
  if (report.config?.verbose) {
    const updateFailures = report.findings.filter(f => f.category === 'updates' && f.checkId === 'UPDATE-002')
    if (updateFailures.length > 0) {
      lines.push('## Update Check Failures')
      lines.push('')
      for (const f of updateFailures) {
        lines.push(`- ${f.skillName}: ${f.message}`)
      }
      lines.push('')
    }
  }

  // Footer
  lines.push('---')
  lines.push('Run `/skill-check --deep` for LLM-powered deep analysis')
  lines.push('Run `/skill-check --fix` to apply recommended fixes')
  lines.push('Run `/skill-check --no-update` to skip update checks (offline mode)')

  return lines.join('\n')
}

/**
 * Format an audit report as JSON.
 * @param {Object} report
 * @returns {string}
 */
export function formatJson(report) {
  return JSON.stringify(report, null, 2)
}

function totalIssues(summary) {
  return Object.values(summary).reduce((a, b) => a + b, 0)
}

function healthBar(score) {
  const filled = Math.round(score / 5)
  const empty = 20 - filled
  return `[${'#'.repeat(filled)}${'-'.repeat(empty)}] ${score}/100`
}

function groupBySeverity(findings) {
  const groups = {}
  for (const f of findings) {
    const sev = f.severity
    if (!groups[sev]) groups[sev] = []
    groups[sev].push(f)
  }
  return groups
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function categorizeTokens(skills) {
  const categories = {}
  for (const skill of skills) {
    const tokens = skill.estimatedTokens ?? 0
    let cat
    if (tokens < 2000) cat = 'light'
    else if (tokens < 8000) cat = 'moderate'
    else if (tokens < 20000) cat = 'heavy'
    else cat = 'bloated'

    if (!categories[cat]) categories[cat] = { count: 0, tokens: 0 }
    categories[cat].count++
    categories[cat].tokens += tokens
  }
  return categories
}
