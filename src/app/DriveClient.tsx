'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Folder,
  File,
  FileText,
  FileCode,
  FileArchive,
  Image as ImageIcon,
  Video,
  Music,
  Upload,
  Trash2,
  Star,
  Download,
  Grid,
  List as ListIcon,
  Search,
  ChevronRight,
  HardDrive,
  X,
  Check,
  RefreshCw,
  FolderPlus,
  AlertCircle,
  Menu,
  Sliders,
  ExternalLink,
  Plus
} from 'lucide-react';
import { DriveFolder, DriveFile, BreadcrumbItem, ViewMode, FilterTab } from '@/types/drive';
import { formatBytes, formatDate, getFileCategory } from '@/lib/utils';
import { css } from '@/lib/css';

export default function DriveClient() {
  const [tab, setTab] = useState<FilterTab>('all');
  const [currentFolderId, setCurrentFolderId] = useState<string>('root');
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([{ id: 'root', name: 'Drive' }]);
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [stats, setStats] = useState({ totalFiles: 0, totalBytes: 0 });
  const [r2Configured, setR2Configured] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Upload state
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const [isUploading, setIsUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Modals & Panels
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [folderColor, setFolderColor] = useState('#c49368');
  const [previewFile, setPreviewFile] = useState<DriveFile | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<DriveFile | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadItems = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchQuery.trim()) {
        params.set('q', searchQuery.trim());
      } else {
        params.set('tab', tab);
        if (tab === 'all') {
          params.set('folder_id', currentFolderId);
        }
      }

      const res = await fetch(`/api/items?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setFolders(data.folders || []);
        setFiles(data.files || []);
        if (data.breadcrumbs && !searchQuery.trim() && tab === 'all') {
          setBreadcrumbs(data.breadcrumbs);
        }
        setStats(data.stats || { totalFiles: 0, totalBytes: 0 });
        setR2Configured(data.r2Configured);
      }
    } catch (err) {
      console.error('Failed to load items', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, [currentFolderId, tab, searchQuery]);

  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('SW registration failed:', err);
      });
    }
  }, []);

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    try {
      const res = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newFolderName.trim(),
          parent_id: currentFolderId === 'root' ? null : currentFolderId,
          color: folderColor,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNewFolderName('');
        setNewFolderOpen(false);
        setDrawerOpen(false);
        loadItems();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleStarFolder = async (folder: DriveFolder, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch('/api/folders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: folder.id,
          is_starred: folder.is_starred ? 0 : 1,
        }),
      });
      loadItems();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteFolder = async (folder: DriveFolder, permanent = false, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (permanent && !confirm(`Permanently delete folder "${folder.name}"?`)) return;

    try {
      await fetch(`/api/folders?id=${folder.id}&permanent=${permanent}`, {
        method: 'DELETE',
      });
      loadItems();
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleStarFile = async (file: DriveFile, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch('/api/files', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: file.id,
          is_starred: file.is_starred ? 0 : 1,
        }),
      });
      loadItems();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteFile = async (file: DriveFile, permanent = false, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (permanent && !confirm(`Permanently delete file "${file.name}"?`)) return;

    try {
      await fetch(`/api/files?id=${file.id}&permanent=${permanent}`, {
        method: 'DELETE',
      });
      if (selectedFile?.id === file.id) setSelectedFile(null);
      if (previewFile?.id === file.id) setPreviewFile(null);
      loadItems();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUploadFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    if (!r2Configured) {
      alert('Cloudflare R2 is not configured in .env.local. Please provide your R2 credentials.');
      return;
    }

    setIsUploading(true);
    setDrawerOpen(false);
    const filesArray = Array.from(fileList);

    for (const f of filesArray) {
      try {
        setUploadProgress((prev) => ({ ...prev, [f.name]: 10 }));

        const presignRes = await fetch('/api/files', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'presign',
            filename: f.name,
            contentType: f.type || 'application/octet-stream',
            folderId: currentFolderId,
          }),
        });

        const presignData = await presignRes.json();
        if (!presignData.success) {
          alert(`Presign failed for ${f.name}: ${presignData.error}`);
          continue;
        }

        setUploadProgress((prev) => ({ ...prev, [f.name]: 35 }));

        const uploadRes = await fetch(presignData.uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': f.type || 'application/octet-stream',
          },
          body: f,
        });

        if (!uploadRes.ok) {
          throw new Error(`R2 direct upload returned ${uploadRes.status}`);
        }

        setUploadProgress((prev) => ({ ...prev, [f.name]: 80 }));

        await fetch('/api/files', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'record',
            name: f.name,
            folder_id: currentFolderId === 'root' ? null : currentFolderId,
            r2_key: presignData.key,
            size: f.size,
            content_type: f.type || 'application/octet-stream',
            public_url: presignData.publicUrl,
          }),
        });

        setUploadProgress((prev) => ({ ...prev, [f.name]: 100 }));
      } catch (err: any) {
        console.error(`Upload error for ${f.name}:`, err);
        alert(`Failed to upload ${f.name}: ${err.message}`);
      }
    }

    setTimeout(() => {
      setUploadProgress({});
      setIsUploading(false);
      loadItems();
    }, 800);
  };

  const renderFileIcon = (file: DriveFile) => {
    const category = getFileCategory(file.content_type, file.name);
    switch (category) {
      case 'image':
        return <ImageIcon style={css("width: 18px; height: 18px; color: var(--accent); flex-shrink: 0;")} />;
      case 'video':
        return <Video style={css("width: 18px; height: 18px; color: #e0a878; flex-shrink: 0;")} />;
      case 'audio':
        return <Music style={css("width: 18px; height: 18px; color: var(--teal); flex-shrink: 0;")} />;
      case 'code':
        return <FileCode style={css("width: 18px; height: 18px; color: #9ec4a8; flex-shrink: 0;")} />;
      case 'archive':
        return <FileArchive style={css("width: 18px; height: 18px; color: #c8a878; flex-shrink: 0;")} />;
      case 'pdf':
        return <FileText style={css("width: 18px; height: 18px; color: var(--red-soft); flex-shrink: 0;")} />;
      default:
        return <File style={css("width: 18px; height: 18px; color: var(--text-2); flex-shrink: 0;")} />;
    }
  };

  const getFileDownloadLink = (file: DriveFile) => {
    return file.public_url || `/api/files/download?key=${encodeURIComponent(file.r2_key)}`;
  };

  return (
    <div style={css("display: flex; flex-direction: column; min-height: 100vh; position: relative; z-index: 1;")}>
      {/* Top Header */}
      <nav className="top-nav">
        <div style={css("display: flex; align-items: center; gap: 10px;")}>
          <button
            onClick={() => setDrawerOpen(true)}
            className="mobile-nav-toggle"
            style={css("background: transparent; border: 1px solid var(--border); color: var(--text-1); padding: 5px 8px; border-radius: 3px; cursor: pointer; align-items: center; justify-content: center;")}
            aria-label="Open menu"
          >
            <Menu style={css("width: 15px; height: 15px;")} />
          </button>
          <div className="nav-brand">
            <span className="dot"></span>
            <span>R2.DRIVE</span>
            <span className="jp">// 云端ストレージ</span>
          </div>
        </div>

        {/* Desktop Search Bar */}
        <div className="search-bar-desktop" style={css("flex: 1; max-width: 440px; margin: 0 16px; position: relative; align-items: center;")}>
          <Search style={css("width: 13px; height: 13px; position: absolute; left: 10px; color: var(--text-2); pointer-events: none;")} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search dossier, keys, objects..."
            style={css("width: 100%; background: var(--bg-1); border: 1px solid var(--border); color: var(--text-0); padding: 6px 30px; border-radius: 3px; font-family: var(--mono); font-size: 0.72rem; outline: none;")}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={css("position: absolute; right: 8px; background: none; border: none; color: var(--text-2); cursor: pointer; display: flex;")}
            >
              <X style={css("width: 13px; height: 13px;")} />
            </button>
          )}
        </div>

        {/* Right Header Stats & Buttons */}
        <div style={css("display: flex; align-items: center; gap: 8px; margin-left: auto; font-family: var(--mono); font-size: 0.72rem;")}>
          {/* Mobile search toggle */}
          <button
            onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
            className="mobile-nav-toggle"
            style={css("background: var(--bg-1); border: 1px solid var(--border); color: var(--text-1); padding: 6px 8px; border-radius: 3px; cursor: pointer;")}
            aria-label="Toggle search"
          >
            <Search style={css("width: 13px; height: 13px;")} />
          </button>

          <div className="stats-badge-desktop" style={css("align-items: center; gap: 8px; background: var(--bg-1); border: 1px solid var(--border-subtle); padding: 4px 10px; border-radius: 3px; color: var(--text-1);")}>
            <HardDrive style={css("width: 13px; height: 13px; color: var(--accent);")} />
            <span>{formatBytes(stats.totalBytes)}</span>
            <span style={css("color: var(--text-3);")}>/</span>
            <span style={css("color: var(--text-2);")}>{stats.totalFiles} files</span>
          </div>

          <button
            onClick={() => setSettingsOpen(true)}
            style={css("background: var(--bg-1); border: 1px solid var(--border); color: var(--text-1); padding: 6px 9px; border-radius: 3px; cursor: pointer; display: flex; align-items: center;")}
            title="Storage Settings"
          >
            <Sliders style={css("width: 13px; height: 13px;")} />
          </button>
        </div>
      </nav>

      {/* Mobile Collapsible Search Row */}
      {mobileSearchOpen && (
        <div style={css("background: var(--bg-1); padding: 8px 14px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 8px;")}>
          <Search style={css("width: 14px; height: 14px; color: var(--text-2); flex-shrink: 0;")} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search items..."
            autoFocus
            style={css("flex: 1; background: var(--bg-0); border: 1px solid var(--border); color: var(--text-0); padding: 6px 10px; border-radius: 3px; font-family: var(--mono); font-size: 0.75rem; outline: none;")}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={css("background: none; border: none; color: var(--text-2); cursor: pointer;")}
            >
              <X style={css("width: 14px; height: 14px;")} />
            </button>
          )}
        </div>
      )}

      {/* Main Workspace Layout */}
      <div style={css("display: flex; flex: 1; overflow: hidden; position: relative;")}>
        {/* Desktop Sidebar */}
        <aside
          className="drive-sidebar-desktop"
          style={css(`
            width: 230px;
            background: var(--bg-1);
            border-right: 1px solid var(--border);
            padding: 20px 16px;
            display: flex;
            flex-direction: column;
            flex-shrink: 0;
          `)}
        >
          {/* Main Action Buttons */}
          <div style={css("display: flex; flex-direction: column; gap: 8px; margin-bottom: 24px;")}>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              style={css(`
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                background: var(--accent);
                color: #0a0a0c;
                font-family: var(--mono);
                font-weight: 600;
                font-size: 0.72rem;
                padding: 9px 12px;
                border: none;
                border-radius: 3px;
                cursor: pointer;
                letter-spacing: 0.5px;
              `)}
            >
              <Upload style={css("width: 14px; height: 14px; stroke-width: 2.2;")} />
              <span>UPLOAD FILES</span>
            </button>

            <button
              onClick={() => setNewFolderOpen(true)}
              style={css(`
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                background: var(--bg-2);
                border: 1px solid var(--border);
                color: var(--text-0);
                font-family: var(--mono);
                font-size: 0.72rem;
                padding: 8px 12px;
                border-radius: 3px;
                cursor: pointer;
              `)}
            >
              <FolderPlus style={css("width: 14px; height: 14px; color: var(--accent);")} />
              <span>NEW FOLDER</span>
            </button>
          </div>

          {/* Navigation Links */}
          <div style={css("display: flex; flex-direction: column; gap: 4px; font-family: var(--mono); font-size: 0.75rem; margin-bottom: 24px;")}>
            <div style={css("font-size: 0.62rem; text-transform: uppercase; color: var(--text-3); letter-spacing: 1.5px; padding: 4px 8px; margin-bottom: 4px;")}>
              DIRECT ACCESS
            </div>

            <button
              onClick={() => {
                setTab('all');
                setCurrentFolderId('root');
                setSearchQuery('');
              }}
              style={css(`
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 7px 10px;
                border-radius: 3px;
                border: ${tab === 'all' && !searchQuery ? '1px solid var(--border)' : '1px solid transparent'};
                background: ${tab === 'all' && !searchQuery ? 'var(--bg-2)' : 'transparent'};
                color: ${tab === 'all' && !searchQuery ? 'var(--accent)' : 'var(--text-1)'};
                cursor: pointer;
                text-align: left;
                width: 100%;
              `)}
            >
              <Folder style={css("width: 15px; height: 15px; color: var(--accent);")} />
              <span>My Storage</span>
            </button>

            <button
              onClick={() => {
                setTab('starred');
                setSearchQuery('');
              }}
              style={css(`
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 7px 10px;
                border-radius: 3px;
                border: ${tab === 'starred' ? '1px solid var(--border)' : '1px solid transparent'};
                background: ${tab === 'starred' ? 'var(--bg-2)' : 'transparent'};
                color: ${tab === 'starred' ? 'var(--accent)' : 'var(--text-1)'};
                cursor: pointer;
                text-align: left;
                width: 100%;
              `)}
            >
              <Star style={css("width: 15px; height: 15px; color: var(--accent);")} />
              <span>Starred</span>
            </button>

            <button
              onClick={() => {
                setTab('trash');
                setSearchQuery('');
              }}
              style={css(`
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 7px 10px;
                border-radius: 3px;
                border: ${tab === 'trash' ? '1px solid var(--border)' : '1px solid transparent'};
                background: ${tab === 'trash' ? 'var(--bg-2)' : 'transparent'};
                color: ${tab === 'trash' ? 'var(--red-soft)' : 'var(--text-1)'};
                cursor: pointer;
                text-align: left;
                width: 100%;
              `)}
            >
              <Trash2 style={css("width: 15px; height: 15px; color: var(--red-soft);")} />
              <span>Trash Bin</span>
            </button>
          </div>

          {/* Engine Status */}
          <div style={css("margin-top: auto; border-top: 1px solid var(--border-subtle); padding-top: 14px; font-family: var(--mono); font-size: 0.68rem; color: var(--text-2);")}>
            <div style={css("display: flex; justify-content: space-between; margin-bottom: 6px;")}>
              <span>STORAGE ENGINE</span>
              <span style={css("color: var(--teal);")}>SQLite + R2</span>
            </div>
            <div style={css("display: flex; justify-content: space-between;")}>
              <span>R2 CONNECTION</span>
              <span style={css(`color: ${r2Configured ? 'var(--green-soft)' : 'var(--red-soft)'};`)}>
                {r2Configured ? 'CONNECTED' : 'UNCONFIGURED'}
              </span>
            </div>
          </div>
        </aside>

        {/* Content Viewport */}
        <main
          style={css(`
            flex: 1;
            display: flex;
            flex-direction: column;
            background: var(--bg-0);
            overflow-y: auto;
            width: 100%;
          `)}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files) {
              handleUploadFiles(e.dataTransfer.files);
            }
          }}
        >
          {/* Breadcrumbs & View Toggle Bar */}
          <div
            className="breadcrumb-bar"
            style={css(`
              padding: 10px 20px;
              border-bottom: 1px solid var(--border-subtle);
              display: flex;
              align-items: center;
              justify-content: space-between;
              background: var(--bg-1);
            `)}
          >
            <div style={css("display: flex; align-items: center; gap: 4px; font-family: var(--mono); font-size: 0.72rem; color: var(--text-1); overflow-x: auto; max-width: calc(100% - 90px);")}>
              {breadcrumbs.map((crumb, idx) => (
                <React.Fragment key={crumb.id || 'root'}>
                  {idx > 0 && <ChevronRight style={css("width: 12px; height: 12px; color: var(--text-3); flex-shrink: 0;")} />}
                  <button
                    onClick={() => {
                      setCurrentFolderId(crumb.id || 'root');
                      setTab('all');
                      setSearchQuery('');
                    }}
                    style={css(`
                      background: ${idx === breadcrumbs.length - 1 ? 'var(--bg-3)' : 'transparent'};
                      border: none;
                      color: ${idx === breadcrumbs.length - 1 ? 'var(--text-0)' : 'var(--text-1)'};
                      font-weight: ${idx === breadcrumbs.length - 1 ? '600' : '400'};
                      padding: 3px 6px;
                      border-radius: 2px;
                      cursor: pointer;
                      white-space: nowrap;
                      font-size: 0.7rem;
                    `)}
                  >
                    {crumb.name}
                  </button>
                </React.Fragment>
              ))}
            </div>

            {/* View Mode & Refresh */}
            <div style={css("display: flex; align-items: center; gap: 6px;")}>
              <div style={css("display: flex; background: var(--bg-0); border: 1px solid var(--border); border-radius: 3px; padding: 2px;")}>
                <button
                  onClick={() => setViewMode('grid')}
                  style={css(`
                    background: ${viewMode === 'grid' ? 'var(--bg-2)' : 'transparent'};
                    color: ${viewMode === 'grid' ? 'var(--accent)' : 'var(--text-2)'};
                    border: none;
                    padding: 4px 6px;
                    border-radius: 2px;
                    cursor: pointer;
                    display: flex;
                  `)}
                  title="Grid View"
                >
                  <Grid style={css("width: 13px; height: 13px;")} />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  style={css(`
                    background: ${viewMode === 'list' ? 'var(--bg-2)' : 'transparent'};
                    color: ${viewMode === 'list' ? 'var(--accent)' : 'var(--text-2)'};
                    border: none;
                    padding: 4px 6px;
                    border-radius: 2px;
                    cursor: pointer;
                    display: flex;
                  `)}
                  title="List View"
                >
                  <ListIcon style={css("width: 13px; height: 13px;")} />
                </button>
              </div>

              <button
                onClick={loadItems}
                style={css("background: var(--bg-0); border: 1px solid var(--border); color: var(--text-2); padding: 5px; border-radius: 3px; cursor: pointer; display: flex;")}
                title="Refresh"
              >
                <RefreshCw style={css(`width: 13px; height: 13px; ${loading ? 'color: var(--accent);' : ''}`)} />
              </button>
            </div>
          </div>

          {/* Upload Progress Bar */}
          {Object.keys(uploadProgress).length > 0 && (
            <div style={css("padding: 8px 16px; background: var(--bg-1); border-bottom: 1px solid var(--border); display: flex; flex-direction: column; gap: 6px;")}>
              {Object.entries(uploadProgress).map(([filename, progress]) => (
                <div key={filename} style={css("display: flex; align-items: center; gap: 10px; font-family: var(--mono); font-size: 0.68rem;")}>
                  <span style={css("color: var(--accent); max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;")}>{filename}</span>
                  <div style={css("flex: 1; background: var(--bg-2); height: 4px; border-radius: 2px; overflow: hidden; border: 1px solid var(--border);")}>
                    <div style={css(`background: var(--accent); height: 100%; width: ${progress}%; transition: width 0.3s;`)} />
                  </div>
                  <span style={css("color: var(--text-2); width: 28px; text-align: right;")}>{progress}%</span>
                </div>
              ))}
            </div>
          )}

          {/* Drag Overlay */}
          {dragOver && (
            <div style={css("margin: 16px; padding: 30px; border: 2px dashed var(--accent); background: var(--accent-dim); border-radius: 6px; text-align: center;")}>
              <Upload style={css("width: 28px; height: 28px; color: var(--accent); margin: 0 auto 8px;")} />
              <div style={css("font-family: var(--mono); font-size: 0.8rem; color: var(--text-0);")}>Drop files here to upload directly to R2</div>
            </div>
          )}

          {/* Content Body */}
          <div className="drive-main-content" style={css("flex: 1; padding: 20px; padding-bottom: 80px;")}>
            {!r2Configured && (
              <div style={css("margin-bottom: 20px; padding: 12px 14px; border: 1px solid rgba(176,80,80,0.4); background: rgba(176,80,80,0.08); border-radius: 4px; display: flex; align-items: flex-start; gap: 10px;")}>
                <AlertCircle style={css("width: 16px; height: 16px; color: var(--red-soft); flex-shrink: 0; margin-top: 2px;")} />
                <div style={css("font-size: 0.72rem;")}>
                  <div style={css("font-family: var(--mono); font-weight: 600; color: var(--text-0); margin-bottom: 2px;")}>Cloudflare R2 Credentials Missing</div>
                  <div style={css("color: var(--text-1); line-height: 1.4;")}>
                    Configure <span style={css("color: var(--accent); font-family: var(--mono);")}>R2_ACCOUNT_ID</span> and keys in your <span style={css("font-family: var(--mono);")}>.env.local</span> file.
                  </div>
                </div>
              </div>
            )}

            {/* Folders */}
            {folders.length > 0 && (
              <div style={css("margin-bottom: 24px;")}>
                <div style={css("display: flex; align-items: center; gap: 6px; font-family: var(--mono); font-size: 0.65rem; color: var(--text-2); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px;")}>
                  <span>Directories</span>
                  <span style={css("color: var(--text-3);")}>({folders.length})</span>
                </div>

                <div className="folders-grid-container" style={css("display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 10px;")}>
                  {folders.map((folder) => (
                    <div
                      key={folder.id}
                      onClick={() => {
                        setCurrentFolderId(folder.id);
                        setTab('all');
                      }}
                      className="bracket-card"
                      style={css(`
                        padding: 10px 12px;
                        cursor: pointer;
                        display: flex;
                        flex-direction: column;
                        justify-content: space-between;
                        min-height: 76px;
                        border-radius: 3px;
                      `)}
                    >
                      <div style={css("display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;")}>
                        <Folder style={css(`width: 20px; height: 20px; color: ${folder.color || 'var(--accent)'};`)} />
                        <div style={css("display: flex; align-items: center; gap: 2px;")}>
                          <button
                            onClick={(e) => handleToggleStarFolder(folder, e)}
                            style={css("background: none; border: none; color: var(--text-2); cursor: pointer; padding: 3px;")}
                          >
                            <Star style={css(`width: 12px; height: 12px; ${folder.is_starred ? 'fill: var(--accent); color: var(--accent);' : ''}`)} />
                          </button>
                          <button
                            onClick={(e) => handleDeleteFolder(folder, tab === 'trash', e)}
                            style={css("background: none; border: none; color: var(--text-2); cursor: pointer; padding: 3px;")}
                          >
                            <Trash2 style={css("width: 12px; height: 12px;")} />
                          </button>
                        </div>
                      </div>

                      <div style={css("font-family: var(--mono); font-size: 0.72rem; color: var(--text-0); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;")}>
                        {folder.name}
                      </div>
                      <div style={css("font-family: var(--mono); font-size: 0.62rem; color: var(--text-2); margin-top: 3px;")}>
                        {formatDate(folder.updated_at)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Files */}
            <div>
              <div style={css("display: flex; align-items: center; gap: 6px; font-family: var(--mono); font-size: 0.65rem; color: var(--text-2); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px;")}>
                <span>Files & Objects</span>
                <span style={css("color: var(--text-3);")}>({files.length})</span>
              </div>

              {files.length === 0 && folders.length === 0 && !loading && (
                <div style={css("padding: 40px 16px; border: 1px dashed var(--border); border-radius: 4px; text-align: center;")}>
                  <Folder style={css("width: 32px; height: 32px; color: var(--text-3); margin: 0 auto 10px; stroke-width: 1.5;")} />
                  <div style={css("font-family: var(--mono); font-size: 0.75rem; color: var(--text-1);")}>No assets in this directory</div>
                  <div style={css("font-family: var(--mono); font-size: 0.65rem; color: var(--text-2); margin-top: 4px;")}>
                    Tap the upload button below to add assets
                  </div>
                </div>
              )}

              {/* Grid View */}
              {viewMode === 'grid' && files.length > 0 && (
                <div className="files-grid-container" style={css("display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 10px;")}>
                  {files.map((file) => {
                    const category = getFileCategory(file.content_type, file.name);
                    const isSelected = selectedFile?.id === file.id;

                    return (
                      <div
                        key={file.id}
                        onClick={() => setSelectedFile(file)}
                        onDoubleClick={() => setPreviewFile(file)}
                        className="bracket-card"
                        style={css(`
                          padding: 8px;
                          cursor: pointer;
                          display: flex;
                          flex-direction: column;
                          border-radius: 3px;
                          border: ${isSelected ? '1px solid var(--accent)' : '1px solid var(--border-subtle)'};
                        `)}
                      >
                        {/* Thumbnail View */}
                        <div style={css("height: 96px; width: 100%; background: var(--bg-0); border-radius: 2px; border: 1px solid var(--border-subtle); display: flex; align-items: center; justify-content: center; overflow: hidden; margin-bottom: 8px; position: relative;")}>
                          {category === 'image' && file.public_url ? (
                            <img
                              src={file.public_url}
                              alt={file.name}
                              style={css("width: 100%; height: 100%; object-fit: cover;")}
                              loading="lazy"
                            />
                          ) : (
                            <div style={css("display: flex; flex-direction: column; align-items: center; gap: 4px;")}>
                              {renderFileIcon(file)}
                              <span style={css("font-family: var(--mono); font-size: 0.58rem; text-transform: uppercase; color: var(--text-2);")}>
                                {file.name.split('.').pop()}
                              </span>
                            </div>
                          )}

                          {/* Quick corner buttons */}
                          <div style={css("position: absolute; top: 4px; right: 4px; display: flex; gap: 3px; background: rgba(10,10,12,0.85); backdrop-filter: blur(4px); padding: 3px 4px; border-radius: 3px; border: 1px solid var(--border);")}>
                            <button
                              onClick={(e) => handleToggleStarFile(file, e)}
                              style={css("background: none; border: none; color: var(--text-2); cursor: pointer; padding: 0; display: flex;")}
                            >
                              <Star style={css(`width: 11px; height: 11px; ${file.is_starred ? 'fill: var(--accent); color: var(--accent);' : ''}`)} />
                            </button>
                            <a
                              href={getFileDownloadLink(file)}
                              download={file.name}
                              onClick={(e) => e.stopPropagation()}
                              style={css("color: var(--text-2); display: flex; text-decoration: none;")}
                            >
                              <Download style={css("width: 11px; height: 11px;")} />
                            </a>
                            <button
                              onClick={(e) => handleDeleteFile(file, tab === 'trash', e)}
                              style={css("background: none; border: none; color: var(--text-2); cursor: pointer; padding: 0; display: flex;")}
                            >
                              <Trash2 style={css("width: 11px; height: 11px;")} />
                            </button>
                          </div>
                        </div>

                        {/* Title & metadata */}
                        <div style={css("font-family: var(--mono); font-size: 0.7rem; color: var(--text-0); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;")}>
                          {file.name}
                        </div>
                        <div style={css("display: flex; align-items: center; justify-content: space-between; font-family: var(--mono); font-size: 0.62rem; color: var(--text-2); margin-top: 4px;")}>
                          <span>{formatBytes(file.size)}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewFile(file);
                            }}
                            style={css("background: none; border: none; color: var(--accent); cursor: pointer; font-family: var(--mono); font-size: 0.62rem; text-decoration: underline;")}
                          >
                            view
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* List View */}
              {viewMode === 'list' && files.length > 0 && (
                <div style={css("border: 1px solid var(--border); border-radius: 3px; background: var(--bg-1); overflow-x: auto;")}>
                  <table style={css("width: 100%; border-collapse: collapse; font-family: var(--mono); font-size: 0.7rem; text-align: left; min-width: 480px;")}>
                    <thead>
                      <tr style={css("border-bottom: 1px solid var(--border); color: var(--text-2); font-size: 0.62rem; text-transform: uppercase;")}>
                        <th style={css("padding: 8px 12px;")}>Name</th>
                        <th style={css("padding: 8px 12px;")}>Size</th>
                        <th style={css("padding: 8px 12px;")}>Type</th>
                        <th style={css("padding: 8px 12px;")}>Modified</th>
                        <th style={css("padding: 8px 12px; text-align: right;")}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {files.map((file) => (
                        <tr
                          key={file.id}
                          onClick={() => setSelectedFile(file)}
                          onDoubleClick={() => setPreviewFile(file)}
                          style={css("border-bottom: 1px solid var(--border-subtle); cursor: pointer;")}
                        >
                          <td style={css("padding: 8px 12px; display: flex; align-items: center; gap: 8px; color: var(--text-0);")}>
                            {renderFileIcon(file)}
                            <span style={css("max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;")}>{file.name}</span>
                          </td>
                          <td style={css("padding: 8px 12px; color: var(--text-2);")}>{formatBytes(file.size)}</td>
                          <td style={css("padding: 8px 12px; color: var(--text-2); max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;")}>{file.content_type}</td>
                          <td style={css("padding: 8px 12px; color: var(--text-2);")}>{formatDate(file.updated_at)}</td>
                          <td style={css("padding: 8px 12px; text-align: right;")}>
                            <div style={css("display: flex; align-items: center; justify-content: flex-end; gap: 6px;")}>
                              <button
                                onClick={(e) => handleToggleStarFile(file, e)}
                                style={css("background: none; border: none; color: var(--text-2); cursor: pointer;")}
                              >
                                <Star style={css(`width: 12px; height: 12px; ${file.is_starred ? 'fill: var(--accent); color: var(--accent);' : ''}`)} />
                              </button>
                              <a
                                href={getFileDownloadLink(file)}
                                download={file.name}
                                onClick={(e) => e.stopPropagation()}
                                style={css("color: var(--text-2); display: flex; text-decoration: none;")}
                              >
                                <Download style={css("width: 12px; height: 12px;")} />
                              </a>
                              <button
                                onClick={(e) => handleDeleteFile(file, tab === 'trash', e)}
                                style={css("background: none; border: none; color: var(--text-2); cursor: pointer;")}
                              >
                                <Trash2 style={css("width: 12px; height: 12px;")} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Mobile Floating Action Button (FAB) for Upload */}
      <button
        onClick={() => fileInputRef.current?.click()}
        className="mobile-fab-upload"
        title="Upload"
        aria-label="Upload Files"
      >
        <Plus style={css("width: 22px; height: 22px; stroke-width: 2.5;")} />
      </button>

      {/* Hidden File Input for Mobile & Desktop */}
      <input
        type="file"
        ref={fileInputRef}
        multiple
        style={css("display: none;")}
        onChange={(e) => handleUploadFiles(e.target.files)}
      />

      {/* Mobile Dedicated Bottom Navigation Bar */}
      <div className="mobile-bottom-nav">
        <button
          onClick={() => {
            setTab('all');
            setCurrentFolderId('root');
            setSearchQuery('');
          }}
          className={`mobile-nav-item ${tab === 'all' && !searchQuery ? 'active' : ''}`}
        >
          <Folder style={css("width: 16px; height: 16px;")} />
          <span>Storage</span>
        </button>

        <button
          onClick={() => {
            setTab('starred');
            setSearchQuery('');
          }}
          className={`mobile-nav-item ${tab === 'starred' ? 'active' : ''}`}
        >
          <Star style={css("width: 16px; height: 16px;")} />
          <span>Starred</span>
        </button>

        <button
          onClick={() => setNewFolderOpen(true)}
          className="mobile-nav-item"
        >
          <FolderPlus style={css("width: 16px; height: 16px;")} />
          <span>New Folder</span>
        </button>

        <button
          onClick={() => {
            setTab('trash');
            setSearchQuery('');
          }}
          className={`mobile-nav-item trash ${tab === 'trash' ? 'active' : ''}`}
        >
          <Trash2 style={css("width: 16px; height: 16px;")} />
          <span>Trash</span>
        </button>
      </div>

      {/* Mobile Drawer Backdrop and Menu */}
      {drawerOpen && (
        <div
          onClick={() => setDrawerOpen(false)}
          style={css("position: fixed; inset: 0; z-index: 200; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); display: flex;")}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={css("width: 260px; height: 100%; background: var(--bg-1); border-right: 1px solid var(--border); padding: 20px 16px; display: flex; flex-direction: column;")}
          >
            <div style={css("display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; border-bottom: 1px solid var(--border); padding-bottom: 12px;")}>
              <div className="nav-brand">
                <span className="dot"></span>
                <span>R2.DRIVE</span>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                style={css("background: none; border: none; color: var(--text-2); cursor: pointer;")}
              >
                <X style={css("width: 16px; height: 16px;")} />
              </button>
            </div>

            <div style={css("display: flex; flex-direction: column; gap: 8px; margin-bottom: 24px;")}>
              <button
                onClick={() => {
                  setDrawerOpen(false);
                  fileInputRef.current?.click();
                }}
                style={css("display: flex; align-items: center; justify-content: center; gap: 8px; background: var(--accent); color: #0a0a0c; font-family: var(--mono); font-weight: 600; font-size: 0.72rem; padding: 10px; border: none; border-radius: 3px; cursor: pointer;")}
              >
                <Upload style={css("width: 14px; height: 14px;")} />
                <span>UPLOAD FILES</span>
              </button>
              <button
                onClick={() => {
                  setDrawerOpen(false);
                  setNewFolderOpen(true);
                }}
                style={css("display: flex; align-items: center; justify-content: center; gap: 8px; background: var(--bg-2); border: 1px solid var(--border); color: var(--text-0); font-family: var(--mono); font-size: 0.72rem; padding: 9px; border-radius: 3px; cursor: pointer;")}
              >
                <FolderPlus style={css("width: 14px; height: 14px; color: var(--accent);")} />
                <span>NEW FOLDER</span>
              </button>
            </div>

            <div style={css("display: flex; flex-direction: column; gap: 6px; font-family: var(--mono); font-size: 0.75rem;")}>
              <button
                onClick={() => {
                  setTab('all');
                  setCurrentFolderId('root');
                  setDrawerOpen(false);
                }}
                style={css(`display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 3px; border: none; background: ${tab === 'all' ? 'var(--bg-2)' : 'transparent'}; color: ${tab === 'all' ? 'var(--accent)' : 'var(--text-1)'}; cursor: pointer; width: 100%; text-align: left;`)}
              >
                <Folder style={css("width: 15px; height: 15px; color: var(--accent);")} />
                <span>My Storage</span>
              </button>

              <button
                onClick={() => {
                  setTab('starred');
                  setDrawerOpen(false);
                }}
                style={css(`display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 3px; border: none; background: ${tab === 'starred' ? 'var(--bg-2)' : 'transparent'}; color: ${tab === 'starred' ? 'var(--accent)' : 'var(--text-1)'}; cursor: pointer; width: 100%; text-align: left;`)}
              >
                <Star style={css("width: 15px; height: 15px; color: var(--accent);")} />
                <span>Starred</span>
              </button>

              <button
                onClick={() => {
                  setTab('trash');
                  setDrawerOpen(false);
                }}
                style={css(`display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 3px; border: none; background: ${tab === 'trash' ? 'var(--bg-2)' : 'transparent'}; color: ${tab === 'trash' ? 'var(--red-soft)' : 'var(--text-1)'}; cursor: pointer; width: 100%; text-align: left;`)}
              >
                <Trash2 style={css("width: 15px; height: 15px; color: var(--red-soft);")} />
                <span>Trash Bin</span>
              </button>
            </div>

            <div style={css("margin-top: auto; border-top: 1px solid var(--border-subtle); padding-top: 14px; font-family: var(--mono); font-size: 0.65rem; color: var(--text-2);")}>
              <div style={css("margin-bottom: 4px;")}>Total: {formatBytes(stats.totalBytes)} ({stats.totalFiles} files)</div>
              <div>R2: <span style={css(`color: ${r2Configured ? 'var(--green-soft)' : 'var(--red-soft)'};`)}>{r2Configured ? 'Connected' : 'Missing'}</span></div>
            </div>
          </div>
        </div>
      )}

      {/* New Folder Modal */}
      {newFolderOpen && (
        <div style={css("position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.75); backdrop-filter: blur(4px); padding: 16px;")}>
          <form
            onSubmit={handleCreateFolder}
            style={css("width: 100%; max-width: 360px; background: var(--bg-1); border: 1px solid var(--border); border-radius: 4px; padding: 20px; box-shadow: 0 10px 25px rgba(0,0,0,0.5);")}
          >
            <div style={css("display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;")}>
              <span style={css("font-family: var(--mono); font-size: 0.72rem; text-transform: uppercase; letter-spacing: 1px; color: var(--text-0);")}>New Directory</span>
              <button
                type="button"
                onClick={() => setNewFolderOpen(false)}
                style={css("background: none; border: none; color: var(--text-2); cursor: pointer;")}
              >
                <X style={css("width: 16px; height: 16px;")} />
              </button>
            </div>

            <div style={css("margin-bottom: 16px;")}>
              <label style={css("display: block; font-family: var(--mono); font-size: 0.65rem; color: var(--text-2); text-transform: uppercase; margin-bottom: 6px;")}>Folder Name</label>
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                autoFocus
                placeholder="e.g. dossiers, assets, music"
                style={css("width: 100%; background: var(--bg-0); border: 1px solid var(--border); border-radius: 3px; padding: 8px 10px; font-family: var(--mono); font-size: 0.75rem; color: var(--text-0); outline: none;")}
              />
            </div>

            <div style={css("margin-bottom: 20px;")}>
              <label style={css("display: block; font-family: var(--mono); font-size: 0.65rem; color: var(--text-2); text-transform: uppercase; margin-bottom: 8px;")}>Color Marker</label>
              <div style={css("display: flex; gap: 8px;")}>
                {['#c49368', '#6a9e9e', '#b05050', '#6a9a6a', '#a08060', '#5ab2ff'].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setFolderColor(c)}
                    style={css(`
                      width: 22px;
                      height: 22px;
                      border-radius: 50%;
                      border: 1px solid rgba(0,0,0,0.5);
                      background: ${c};
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      cursor: pointer;
                    `)}
                  >
                    {folderColor === c && <Check style={css("width: 12px; height: 12px; color: #0a0a0c; stroke-width: 3;")} />}
                  </button>
                ))}
              </div>
            </div>

            <div style={css("display: flex; justify-content: flex-end; gap: 8px; font-family: var(--mono); font-size: 0.72rem;")}>
              <button
                type="button"
                onClick={() => setNewFolderOpen(false)}
                style={css("padding: 7px 12px; border-radius: 3px; border: 1px solid var(--border); background: transparent; color: var(--text-1); cursor: pointer;")}
              >
                CANCEL
              </button>
              <button
                type="submit"
                style={css("padding: 7px 16px; border-radius: 3px; border: none; background: var(--accent); color: #0a0a0c; font-weight: 600; cursor: pointer;")}
              >
                CREATE
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Preview Modal */}
      {previewFile && (
        <div style={css("position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.85); backdrop-filter: blur(6px); padding: 14px;")}>
          <div style={css("width: 100%; max-width: 720px; background: var(--bg-1); border: 1px solid var(--border); border-radius: 4px; overflow: hidden; display: flex; flex-direction: column; max-height: 85vh;")}>
            <div style={css("padding: 10px 14px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; background: var(--bg-0);")}>
              <div style={css("display: flex; align-items: center; gap: 8px; font-family: var(--mono); font-size: 0.72rem; overflow: hidden;")}>
                {renderFileIcon(previewFile)}
                <span style={css("color: var(--text-0); font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 180px;")}>{previewFile.name}</span>
                <span style={css("color: var(--text-2);")}>({formatBytes(previewFile.size)})</span>
              </div>
              <div style={css("display: flex; align-items: center; gap: 6px;")}>
                <a
                  href={getFileDownloadLink(previewFile)}
                  download={previewFile.name}
                  style={css("display: flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: 3px; background: var(--bg-2); border: 1px solid var(--border); color: var(--text-1); text-decoration: none; font-family: var(--mono); font-size: 0.65rem;")}
                >
                  <Download style={css("width: 12px; height: 12px;")} />
                  <span>SAVE</span>
                </a>
                <button
                  onClick={() => setPreviewFile(null)}
                  style={css("background: none; border: none; color: var(--text-2); cursor: pointer; display: flex; padding: 4px;")}
                >
                  <X style={css("width: 16px; height: 16px;")} />
                </button>
              </div>
            </div>

            <div style={css("flex: 1; padding: 16px; overflow: auto; display: flex; align-items: center; justify-content: center; background: #08080a;")}>
              {getFileCategory(previewFile.content_type, previewFile.name) === 'image' && (
                <img
                  src={getFileDownloadLink(previewFile)}
                  alt={previewFile.name}
                  style={css("max-height: 60vh; max-width: 100%; object-fit: contain; border-radius: 3px;")}
                />
              )}

              {getFileCategory(previewFile.content_type, previewFile.name) === 'video' && (
                <video
                  src={getFileDownloadLink(previewFile)}
                  controls
                  style={css("max-height: 60vh; max-width: 100%; border-radius: 3px;")}
                />
              )}

              {getFileCategory(previewFile.content_type, previewFile.name) === 'audio' && (
                <div style={css("width: 100%; max-width: 380px; padding: 20px; background: var(--bg-1); border: 1px solid var(--border); border-radius: 4px; text-align: center;")}>
                  <Music style={css("width: 36px; height: 36px; color: var(--teal); margin: 0 auto 10px;")} />
                  <div style={css("font-family: var(--mono); font-size: 0.72rem; color: var(--text-0); margin-bottom: 14px;")}>{previewFile.name}</div>
                  <audio src={getFileDownloadLink(previewFile)} controls style={css("width: 100%;")} />
                </div>
              )}

              {['code', 'doc', 'archive', 'pdf'].includes(
                getFileCategory(previewFile.content_type, previewFile.name)
              ) && (
                <div style={css("text-align: center; font-family: var(--mono); padding: 24px 8px;")}>
                  <FileText style={css("width: 36px; height: 36px; color: var(--accent); margin: 0 auto 10px;")} />
                  <div style={css("font-size: 0.8rem; color: var(--text-0); margin-bottom: 4px;")}>{previewFile.name}</div>
                  <div style={css("font-size: 0.68rem; color: var(--text-2); margin-bottom: 14px;")}>{previewFile.content_type}</div>
                  <a
                    href={getFileDownloadLink(previewFile)}
                    target="_blank"
                    rel="noreferrer"
                    style={css("display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 3px; background: var(--bg-2); border: 1px solid var(--border); font-size: 0.7rem; color: var(--accent); text-decoration: none;")}
                  >
                    <span>Open in Browser</span>
                    <ExternalLink style={css("width: 12px; height: 12px;")} />
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {settingsOpen && (
        <div style={css("position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.75); backdrop-filter: blur(4px); padding: 16px;")}>
          <div style={css("width: 100%; max-width: 440px; background: var(--bg-1); border: 1px solid var(--border); border-radius: 4px; padding: 20px; font-family: var(--mono); font-size: 0.72rem;")}>
            <div style={css("display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; border-bottom: 1px solid var(--border); padding-bottom: 8px;")}>
              <span style={css("text-transform: uppercase; letter-spacing: 1px; color: var(--text-0);")}>Storage Engine Configuration</span>
              <button onClick={() => setSettingsOpen(false)} style={css("background: none; border: none; color: var(--text-2); cursor: pointer;")}>
                <X style={css("width: 16px; height: 16px;")} />
              </button>
            </div>

            <div style={css("display: flex; flex-direction: column; gap: 14px; color: var(--text-1);")}>
              <div>
                <span style={css("color: var(--text-2); display: block; margin-bottom: 4px;")}>DATABASE ENGINE</span>
                <div style={css("padding: 8px 10px; background: var(--bg-0); border: 1px solid var(--border); border-radius: 3px; color: var(--teal);")}>
                  SQLite local storage engine (storage.db)
                </div>
              </div>

              <div>
                <span style={css("color: var(--text-2); display: block; margin-bottom: 4px;")}>CLOUDFLARE R2 CREDENTIALS</span>
                <div style={css("padding: 10px; background: var(--bg-0); border: 1px solid var(--border); border-radius: 3px; display: flex; flex-direction: column; gap: 6px;")}>
                  <div style={css("display: flex; justify-content: space-between;")}>
                    <span style={css("color: var(--text-2);")}>Status:</span>
                    <span style={css(`color: ${r2Configured ? 'var(--green-soft)' : 'var(--red-soft)'};`)}>
                      {r2Configured ? 'Connected & Active' : 'Credentials Missing'}
                    </span>
                  </div>
                  <div style={css("font-size: 0.65rem; color: var(--text-2); margin-top: 8px; border-top: 1px solid var(--border-subtle); padding-top: 8px; line-height: 1.6;")}>
                    Set these environment variables in your <code style={css("color: var(--accent);")}>.env.local</code> file:
                    <div style={css("margin-top: 4px; color: var(--text-0);")}>
                      R2_ACCOUNT_ID=...<br />
                      R2_ACCESS_KEY_ID=...<br />
                      R2_SECRET_ACCESS_KEY=...<br />
                      R2_BUCKET_NAME=...<br />
                      R2_PUBLIC_URL=https://cdn.example.com
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div style={css("margin-top: 20px; display: flex; justify-content: flex-end;")}>
              <button
                onClick={() => setSettingsOpen(false)}
                style={css("padding: 6px 14px; border-radius: 3px; background: var(--bg-2); border: 1px solid var(--border); color: var(--text-0); cursor: pointer;")}
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
