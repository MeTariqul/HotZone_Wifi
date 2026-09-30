import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEVICE_COOKIE,
  DEVICE_COOKIE_MAX_AGE_SECONDS,
  deviceCookieOptions,
  isValidDeviceId,
  issueDeviceId,
} from '../src/lib/device.ts';

describe('device identity', () => {
  it('issues a valid UUID', () => {
    const id = issueDeviceId();
    assert.equal(isValidDeviceId(id), true);
    assert.equal(id.length, 36);
  });

  it('rejects malformed ids', () => {
    assert.equal(isValidDeviceId(null), false);
    assert.equal(isValidDeviceId(''), false);
    assert.equal(isValidDeviceId('not-a-uuid'), false);
    assert.equal(isValidDeviceId('12345678-1234-1234-1234-123456789012'.toUpperCase()), true);
  });

  it('cookie options are long-lived http-only same-site', () => {
    const opts = deviceCookieOptions();
    assert.equal(opts.httpOnly, true);
    assert.equal(opts.sameSite, 'lax');
    assert.equal(opts.path, '/');
    assert.equal(opts.maxAge, DEVICE_COOKIE_MAX_AGE_SECONDS);
    assert.equal(DEVICE_COOKIE, 'hz_device');
  });
});
