/**
 * Pure-JS YAML frontmatter parser. Zero dependencies.
 * Handles: --- delimiters, key: value, quoted strings, folded scalars (>), arrays.
 */

/**
 * Parse YAML frontmatter from markdown content.
 * @param {string} content - Full file content
 * @returns {{ frontmatter: Object, body: string }}
 */
export function parseFrontmatter(content) {
  if (!content || typeof content !== 'string') {
    return { frontmatter: {}, body: content ?? '' }
  }

  const match = content.match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n---/)
  if (!match) {
    return { frontmatter: {}, body: content.trim() }
  }

  const yamlBlock = match[1]
  const body = content.slice(match[0].length).trim()
  const frontmatter = parseYamlBlock(yamlBlock)

  return { frontmatter, body }
}

/**
 * Parse a simple YAML block into a plain object.
 * Supports: key: value, key: "quoted", key: >, nested one-level, arrays with - items
 * @param {string} yaml
 * @returns {Object}
 */
function parseYamlBlock(yaml) {
  const result = {}
  const lines = yaml.split(/\r?\n/)
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Skip empty lines and comments
    if (!line.trim() || line.trim().startsWith('#')) {
      i++
      continue
    }

    // Match top-level key: value
    const keyMatch = line.match(/^([a-zA-Z_-]+)\s*:\s*(.*)$/)
    if (!keyMatch) {
      i++
      continue
    }

    const key = keyMatch[1].trim()
    let rawValue = keyMatch[2].trim()

    // Folded scalar (>)
    if (rawValue === '>' || rawValue === '|') {
      const collected = []
      i++
      while (i < lines.length && (lines[i].startsWith('  ') || lines[i].startsWith('\t') || lines[i].trim() === '')) {
        collected.push(lines[i].trimStart())
        i++
      }
      result[key] = collected.join(rawValue === '>' ? ' ' : '\n').trim()
      continue
    }

    // Nested object (key: with nothing after, followed by indented lines)
    if (rawValue === '') {
      const nextLine = lines[i + 1]
      if (nextLine && (nextLine.startsWith('  ') || nextLine.startsWith('\t'))) {
        // Check if it's an array (- items) or nested object
        const trimmedNext = nextLine.trim()
        if (trimmedNext.startsWith('- ')) {
          // Array
          const items = []
          i++
          while (i < lines.length && (lines[i].startsWith('  ') || lines[i].startsWith('\t'))) {
            const itemMatch = lines[i].trim().match(/^-\s+(.*)$/)
            if (itemMatch) {
              items.push(unquote(itemMatch[1].trim()))
            }
            i++
          }
          result[key] = items
          continue
        }

        // Nested object (one level)
        const nested = {}
        i++
        while (i < lines.length && (lines[i].startsWith('  ') || lines[i].startsWith('\t'))) {
          const nestedMatch = lines[i].trim().match(/^([a-zA-Z_-]+)\s*:\s*(.*)$/)
          if (nestedMatch) {
            nested[nestedMatch[1].trim()] = unquote(nestedMatch[2].trim())
          }
          i++
        }
        result[key] = nested
        continue
      }
    }

    // Array inline [item1, item2]
    if (rawValue.startsWith('[') && rawValue.endsWith(']')) {
      const inner = rawValue.slice(1, -1)
      result[key] = inner.split(',').map(s => unquote(s.trim())).filter(Boolean)
      i++
      continue
    }

    // Simple value
    result[key] = unquote(rawValue)
    i++
  }

  return result
}

/**
 * Remove surrounding quotes from a string value.
 * @param {string} val
 * @returns {string}
 */
function unquote(val) {
  if (!val) return ''
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    return val.slice(1, -1)
  }
  return val
}
