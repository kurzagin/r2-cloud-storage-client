export function formatBytes(bytes: number, decimals: number = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function getFileCategory(contentType: string, filename: string): 'image' | 'video' | 'audio' | 'pdf' | 'code' | 'archive' | 'doc' {
  const lowerName = filename.toLowerCase();
  if (contentType.startsWith('image/')) return 'image';
  if (contentType.startsWith('video/')) return 'video';
  if (contentType.startsWith('audio/')) return 'audio';
  if (contentType === 'application/pdf' || lowerName.endsWith('.pdf')) return 'pdf';
  if (
    lowerName.endsWith('.js') ||
    lowerName.endsWith('.ts') ||
    lowerName.endsWith('.tsx') ||
    lowerName.endsWith('.json') ||
    lowerName.endsWith('.html') ||
    lowerName.endsWith('.css') ||
    lowerName.endsWith('.py') ||
    lowerName.endsWith('.rs') ||
    lowerName.endsWith('.go') ||
    lowerName.endsWith('.md')
  ) {
    return 'code';
  }
  if (
    lowerName.endsWith('.zip') ||
    lowerName.endsWith('.tar') ||
    lowerName.endsWith('.gz') ||
    lowerName.endsWith('.7z') ||
    lowerName.endsWith('.rar')
  ) {
    return 'archive';
  }
  return 'doc';
}
