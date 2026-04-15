import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

const region = process.env.AWS_REGION || 'us-east-1';
const endpoint = process.env.S3_ENDPOINT;
const bucket = process.env.S3_BUCKET_NAME || 'public-assets';

// It is possible S3_ACCESS_KEY_ID or S3_SECRET_ACCESS_KEY are undefined depending on the environment.
// In production on Railway or similar, they might be provided.
const s3Client = new S3Client({
  region,
  ...(endpoint && { endpoint }),
  ...(process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY && {
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY
    }
  }),
  forcePathStyle: true, // Often needed for custom S3 endpoints
});

export async function put(path: string, file: File | Blob | Buffer, options?: any) {
  let body: Buffer | Uint8Array | Blob | string;
  
  if (file instanceof File || file instanceof Blob) {
    const arrayBuffer = await file.arrayBuffer();
    body = Buffer.from(arrayBuffer);
  } else {
    body = file; 
  }

  const contentType = (file instanceof File) ? file.type : (options?.contentType || 'application/octet-stream');
  const acl = options?.access === 'public' ? 'public-read' : undefined;

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: path,
    Body: body,
    ContentType: contentType,
    ...(acl && { ACL: acl })
  });

  await s3Client.send(command);

  // Construct URL
  const url = endpoint 
    ? `${endpoint}/${bucket}/${path}` 
    : `https://${bucket}.s3.${region}.amazonaws.com/${path}`;

  return { url };
}

export async function del(urlOrUrls: string | string[]) {
  const urls = Array.isArray(urlOrUrls) ? urlOrUrls : [urlOrUrls];

  for (const url of urls) {
    try {
      let key = url;
      // Try to parse out the key from URL
      try {
        const parsedUrl = new URL(url);
        key = parsedUrl.pathname.substring(1); // remove leading slash
        if (key.startsWith(`${bucket}/`)) {
          key = key.substring(bucket.length + 1);
        }
      } catch {
         // if it's not a valid URL, assume it's just the key
      }

      const command = new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      });
      await s3Client.send(command);
    } catch(e) {
      console.warn(`Failed to delete key: ${url}`, e);
    }
  }
}
