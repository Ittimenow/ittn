import test from 'node:test';
import assert from 'node:assert/strict';
import { releaseConfig } from '../config/release.mjs';
test('staging is the default and cannot accidentally become indexable', () => {
  assert.equal(releaseConfig({}).production, false);
  assert.equal(releaseConfig({ SITE_URL: 'https://example.com' }).production, false);
  assert.throws(() => releaseConfig({ DEPLOY_ENV: 'prod' }));
});
test('production requires an explicit public HTTPS origin', () => {
  for (const SITE_URL of [undefined, 'http://example.com', 'https://localhost', 'https://test.twc1.net', 'https://example.com/path', 'https://user:pass@example.com']) {
    assert.throws(() => releaseConfig({ DEPLOY_ENV: 'production', SITE_URL }));
  }
  assert.equal(releaseConfig({ DEPLOY_ENV: 'production', SITE_URL: 'https://example.com/' }).site, 'https://example.com');
});
