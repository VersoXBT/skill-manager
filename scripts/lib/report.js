/**
 * Report generator for skill-manager.
 * Outputs a clean inventory + issues list. Claude handles presentation.
 */

const MARKETPLACE_LABELS = {
  'claude-plugins-official': 'official',
  'everything-claude-code': 'everything-cc',
  'superpowers-marketplace': 'superpowers',
  'claude-initial-setup': 'claude-setup',
}

/** Extract short GitHub repo link (user/repo) from a URL. */
function extractRepoShort(url) {
  if (!url) return null
  const match = url.match(/github\.com\/([^/]+\/[^/]+?)(?:\.git)?(?:\/|$)/)
  return match ? match[1] : null
}

/** Format source label for display. */
function formatSource(skill) {
  if (skill.source === 'user-manual') return 'manual'
  if (skill.source === 'standalone') return 'standalone'
  if (skill.source === 'project') return 'project'
  const mp = skill.marketplace
  if (mp && MARKETPLACE_LABELS[mp]) return MARKETPLACE_LABELS[mp]
  if (mp) return mp.replace(/-marketplace$/, '')
  if (skill.sourcePlugin) return skill.sourcePlugin
  return 'plugin'
}

/** Format repo short link for non-plugin/non-official skills. */
function formatRepo(skill) {
  if (skill.source === 'plugin-cache' || skill.source === 'plugin-marketplace') return ''
  const repo = extractRepoShort(skill.sourceUrl)
  return repo ?? ''
}

/**
 * Format the full report as markdown.
 * @param {Object} report - { skills, issues, updates }
 * @returns {string}
 */
export function formatReport(report) {
  const { skills, issues, updates } = report
  const lines = []

  lines.push(`# Skill Manager Report`)
  lines.push('')
  lines.push(`${skills.length} skills scanned`)
  lines.push('')

  // Skills Inventory
  lines.push('## Skills')
  lines.push('')
  lines.push('| Skill | Description | Source | Repo | Tokens |')
  lines.push('|-------|-------------|--------|------|--------|')
  for (const skill of skills) {
    const desc = skill.frontmatter?.description ?? ''
    const truncated = desc.length > 60 ? desc.slice(0, 57) + '...' : desc
    const source = formatSource(skill)
    const repo = formatRepo(skill)
    lines.push(`| ${skill.name} | ${truncated} | ${source} | ${repo} | ~${skill.estimatedTokens} |`)
  }
  lines.push('')

  // Structure Issues
  const structIssues = issues.filter(i => i.category === 'structure')
  if (structIssues.length > 0) {
    lines.push('## Structure Issues')
    lines.push('')
    for (const issue of structIssues) {
      lines.push(`- **${issue.skillName}**: ${issue.message}`)
      if (issue.suggestion) {
        lines.push(`  - Fix: ${issue.suggestion}`)
      }
    }
    lines.push('')
  }

  // Updates
  const updateIssues = updates.filter(u => u.checkId === 'UPDATE-001')
  if (updateIssues.length > 0) {
    lines.push('## Updates Available')
    lines.push('')
    for (const u of updateIssues) {
      lines.push(`- **${u.skillName}**: ${u.message}`)
      if (u.suggestion) lines.push(`  - ${u.suggestion}`)
    }
    lines.push('')
  }

  lines.push('---')
  lines.push('Run `/skill-check --fix` to fix structural issues')
  lines.push('Run `/skill-check --no-update` to skip update checks')

  return lines.join('\n')
}

/**
 * Format as JSON.
 * @param {Object} report
 * @returns {string}
 */
export function formatJson(report) {
  return JSON.stringify(report, null, 2)
}
