import { describe, expect, it } from 'vitest';
import { readConfig } from './config.js';

const token = 'onio_pat_test';

describe('readConfig', () => {
  it('rejects a missing token and a token of another kind', () => {
    expect(() => readConfig({})).toThrow('Set ONIO_TOKEN');
    expect(() => readConfig({ ONIO_TOKEN: 'ghp_abc' })).toThrow('must start with onio_pat_');
  });

  it('allows plain http only for localhost', () => {
    expect(readConfig({ ONIO_TOKEN: token, ONIO_API_URL: 'http://localhost:3000/' }).apiUrl).toBe(
      'http://localhost:3000',
    );
    expect(() => readConfig({ ONIO_TOKEN: token, ONIO_API_URL: 'http://example.com' })).toThrow(
      'must use https',
    );
  });
});
