export interface DriveFolder {
  id: string;
  name: string;
  parent_id: string | null;
  color: string;
  created_at: number;
  updated_at: number;
  is_starred: number;
  is_trashed: number;
}

export interface DriveFile {
  id: string;
  folder_id: string | null;
  name: string;
  r2_key: string;
  size: number;
  content_type: string;
  public_url: string | null;
  etag: string | null;
  is_starred: number;
  is_trashed: number;
  created_at: number;
  updated_at: number;
}

export interface BreadcrumbItem {
  id: string | null;
  name: string;
}

export type ViewMode = 'grid' | 'list';
export type FilterTab = 'all' | 'starred' | 'trash';
