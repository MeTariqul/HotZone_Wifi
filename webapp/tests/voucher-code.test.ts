import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCode } from '../src/lib/voucher-code.ts';

describe('normalizeCode', () => {
  it('uppercases and trims valid codes', () => {
    assert.equal(normalizeCode(' t-abcd-efgh '), 'T-ABCD-EFGH');
  });

  it('accepts alphanumeric dashed codes 4-32 chars', () => {
    assert.equal(normalizeCode('T-1234-5678'), 'T-1234-5678');
    assert.equal(normalizeCode('ABCD'), 'ABCD');
  });

  it('rejects empty, short, long, and illegal characters', () => {
    assert.equal(normalizeCode(''), null);
    assert.equal(normalizeCode('A'), null);
    assert.equal(normalizeCode('A'.repeat(33)), null);
    assert.equal(normalizeCode('T-AB!D-EFGH'), null);
  });
});
