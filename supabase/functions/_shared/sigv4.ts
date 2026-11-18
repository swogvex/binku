// AWS Signature V4 query-string presigning (S3 API, used by Cloudflare R2), WebCrypto only.
// Runs in Deno (Edge Functions) and Node (tests). Spec:
// https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-query-string-auth.html

const enc = new TextEncoder();
const hex = (b: ArrayBuffer) =>
  [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
const sha256 = async (s: string) => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
async function hmac(key: ArrayBuffer | Uint8Array<ArrayBuffer>, msg: string) {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  return crypto.subtle.sign('HMAC', k, enc.encode(msg));
}
// RFC 3986: encodeURIComponent leaves !'()* unescaped, SigV4 wants them escaped.
const uriEncode = (s: string) =>
  encodeURIComponent(s).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );

export type PresignInput = {
  method: 'GET' | 'PUT' | 'DELETE';
  /** Full object URL, e.g. https://<account>.eu.r2.cloudflarestorage.com/<bucket>/<key> */
  url: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** R2: 'auto' */
  region: string;
  /** Seconds the URL stays valid. */
  expires: number;
  /** Extra headers the caller must send unchanged (e.g. content-type, content-length). */
  headers?: Record<string, string>;
  date?: Date;
};

export async function presign(o: PresignInput) {
  const u = new URL(o.url);
  const amzDate = (o.date ?? new Date()).toISOString().replace(/[-:]|\.\d{3}/g, '');
  const day = amzDate.slice(0, 8);
  const scope = `${day}/${o.region}/s3/aws4_request`;
  const headers: Record<string, string> = { host: u.host };
  for (const [k, v] of Object.entries(o.headers ?? {})) headers[k.toLowerCase()] = v.trim();
  const names = Object.keys(headers).sort();
  const signedHeaders = names.join(';');

  const query = [
    ['X-Amz-Algorithm', 'AWS4-HMAC-SHA256'],
    ['X-Amz-Credential', `${o.accessKeyId}/${scope}`],
    ['X-Amz-Date', amzDate],
    ['X-Amz-Expires', String(o.expires)],
    ['X-Amz-SignedHeaders', signedHeaders],
  ]
    .map(([k, v]) => `${uriEncode(k)}=${uriEncode(v)}`)
    .sort()
    .join('&');
  const path = u.pathname
    .split('/')
    .map((seg) => uriEncode(decodeURIComponent(seg)))
    .join('/');

  const canonical = [
    o.method,
    path,
    query,
    names.map((n) => `${n}:${headers[n]}\n`).join(''),
    signedHeaders,
    'UNSIGNED-PAYLOAD',
  ].join('\n');
  const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, await sha256(canonical)].join('\n');

  let key = await hmac(enc.encode(`AWS4${o.secretAccessKey}`), day);
  for (const part of [o.region, 's3', 'aws4_request']) key = await hmac(key, part);
  return `${u.origin}${path}?${query}&X-Amz-Signature=${hex(await hmac(key, toSign))}`;
}
