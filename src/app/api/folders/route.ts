import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const { name, parent_id, color } = await request.json();

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ success: false, error: 'Folder name is required' }, { status: 400 });
    }

    const db = getDb();
    const folderId = `fld_${crypto.randomBytes(8).toString('hex')}`;
    const now = Date.now();
    const parent = parent_id === 'root' ? null : (parent_id || null);
    const folderColor = color || '#c49368';

    await db.execute({
      sql: `INSERT INTO folders (id, name, parent_id, color, created_at, updated_at, is_starred, is_trashed) 
            VALUES (?, ?, ?, ?, ?, ?, 0, 0)`,
      args: [folderId, name.trim(), parent, folderColor, now, now],
    });

    return NextResponse.json({
      success: true,
      folder: {
        id: folderId,
        name: name.trim(),
        parent_id: parent,
        color: folderColor,
        created_at: now,
        updated_at: now,
        is_starred: 0,
        is_trashed: 0,
      }
    });
  } catch (error: any) {
    console.error('Error creating folder:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { id, name, is_starred, is_trashed, color, parent_id } = await request.json();
    if (!id) {
      return NextResponse.json({ success: false, error: 'Folder id is required' }, { status: 400 });
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
    if (color !== undefined) {
      updates.push('color = ?');
      args.push(color);
    }
    if (parent_id !== undefined) {
      updates.push('parent_id = ?');
      args.push(parent_id === 'root' ? null : parent_id);
    }

    args.push(id);
    await db.execute({
      sql: `UPDATE folders SET ${updates.join(', ')} WHERE id = ?`,
      args,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating folder:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const permanent = searchParams.get('permanent') === 'true';

    if (!id) {
      return NextResponse.json({ success: false, error: 'Folder id is required' }, { status: 400 });
    }

    const db = getDb();
    if (permanent) {
      await db.execute({
        sql: `DELETE FROM folders WHERE id = ?`,
        args: [id],
      });
    } else {
      await db.execute({
        sql: `UPDATE folders SET is_trashed = 1, updated_at = ? WHERE id = ?`,
        args: [Date.now(), id],
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting folder:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
