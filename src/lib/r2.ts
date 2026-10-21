import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrl?: string;
}

export function getR2Config(): R2Config | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME;
  const publicUrl = process.env.R2_PUBLIC_URL || '';

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    return null;
  }

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucketName,
    publicUrl: publicUrl.replace(/\/+$/, ''),
  };
}

export function isR2Configured(): boolean {
  return getR2Config() !== null;
}

let cachedClient: { client: S3Client; accountId: string } | null = null;

export function getR2Client(): { client: S3Client; config: R2Config } | null {
  const config = getR2Config();
  if (!config) return null;

  if (!cachedClient || cachedClient.accountId !== config.accountId) {
    const s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
    cachedClient = { client: s3, accountId: config.accountId };
  }

  return { client: cachedClient.client, config };
}

/**
 * Generate a presigned PUT URL for uploading directly to Cloudflare R2
 */
export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresInSeconds: number = 3600
): Promise<{ uploadUrl: string; publicUrl: string; key: string } | null> {
  const r2 = getR2Client();
  if (!r2) return null;

  const command = new PutObjectCommand({
    Bucket: r2.config.bucketName,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(r2.client, command, { expiresIn: expiresInSeconds });
  const publicUrl = r2.config.publicUrl
    ? `${r2.config.publicUrl}/${key.replace(/^\/+/, '')}`
    : `/api/files/download?key=${encodeURIComponent(key)}`;

  return { uploadUrl, publicUrl, key };
}

/**
 * Generate a presigned GET URL for downloading / viewing from Cloudflare R2
 */
export async function getPresignedDownloadUrl(
  key: string,
  expiresInSeconds: number = 3600
): Promise<string | null> {
  const r2 = getR2Client();
  if (!r2) return null;

  if (r2.config.publicUrl) {
    return `${r2.config.publicUrl}/${key.replace(/^\/+/, '')}`;
  }

  const command = new GetObjectCommand({
    Bucket: r2.config.bucketName,
    Key: key,
  });

  return await getSignedUrl(r2.client, command, { expiresIn: expiresInSeconds });
}

/**
 * Delete an object from Cloudflare R2
 */
export async function deleteR2Object(key: string): Promise<boolean> {
  const r2 = getR2Client();
  if (!r2) return false;

  const command = new DeleteObjectCommand({
    Bucket: r2.config.bucketName,
    Key: key,
  });

  await r2.client.send(command);
  return true;
}
