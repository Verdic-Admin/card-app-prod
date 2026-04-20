import { GetObjectCommand, S3Client, NoSuchKey } from '@aws-sdk/client-s3';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  ...(process.env.S3_ENDPOINT && { endpoint: process.env.S3_ENDPOINT }),
  ...(process.env.S3_ACCESS_KEY_ID &&
    process.env.S3_SECRET_ACCESS_KEY && {
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
      },
    }),
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
});

const BUCKET = process.env.S3_BUCKET_NAME || 'public-assets';
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
