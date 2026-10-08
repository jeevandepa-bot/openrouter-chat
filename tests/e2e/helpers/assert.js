/**
 * Custom assertion module wrapping node:assert/strict with enhanced error formatting.
 */
const assert = require('node:assert/strict');

function includes(haystack, needle, message) {
  if (typeof haystack === 'string') {
    if (!haystack.includes(needle)) {
      const msg = message || `Expected string to include "${needle}", but got: "${haystack.slice(0, 100)}..."`;
      throw new assert.AssertionError({ message: msg, actual: haystack, expected: needle, operator: 'includes' });
    }
  } else if (Array.isArray(haystack)) {
    const found = haystack.some((item) => {
      try {
        assert.deepStrictEqual(item, needle);
        return true;
      } catch {
        return false;
      }
    });
    if (!found) {
      const msg = message || `Expected array to include item, but it was not found`;
      throw new assert.AssertionError({ message: msg, actual: haystack, expected: needle, operator: 'includes' });
    }
  } else {
    throw new TypeError(`includes() expects string or array, got ${typeof haystack}`);
  }
}

module.exports = {
  ...assert,
  includes,
};
