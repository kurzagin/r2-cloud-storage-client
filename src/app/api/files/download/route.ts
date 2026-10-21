import { NextResponse } from 'next/server';
import { getPresignedDownloadUrl, getR2Config, getR2Client } from '@/lib/r2';
import { GetObjectCommand } from '@aws-sdk/client-s3';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');
    const download = searchParams.get('download') === 'true';

    if (!key) {
      return NextResponse.json({ success: false, error: 'Key is required' }, { status: 400 });
    }

    const config = getR2Config();
    const r2 = getR2Client();

    if (!r2) {
      return NextResponse.json({ success: false, error: 'R2 is not configured' }, { status: 500 });
    }

    // If download flag or no direct CDN, generate temporary presigned download URL
    const presignedUrl = await getPresignedDownloadUrl(key, 3600);
    if (!presignedUrl) {
      return NextResponse.json({ success: false, error: 'Failed to generate download URL' }, { status: 500 });
    }

    return NextResponse.redirect(presignedUrl);
  } catch (error: any) {
    console.error('Download error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
