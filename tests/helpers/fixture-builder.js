/**
 * Immutable fixture builder for creating temp skill directories in tests.
 * Each method returns a NEW FixtureBuilder (no mutation).
 * Call build() to create the temp dir, teardown() to clean up.
 */

import { mkdtemp, writeFile, mkdir, symlink, rm, utimes, chmod } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'

export class FixtureBuilder {
  #operations

  constructor(operations = []) {
    this.#operations = operations
  }

  /**
   * Add a skill with SKILL.md to the fixture.
   * @param {string} name - Directory name for the skill
   * @param {Object} [opts]
   * @param {Object} [opts.frontmatter] - YAML frontmatter fields
   * @param {string} [opts.body] - Markdown body
   * @param {Array<{name: string, content: string}>} [opts.references] - Reference files
   * @param {Date|string} [opts.mtime] - Custom modification time
   * @returns {FixtureBuilder}
   */
  withSkill(name, opts = {}) {
    return new FixtureBuilder([...this.#operations, async (root) => {
      const skillDir = join(root, name)
      await mkdir(skillDir, { recursive: true })

      const fm = opts.frontmatter ?? { name, description: `Description for ${name}` }
      const body = opts.body ?? `# ${name}\n\nDefault body content for testing.`
      const content = serializeFrontmatter(fm, body)
      const skillPath = join(skillDir, 'SKILL.md')
      await writeFile(skillPath, content, 'utf8')

      if (opts.references) {
        const refDir = join(skillDir, 'references')
        await mkdir(refDir, { recursive: true })
        for (const ref of opts.references) {
          await writeFile(join(refDir, ref.name), ref.content, 'utf8')
        }
      }

      if (opts.mtime) {
        const mtime = new Date(opts.mtime)
        await utimes(skillPath, mtime, mtime)
      }
    }])
  }

  /**
   * Add a raw file at an arbitrary path within a skill directory.
   */
  withFile(skillName, relativePath, content) {
    return new FixtureBuilder([...this.#operations, async (root) => {
      const filePath = join(root, skillName, relativePath)
      await mkdir(dirname(filePath), { recursive: true })
      await writeFile(filePath, content, 'utf8')
    }])
  }

  /**
   * Add an empty SKILL.md (0 bytes).
   */
  withEmptySkill(name) {
    return new FixtureBuilder([...this.#operations, async (root) => {
      const skillDir = join(root, name)
      await mkdir(skillDir, { recursive: true })
      await writeFile(join(skillDir, 'SKILL.md'), '', 'utf8')
    }])
  }

  /**
   * Add a symlink from linkName to targetName within the fixture.
   */
  withSymlink(linkName, targetName) {
    return new FixtureBuilder([...this.#operations, async (root) => {
      await symlink(join(root, targetName), join(root, linkName))
    }])
  }

  /**
   * Add a broken symlink (target does not exist).
   */
  withBrokenSymlink(linkName) {
    return new FixtureBuilder([...this.#operations, async (root) => {
      await symlink(join(root, '__nonexistent_target__'), join(root, linkName))
    }])
  }

  /**
   * Add an empty directory (no SKILL.md).
   */
  withEmptyDir(name) {
    return new FixtureBuilder([...this.#operations, async (root) => {
      await mkdir(join(root, name), { recursive: true })
    }])
  }

  /**
   * Build the fixture: create temp dir, execute all operations.
   * @returns {Promise<{root: string, teardown: () => Promise<void>}>}
   */
  async build() {
    const root = await mkdtemp(join(tmpdir(), 'skill-manager-test-'))
    for (const op of this.#operations) {
      await op(root)
    }
    return {
      root,
      teardown: () => rm(root, { recursive: true, force: true }),
    }
  }
}

/**
 * Serialize frontmatter + body into a SKILL.md string.
 */
function serializeFrontmatter(fm, body) {
  const lines = Object.entries(fm).map(([key, val]) => {
    if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
      const nested = Object.entries(val)
        .map(([k, v]) => `  ${k}: ${JSON.stringify(v)}`)
        .join('\n')
      return `${key}:\n${nested}`
    }
    if (Array.isArray(val)) {
      const items = val.map(v => `  - ${v}`).join('\n')
      return `${key}:\n${items}`
    }
    if (typeof val === 'string' && (val.includes(':') || val.includes('"'))) {
      return `${key}: "${val.replace(/"/g, '\\"')}"`
    }
    return `${key}: ${val}`
  })
  return `---\n${lines.join('\n')}\n---\n\n${body}`
}
