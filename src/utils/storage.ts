/**
 * Object Storage — S3-compatible (Railway Bucket / Tigris / AWS S3).
 *
 * IMPORTANT: All environment variable reads are deferred to request-time
 * to prevent Next.js standalone builds from baking empty strings into
 * the compiled server chunks during `next build` inside Docker.
 */
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  type PutObjectCommandInput,
} from '@aws-sdk/client-s3';

/** Read an env var at runtime (never at build time), ignoring key whitespace. */
function env(searchKey: string): string {
  // Check exact match first
  if (process.env[searchKey] !== undefined) {
    return process.env[searchKey] ?? '';
  }
  // Check for keys with accidental leading/trailing spaces
  for (const k of Object.keys(process.env)) {
    if (k.trim() === searchKey) {
      return process.env[k] ?? '';
    }
  }
  return '';
}

/** Resolve S3 configuration lazily from the live environment. */
function getConfig() {
  const endpoint   = (env('AWS_ENDPOINT_URL_S3') || env('AWS_ENDPOINT_URL') || env('S3_ENDPOINT')).replace(/\/$/, '').trim();
  const bucket     = (env('BUCKET_NAME') || env('AWS_S3_BUCKET_NAME') || env('S3_BUCKET_NAME') || env('S3_BUCKET')).trim();
  const accessKey  = (env('AWS_ACCESS_KEY_ID') || env('S3_ACCESS_KEY_ID')).trim();
  const secretKey  = (env('AWS_SECRET_ACCESS_KEY') || env('S3_SECRET_ACCESS_KEY')).trim();
  const region     = (env('AWS_REGION') || env('AWS_DEFAULT_REGION') || env('S3_REGION') || 'auto').trim();
  return { endpoint, bucket, accessKey, secretKey, region };
}

let _s3: S3Client | null = null;
let _configHash = '';

export function getS3Client(): S3Client {
  const cfg = getConfig();
  const hash = `${cfg.endpoint}|${cfg.bucket}|${cfg.accessKey}`;

  // Rebuild client if config changed (first call, or env vars rotated)
  if (!_s3 || _configHash !== hash) {
    _s3 = new S3Client({
      endpoint: cfg.endpoint || undefined,
      region: cfg.region,
      credentials: {
        accessKeyId: cfg.accessKey,
        secretAccessKey: cfg.secretKey,
      },
      forcePathStyle: false,
    });
    _configHash = hash;
  }
  return _s3;
}

export function getBucketName(): string {
  return getConfig().bucket;
}

/** Public URL for a stored object — routes to Next.js API for presigning to bypass Tigris private restrictions. */
function publicUrl(key: string): string {
  return `/api/storage?key=${encodeURIComponent(key)}`;
}

export interface StoragePutOptions {
  contentType?: string;
  /** Kept for call-site compatibility — all uploads are public-read. */
  access?: 'public';
}

/**
 * Upload a file to S3-compatible object storage.
 * Returns the direct public URL.
 */
export async function put(
  path: string,
  file: File | Blob | Buffer,
  options?: StoragePutOptions,
): Promise<{ url: string }> {
  const cfg = getConfig();

  if (!cfg.endpoint || !cfg.bucket || !cfg.accessKey || !cfg.secretKey) {
    const liveKeys = Object.keys(process.env)
      .filter(k => /S3|AWS|BUCKET|TIGRIS/i.test(k))
      .join(', ');
    throw new Error(
      `Object storage is not configured. ` +
      `ENDPOINT: "${cfg.endpoint || 'missing'}", BUCKET: "${cfg.bucket || 'missing'}", KEY: "${cfg.accessKey ? 'set' : 'missing'}". ` +
      `Live env keys: [${liveKeys || 'NONE'}].`,
    );
  }

  const contentType =
    options?.contentType ??
    (file instanceof File ? file.type : 'application/octet-stream');

  let body: Buffer;
  if (Buffer.isBuffer(file)) {
    body = file;
  } else {
    body = Buffer.from(await (file as Blob).arrayBuffer());
  }

  const params: PutObjectCommandInput = {
    Bucket: cfg.bucket,
    Key: path,
    Body: body,
    ContentType: contentType,
    ACL: 'public-read',
  };

  await getS3Client().send(new PutObjectCommand(params));
  return { url: publicUrl(path) };
}

/**
 * Delete one or more files from S3 by their public URLs.
 */
export async function del(urlOrUrls: string | string[]): Promise<void> {
  const cfg = getConfig();
  const urls = Array.isArray(urlOrUrls) ? urlOrUrls : [urlOrUrls];
  const client = getS3Client();
  for (const url of urls) {
    try {
      let key = '';
      if (url.startsWith('/api/storage')) {
        // Extract key from local proxy URL: /api/storage?key=...
        const match = url.match(/[?&]key=([^&]+)/);
        if (match) {
          key = decodeURIComponent(match[1]);
        }
      } else {
        // Extract key from absolute public URL (legacy)
        const u = new URL(url);
        key = u.pathname.startsWith('/') ? u.pathname.slice(1) : u.pathname;
      }

      if (key) {
        await client.send(new DeleteObjectCommand({ Bucket: cfg.bucket, Key: key }));
      }
    } catch (e) {
      console.warn('[storage] Failed to delete object:', url, e);
    }
  }
}
