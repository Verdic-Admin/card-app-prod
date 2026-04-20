import { GetObjectCommand, S3Client, NoSuchKey } from '@aws-sdk/client-s3';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

// Each var checks the custom S3_* name first, then Railway's native AWS_* name.
const _region   = process.env.AWS_REGION    || process.env.AWS_DEFAULT_REGION  || 'auto';
const _endpoint = process.env.S3_ENDPOINT   || process.env.AWS_ENDPOINT_URL;
const _akid     = process.env.S3_ACCESS_KEY_ID     || process.env.AWS_ACCESS_KEY_ID;
const _secret   = process.env.S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;

const s3 = new S3Client({
  region: _region,
  ...(_endpoint && { endpoint: _endpoint }),
  ...(_akid && _secret && {
    credentials: { accessKeyId: _akid, secretAccessKey: _secret },
  }),
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
});

const BUCKET = process.env.S3_BUCKET_NAME || process.env.AWS_S3_BUCKET_NAME || 'public-assets';
const CACHE_TTL = 60 * 60 * 24 * 365; // 1 year in seconds

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ key: string[] }> }
) {
  const { key: segments } = await params;

  // Guard against path traversal
  if (segments.some((s) => s === '..' || s === '.')) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const objectKey = segments.map(decodeURIComponent).join('/');

  try {
    const result = await s3.send(
      new GetObjectCommand({ Bucket: BUCKET, Key: objectKey })
    );

    if (!result.Body) {
      return new NextResponse('Not Found', { status: 404 });
    }

    const contentType = result.ContentType || 'application/octet-stream';
    const webStream = result.Body.transformToWebStream();

    return new NextResponse(webStream, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': `public, max-age=${CACHE_TTL}, immutable`,
        ...(result.ContentLength != null && {
          'Content-Length': String(result.ContentLength),
        }),
      },
    });
  } catch (err: unknown) {
    if (err instanceof NoSuchKey || (err as { name?: string }).name === 'NoSuchKey') {
      return new NextResponse('Not Found', { status: 404 });
    }
    console.error('[assets proxy] GetObject error:', err);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
