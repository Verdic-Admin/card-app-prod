/**
 * Object Storage — S3-compatible (Railway Tigris, AWS S3, MinIO).
 * All uploads are public-read. URLs are constructed from the endpoint + bucket + key.
 */
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  type PutObjectCommandInput,
} from '@aws-sdk/client-s3';

const S3_ENDPOINT = (process.env.S3_ENDPOINT || '').trim();
const S3_BUCKET = (process.env.S3_BUCKET_NAME || 'public-assets').trim();
const S3_REGION = (process.env.AWS_REGION || 'auto').trim();

let s3: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3) {
    s3 = new S3Client({
      endpoint: S3_ENDPOINT || undefined,
      region: S3_REGION,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
      },
      forcePathStyle: true, // Required for Tigris / MinIO
    });
  }
  return s3;
}

/**
 * Build the public URL for an S3 object.
 * Tigris exposes objects at: https://<endpoint>/<bucket>/<key>
 */
function s3PublicUrl(key: string): string {
  const endpoint = S3_ENDPOINT.replace(/\/$/, '');
  return `${endpoint}/${S3_BUCKET}/${key}`;
}

export interface StoragePutOptions {
  contentType?: string;
  access?: 'public';
}

/**
 * Upload a file to S3-compatible object storage.
 * Returns the direct public URL.
 */
export async function put(
  path: string,
  file: File | Blob | Buffer,
  options?: StoragePutOptions
): Promise<{ url: string }> {
  // Guard: catch missing S3 config early so the error is readable in production
  if (!S3_ENDPOINT || !process.env.S3_ACCESS_KEY_ID || !process.env.S3_SECRET_ACCESS_KEY) {
    throw new Error(
      'Object storage is not configured. Set S3_ENDPOINT, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY in your Railway Environment Variables (Variables tab on your service), then redeploy.'
    );
  }

  const contentType =
    options?.contentType ??
    (file instanceof File ? file.type : 'application/octet-stream');

  const client = getS3Client();

  let body: Buffer;
  if (Buffer.isBuffer(file)) {
    body = file;
  } else {
    const arrayBuffer = await (file as Blob).arrayBuffer();
    body = Buffer.from(arrayBuffer);
  }

  const params: PutObjectCommandInput = {
    Bucket: S3_BUCKET,
    Key: path,
    Body: body,
    ContentType: contentType,
    ACL: 'public-read',
  };

  await client.send(new PutObjectCommand(params));
  return { url: s3PublicUrl(path) };
}

/**
 * Delete one or more files from S3 by their URL(s).
 */
export async function del(urlOrUrls: string | string[]): Promise<void> {
  const urls = Array.isArray(urlOrUrls) ? urlOrUrls : [urlOrUrls];
  const client = getS3Client();

  for (const url of urls) {
    try {
      const u = new URL(url);
      const prefix = `/${S3_BUCKET}/`;
      const key = u.pathname.startsWith(prefix)
        ? u.pathname.slice(prefix.length)
        : u.pathname.slice(1);
      await client.send(
        new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key })
      );
    } catch (e) {
      console.warn('[storage] Failed to delete S3 object:', url, e);
    }
  }
}
