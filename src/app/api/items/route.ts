import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { isR2Configured } from '@/lib/r2';
import crypto from 'crypto';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const folderId = searchParams.get('folder_id');
    const tab = searchParams.get('tab') || 'all'; // all, starred, trash
    const search = searchParams.get('q')?.trim();

    const db = getDb();

    // R2 configuration status check
    const r2Configured = isR2Configured();

    let foldersQuery = '';
    let filesQuery = '';
    let paramsFolders: any[] = [];
    let paramsFiles: any[] = [];

    if (search) {
      foldersQuery = `SELECT * FROM folders WHERE name LIKE ? AND is_trashed = 0 ORDER BY updated_at DESC`;
      filesQuery = `SELECT * FROM files WHERE name LIKE ? AND is_trashed = 0 ORDER BY updated_at DESC`;
      paramsFolders = [`%${search}%`];
      paramsFiles = [`%${search}%`];
    } else if (tab === 'starred') {
      foldersQuery = `SELECT * FROM folders WHERE is_starred = 1 AND is_trashed = 0 ORDER BY updated_at DESC`;
      filesQuery = `SELECT * FROM files WHERE is_starred = 1 AND is_trashed = 0 ORDER BY updated_at DESC`;
    } else if (tab === 'trash') {
      foldersQuery = `SELECT * FROM folders WHERE is_trashed = 1 ORDER BY updated_at DESC`;
      filesQuery = `SELECT * FROM files WHERE is_trashed = 1 ORDER BY updated_at DESC`;
    } else {
      // Normal folder browsing
      if (folderId && folderId !== 'root') {
        foldersQuery = `SELECT * FROM folders WHERE parent_id = ? AND is_trashed = 0 ORDER BY name ASC`;
        filesQuery = `SELECT * FROM files WHERE folder_id = ? AND is_trashed = 0 ORDER BY name ASC`;
        paramsFolders = [folderId];
        paramsFiles = [folderId];
      } else {
        foldersQuery = `SELECT * FROM folders WHERE (parent_id IS NULL OR parent_id = '' OR parent_id = 'root') AND is_trashed = 0 ORDER BY name ASC`;
        filesQuery = `SELECT * FROM files WHERE (folder_id IS NULL OR folder_id = '' OR folder_id = 'root') AND is_trashed = 0 ORDER BY name ASC`;
      }
    }

    const [foldersRes, filesRes] = await Promise.all([
      db.execute({ sql: foldersQuery, args: paramsFolders }),
      db.execute({ sql: filesQuery, args: paramsFiles }),
    ]);

    // Build breadcrumbs if folderId is provided and valid
    let breadcrumbs = [{ id: 'root', name: 'Drive' }];
    if (folderId && folderId !== 'root' && tab === 'all' && !search) {
      let currentId: string | null = folderId;
      const chain: Array<{ id: string; name: string }> = [];
      let depth = 0;
      while (currentId && currentId !== 'root' && depth < 20) {
        const queryRes: any = await db.execute({
          sql: `SELECT id, name, parent_id FROM folders WHERE id = ?`,
          args: [currentId],
        });
        if (queryRes.rows && queryRes.rows.length > 0) {
          const row = queryRes.rows[0];
          chain.unshift({ id: String(row.id), name: String(row.name) });
          currentId = row.parent_id ? String(row.parent_id) : null;
        } else {
          break;
        }
        depth++;
      }
      breadcrumbs = [...breadcrumbs, ...chain];
    }

    // Storage stats
    const statsRes = await db.execute(`
      SELECT 
        COUNT(id) as total_files,
        COALESCE(SUM(size), 0) as total_bytes
      FROM files WHERE is_trashed = 0
    `);

    return NextResponse.json({
      success: true,
      r2Configured,
      folders: foldersRes.rows,
      files: filesRes.rows,
      breadcrumbs,
      stats: {
        totalFiles: Number(statsRes.rows[0]?.total_files || 0),
        totalBytes: Number(statsRes.rows[0]?.total_bytes || 0),
      }
    });
  } catch (error: any) {
    console.error('Error fetching items:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
