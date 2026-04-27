/**
 * Object Storage — S3-compatible (Railway Tigris / t3.storageapi.dev / AWS S3).
 *
 * Supports both Railway's auto-injected variable names AND custom S3_* overrides:
 *   Railway Tigris:  AWS_ENDPOINT_URL_S3, BUCKET_NAME, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
 *   Custom/legacy:   S3_ENDPOINT,         S3_BUCKET_NAME, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY
 */
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  type PutObjectCommandInput,
} from '@aws-sdk/client-s3';

// Resolve from Railway bucket variable names first, then S3_* fallbacks
const S3_ENDPOINT   = (process.env['AWS_ENDPOINT_URL']    || process.env['S3_ENDPOINT']        || '').replace(/\/$/, '').trim();
const S3_BUCKET     = (process.env['AWS_S3_BUCKET_NAME']  || process.env['S3_BUCKET_NAME']     || '').trim();
const S3_ACCESS_KEY = (process.env['AWS_ACCESS_KEY_ID']   || process.env['S3_ACCESS_KEY_ID']   || '').trim();
const S3_SECRET_KEY = (process.env['AWS_SECRET_ACCESS_KEY']|| process.env['S3_SECRET_ACCESS_KEY']|| '').trim();
const S3_REGION     = (process.env['AWS_DEFAULT_REGION']  || process.env['AWS_REGION'] || process.env['S3_REGION'] || 'auto').trim();

let s3: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3) {
    s3 = new S3Client({
      endpoint: S3_ENDPOINT || undefined,
      region: S3_REGION,
      credentials: {
        accessKeyId:     S3_ACCESS_KEY,
        secretAccessKey: S3_SECRET_KEY,
      },
      forcePathStyle: false, // virtual-hosted-style: https://<bucket>.<endpoint>/<key>
    });
  }
  return s3;
}

/** Public URL for a stored object — virtual-hosted style. */
function publicUrl(key: string): string {
  const host = S3_ENDPOINT.replace(/^https?:\/\//, '');
  return `https://${S3_BUCKET}.${host}/${key}`;
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
  if (!S3_ENDPOINT || !S3_BUCKET || !S3_ACCESS_KEY || !S3_SECRET_KEY) {
    throw new Error(
      `Object storage is not configured. Detected vars — ENDPOINT: "${S3_ENDPOINT || 'missing'}", BUCKET: "${S3_BUCKET || 'missing'}", KEY: "${S3_ACCESS_KEY ? 'set' : 'missing'}". ` +
      `Add AWS_ENDPOINT_URL_S3, BUCKET_NAME, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY (Railway Tigris names) ` +
      `or S3_ENDPOINT, S3_BUCKET_NAME, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY to your service Variables.`,
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
    Bucket: S3_BUCKET,
    Key: path,
    Body: body,
    ContentType: contentType,
    // Note: ACL is intentionally omitted — Railway Tigris and most S3-compatible
    // providers manage bucket-level access policies, not per-object ACLs.
  };

  await getS3Client().send(new PutObjectCommand(params));
  return { url: publicUrl(path) };
}

/**
 * Delete one or more files from S3 by their public URLs.
 */
export async function del(urlOrUrls: string | string[]): Promise<void> {
  const urls = Array.isArray(urlOrUrls) ? urlOrUrls : [urlOrUrls];
  const client = getS3Client();
  for (const url of urls) {
    try {
      // Extract the key: everything after the bucket subdomain + host
      const u = new URL(url);
      const key = u.pathname.startsWith('/') ? u.pathname.slice(1) : u.pathname;
      if (key) await client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }));
    } catch (e) {
      console.warn('[storage] Failed to delete object:', url, e);
    }
  }
}
