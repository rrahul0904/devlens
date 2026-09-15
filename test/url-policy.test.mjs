import test from 'node:test';
import assert from 'node:assert/strict';
import { isPrivateAddress, validateExternalUrl } from '../src/url-policy.mjs';

test('private and loopback IPv4 ranges are blocked', () => {
  for (const address of ['127.0.0.1', '10.2.3.4', '192.168.1.20', '172.16.0.1', '169.254.1.2']) {
    assert.equal(isPrivateAddress(address), true, address);
  }
  assert.equal(isPrivateAddress('8.8.8.8'), false);
});

test('localhost and non-http schemes are rejected', async () => {
  await assert.rejects(() => validateExternalUrl('http://localhost:3000'), /blocked/i);
  await assert.rejects(() => validateExternalUrl('file:///etc/passwd'), /Only http/i);
});

test('public host is accepted when DNS resolves publicly', async () => {
  const fakeLookup = async () => [{ address: '93.184.216.34', family: 4 }];
  const url = await validateExternalUrl('https://example.com/docs', fakeLookup);
  assert.equal(url.hostname, 'example.com');
});

test('DNS rebinding-style private resolution is rejected', async () => {
  const fakeLookup = async () => [{ address: '10.0.0.8', family: 4 }];
  await assert.rejects(() => validateExternalUrl('https://looks-public.example', fakeLookup), /blocked network/i);
});
