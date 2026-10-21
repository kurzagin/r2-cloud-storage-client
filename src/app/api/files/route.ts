import { NextResponse } from 'next/server';
import { getPresignedUploadUrl, getPresignedDownloadUrl, deleteR2Object } from '@/lib/r2';
import { getDb } from '@/lib/db';
import crypto from 'crypto';

/**
 * Request presigned upload URL or finalize an upload record in SQLite
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    // STEP 1: Presign upload
    if (action === 'presign') {
      const { filename, contentType, folderId } = body;
      if (!filename || !contentType) {
        return NextResponse.json({ success: false, error: 'Filename and contentType are required' }, { status: 400 });
      }

      const randomSuffix = crypto.randomBytes(6).toString('hex');
      const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
      const prefix = folderId && folderId !== 'root' ? `uploads/${folderId}` : 'uploads';
      const key = `${prefix}/${Date.now()}-${randomSuffix}-${safeFilename}`;

      const presigned = await getPresignedUploadUrl(key, contentType, 3600);
      if (!presigned) {
        return NextResponse.json({
          success: false,
          error: 'Cloudflare R2 is not configured. Please supply R2 credentials in Settings or .env.local',
        }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        uploadUrl: presigned.uploadUrl,
        publicUrl: presigned.publicUrl,
        key: presigned.key,
      });
    }

    // STEP 2: Record uploaded file into database
    if (action === 'record') {
      const { name, folder_id, r2_key, size, content_type, public_url, etag } = body;
      if (!name || !r2_key) {
        return NextResponse.json({ success: false, error: 'Missing required file details' }, { status: 400 });
      }

      const db = getDb();
      const fileId = `fil_${crypto.randomBytes(8).toString('hex')}`;
      const now = Date.now();
      const folder = folder_id === 'root' ? null : (folder_id || null);

      await db.execute({
        sql: `INSERT INTO files (id, folder_id, name, r2_key, size, content_type, public_url, etag, is_starred, is_trashed, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)`,
        args: [
          fileId,
          folder,
          name,
          r2_key,
          size || 0,
          content_type || 'application/octet-stream',
          public_url || null,
          etag || null,
          now,
          now,
        ],
      });

      return NextResponse.json({
        success: true,
        file: {
          id: fileId,
          folder_id: folder,
          name,
          r2_key,
          size,
          content_type,
          public_url,
          etag,
          is_starred: 0,
          is_trashed: 0,
          created_at: now,
          updated_at: now,
        }
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Error handling file:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * Update file status (star, rename, trash)
 */
export async function PATCH(request: Request) {
  try {
    const { id, name, is_starred, is_trashed, folder_id } = await request.json();
    if (!id) {
      return NextResponse.json({ success: false, error: 'File id is required' }, { status: 400 });
    }

    const db = getDb();
    const updates: string[] = ['updated_at = ?'];
    const args: any[] = [Date.now()];

    if (name !== undefined) {
      updates.push('name = ?');
      args.push(name.trim());
    }
    if (is_starred !== undefined) {
      updates.push('is_starred = ?');
      args.push(is_starred ? 1 : 0);
    }
    if (is_trashed !== undefined) {
      updates.push('is_trashed = ?');
      args.push(is_trashed ? 1 : 0);
    }
    if (folder_id !== undefined) {
      updates.push('folder_id = ?');
      args.push(folder_id === 'root' ? null : folder_id);
    }

    args.push(id);
    await db.execute({
      sql: `UPDATE files SET ${updates.join(', ')} WHERE id = ?`,
      args,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating file:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * Permanently delete or trash file
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const permanent = searchParams.get('permanent') === 'true';

    if (!id) {
      return NextResponse.json({ success: false, error: 'File id is required' }, { status: 400 });
    }

    const db = getDb();

    if (permanent) {
      const res = await db.execute({
        sql: `SELECT r2_key FROM files WHERE id = ?`,
        args: [id],
      });
      if (res.rows.length > 0 && res.rows[0].r2_key) {
        try {
          await deleteR2Object(String(res.rows[0].r2_key));
        } catch (e) {
          console.warn('Failed to delete object from R2 directly, proceeding to remove db record', e);
        }
      }
      await db.execute({
        sql: `DELETE FROM files WHERE id = ?`,
        args: [id],
      });
    } else {
      await db.execute({
        sql: `UPDATE files SET is_trashed = 1, updated_at = ? WHERE id = ?`,
        args: [Date.now(), id],
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting file:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
