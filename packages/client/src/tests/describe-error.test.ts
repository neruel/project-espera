import { describe, expect, it } from 'vitest';
import { describeError, type TranslateFn } from '../i18n.js';
import { ApiError } from '../services/api.js';

const t: TranslateFn = (key) => `t:${key}`;

describe('describeError', () => {
  it('maps known API error codes to localized messages', () => {
    expect(describeError(t, new ApiError('Invalid API key', 'invalid_credential', 422), 't:fallback')).toBe('t:error.invalid_credential');
    expect(describeError(t, new ApiError('Rate limit exceeded', 'rate_limited', 429), 't:fallback')).toBe('t:error.rate_limited');
  });

  it('never shows the raw English server message for unknown errors', () => {
    expect(describeError(t, new ApiError('Only pending memories can be approved', undefined, 400), 't:memory.actionFailed')).toBe('t:memory.actionFailed');
    expect(describeError(t, new Error('Projects could not be loaded'), 't:projects.error.load')).toBe('t:projects.error.load');
    expect(describeError(t, new ApiError('x', 'something_new', 500), 't:fallback')).toBe('t:fallback');
  });

  it('reports network failures as offline', () => {
    expect(describeError(t, new TypeError('Failed to fetch'), 't:fallback')).toBe('t:error.offline');
  });
});
