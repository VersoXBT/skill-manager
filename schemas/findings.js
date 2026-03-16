/**
 * Simple issue/finding factory. Used by updates.js and analyze.js.
 */

/**
 * @param {Object} partial
 * @returns {Readonly<Object>}
 */
export function createFinding(partial) {
  return Object.freeze({
    skillPath: partial.skillPath ?? '',
    skillName: partial.skillName ?? 'unknown',
    checkId: partial.checkId ?? 'UNKNOWN',
    category: partial.category ?? 'structure',
    message: partial.message ?? '',
    suggestion: partial.suggestion ?? null,
    autoFixable: partial.autoFixable ?? false,
    meta: partial.meta ? Object.freeze({ ...partial.meta }) : null,
  })
}
