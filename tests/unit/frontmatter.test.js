import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseFrontmatter } from '../../scripts/lib/frontmatter.js'

describe('parseFrontmatter', () => {
  it('parses simple key:value frontmatter', () => {
    const content = [
      '---',
      'name: my-skill',
      'description: A useful skill',
      'version: 1.0.0',
      '---',
      '',
      '# Body',
    ].join('\n')

    const { frontmatter, body } = parseFrontmatter(content)

    assert.equal(frontmatter.name, 'my-skill')
    assert.equal(frontmatter.description, 'A useful skill')
    assert.equal(frontmatter.version, '1.0.0')
  })

  it('returns empty frontmatter for content with no --- delimiters', () => {
    const content = '# Just a heading\n\nSome paragraph text.'

    const { frontmatter, body } = parseFrontmatter(content)

    assert.deepEqual(frontmatter, {})
    assert.equal(body, content.trim())
  })

  it('handles quoted values with colons', () => {
    const content = [
      '---',
      'description: "value with: colons"',
      '---',
      '',
      'body',
    ].join('\n')

    const { frontmatter } = parseFrontmatter(content)

    assert.equal(frontmatter.description, 'value with: colons')
  })

  it('handles folded scalar with > marker', () => {
    const content = [
      '---',
      'description: >',
      '  This is a long',
      '  description that spans',
      '  multiple lines',
      '---',
      '',
      'body',
    ].join('\n')

    const { frontmatter } = parseFrontmatter(content)

    assert.equal(
      frontmatter.description,
      'This is a long description that spans multiple lines',
    )
  })

  it('handles nested object', () => {
    const content = [
      '---',
      'author:',
      '  name: "John"',
      '---',
      '',
      'body',
    ].join('\n')

    const { frontmatter } = parseFrontmatter(content)

    assert.deepEqual(frontmatter.author, { name: 'John' })
  })

  it('handles inline array', () => {
    const content = [
      '---',
      'tools: [Read, Write, Bash]',
      '---',
      '',
      'body',
    ].join('\n')

    const { frontmatter } = parseFrontmatter(content)

    assert.deepEqual(frontmatter.tools, ['Read', 'Write', 'Bash'])
  })

  it('handles array with dash items', () => {
    const content = [
      '---',
      'keywords:',
      '  - foo',
      '  - bar',
      '---',
      '',
      'body',
    ].join('\n')

    const { frontmatter } = parseFrontmatter(content)

    assert.deepEqual(frontmatter.keywords, ['foo', 'bar'])
  })

  it('returns empty frontmatter for null input', () => {
    const { frontmatter, body } = parseFrontmatter(null)

    assert.deepEqual(frontmatter, {})
    assert.equal(body, '')
  })

  it('returns empty frontmatter for undefined input', () => {
    const { frontmatter, body } = parseFrontmatter(undefined)

    assert.deepEqual(frontmatter, {})
    assert.equal(body, '')
  })

  it('returns empty frontmatter for empty string', () => {
    const { frontmatter, body } = parseFrontmatter('')

    assert.deepEqual(frontmatter, {})
    assert.equal(body, '')
  })

  it('correctly splits body from frontmatter', () => {
    const content = [
      '---',
      'name: test',
      '---',
      '',
      '# Heading',
      '',
      'Paragraph text here.',
    ].join('\n')

    const { frontmatter, body } = parseFrontmatter(content)

    assert.equal(frontmatter.name, 'test')
    assert.equal(body, '# Heading\n\nParagraph text here.')
  })
})
