import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

// Each var checks the custom S3_* name first, then Railway's native AWS_* name.
// This means Railway's "Add to Service" bucket injection works automatically
// without any manual variable renaming in the template or the Railway dashboard.
const region   = process.env.AWS_REGION    || process.env.AWS_DEFAULT_REGION  || 'auto';
const endpoint = process.env.S3_ENDPOINT   || process.env.AWS_ENDPOINT_URL;
const bucket   = process.env.S3_BUCKET_NAME || process.env.AWS_S3_BUCKET_NAME || 'public-assets';
const accessKeyId     = process.env.S3_ACCESS_KEY_ID     || process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;

// S3_FORCE_PATH_STYLE defaults to false (Railway/Tigris uses virtual-host style).
const forcePathStyle = process.env.S3_FORCE_PATH_STYLE === 'true';

const s3Client = new S3Client({
  region,
  ...(endpoint && { endpoint }),
  ...(accessKeyId && secretAccessKey && {
    credentials: { accessKeyId, secretAccessKey },
  }),
  forcePathStyle,
});

// Build the public URL for a given storage key via the app's asset proxy.
// Railway buckets are private, so all access goes through /api/assets/[...key].
// NEXT_PUBLIC_SITE_URL must be set to the app's public origin (e.g. https://example.up.railway.app).
function publicAssetUrl(key: string): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');
  if (!base) {
    console.warn('[storage] NEXT_PUBLIC_SITE_URL is not set — asset URLs will be relative and may break in OG images or external API calls.');
  }
  const encodedKey = key.split('/').map(encodeURIComponent).join('/');
  return `${base}/api/assets/${encodedKey}`;
}

export async function put(path: string, file: File | Blob | Buffer, options?: any) {
  let body: Buffer | Uint8Array | Blob | string;

  if (file instanceof File || file instanceof Blob) {
    const arrayBuffer = await file.arrayBuffer();
    body = Buffer.from(arrayBuffer);
  } else {
    body = file;
  }

  const contentType = (file instanceof File) ? file.type : (options?.contentType || 'application/octet-stream');

  // ACL is intentionally omitted — Railway buckets are private.
  // All public access is served via the /api/assets proxy, not direct S3 URLs.
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: path,
    Body: body,
    ContentType: contentType,
  });

  await s3Client.send(command);

  return { url: publicAssetUrl(path) };
}

// Extract the S3 object key from a stored URL.
// Handles two formats:
//   1. Proxy URL:  https://host/api/assets/card-images/foo.jpg  → card-images/foo.jpg
//   2. Legacy raw S3 URL: https://bucket.s3.region.amazonaws.com/card-images/foo.jpg  → card-images/foo.jpg
function keyFromUrl(url: string): string {
  try {
    const { pathname } = new URL(url);
    const decoded = decodeURIComponent(pathname);
    // Proxy path: /api/assets/<key>
    const proxyPrefix = '/api/assets/';
    if (decoded.startsWith(proxyPrefix)) {
      return decoded.slice(proxyPrefix.length);
    }
    // Legacy raw S3 path: /<bucket>/<key> or just /<key>
    const withoutLeadingSlash = decoded.substring(1);
    if (withoutLeadingSlash.startsWith(`${bucket}/`)) {
      return withoutLeadingSlash.slice(bucket.length + 1);
    }
    return withoutLeadingSlash;
  } catch {
    // Not a valid URL — treat as a bare key
    return url;
  }
}

export async function del(urlOrUrls: string | string[]) {
  const urls = Array.isArray(urlOrUrls) ? urlOrUrls : [urlOrUrls];

  for (const url of urls) {
    try {
      const key = keyFromUrl(url);
      await s3Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    } catch (e) {
      console.warn(`[storage] Failed to delete: ${url}`, e);
    }
  }
}
