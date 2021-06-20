/**
 * Change an arbitrary string into an API name. API names:
 * - can only contain underscores and alphanumeric characters
 * - must begin with a letter
 * - must not include spaces
 * - must not end with an underscore
 * - must not contain two consecutive underscores
 * @param {string} label
 * @returns {string}
 */
export function toApiName(label: string): string {
  const safeChars = label.replace(/[^A-Za-z0-9_]/g, '_');
  const noConsecutiveUnderscores = safeChars.replace(/_{2,}/g, '_');
  const startWithLetter = noConsecutiveUnderscores.replace(/^[^A-Za-z]*/g, '');
  return startWithLetter.replace(/_+$/, '');
}
