import { NextRequest, NextResponse } from 'next/server';
import { getS3Client, getBucketName } from '@/utils/storage';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const key = searchParams.get('key');

  if (!key) {
    return new NextResponse('Missing key parameter', { status: 400 });
  }

  try {
    const client = getS3Client();
    const bucket = getBucketName();

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    // Generate a presigned URL valid for 1 hour (3600 seconds)
    const signedUrl = await getSignedUrl(client, command, { expiresIn: 3600 });

    // Redirect the browser/client to the actual presigned S3 URL
    return NextResponse.redirect(signedUrl);
  } catch (error) {
    console.error('[storage api] Failed to generate presigned URL:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
