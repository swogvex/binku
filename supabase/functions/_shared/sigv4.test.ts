import { webcrypto } from 'node:crypto';

import { presign } from './sigv4';

// jest-expo's environment has no WebCrypto; Deno and Node do.
beforeAll(() => {
  if (!globalThis.crypto?.subtle) Object.defineProperty(globalThis, 'crypto', { value: webcrypto });
});

const base = {
  accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
  secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
  region: 'us-east-1',
  date: new Date('2013-05-24T00:00:00Z'),
};

test('matches the presigned GET example in the AWS S3 docs', async () => {
  const url = await presign({
    ...base,
    method: 'GET',
    url: 'https://examplebucket.s3.amazonaws.com/test.txt',
    expires: 86400,
  });
  expect(url).toBe(
    'https://examplebucket.s3.amazonaws.com/test.txt?X-Amz-Algorithm=AWS4-HMAC-SHA256' +
      '&X-Amz-Credential=AKIAIOSFODNN7EXAMPLE%2F20130524%2Fus-east-1%2Fs3%2Faws4_request' +
      '&X-Amz-Date=20130524T000000Z&X-Amz-Expires=86400&X-Amz-SignedHeaders=host' +
      '&X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404',
  );
});

test('signs the upload headers so size and type cannot change', async () => {
  const url = await presign({
    ...base,
    method: 'PUT',
    url: 'https://examplebucket.s3.amazonaws.com/u/a.webp',
    expires: 300,
    headers: { 'Content-Type': 'image/webp', 'Content-Length': '40000' },
  });
  expect(url).toContain('X-Amz-SignedHeaders=content-length%3Bcontent-type%3Bhost');
  expect(url).not.toContain('aeeed9bb');
});
