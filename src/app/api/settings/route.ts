import { NextResponse } from 'next/server';
import { getR2Config, isR2Configured } from '@/lib/r2';
import { getDb } from '@/lib/db';

export async function GET() {
  const config = getR2Config();
  const configured = isR2Configured();

  return NextResponse.json({
    configured,
    config: configured && config ? {
      accountId: config.accountId ? '••••' + config.accountId.slice(-4) : '',
      bucketName: config.bucketName,
      publicUrl: config.publicUrl || '',
    } : null,
  });
}
