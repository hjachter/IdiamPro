import type { Outline } from '@/types';

export async function exportOutlineToJson(outline: Outline): Promise<void> {
  const dataStr = JSON.stringify(outline, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const defaultName = `${outline.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;

  // Try to use the File System Access API for folder selection
  if ('showSaveFilePicker' in window) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: defaultName,
        types: [{
          description: 'JSON Files',
          accept: { 'application/json': ['.json'] },
        }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (err: any) {
      // User cancelled or API not supported, fall back to download
      if (err.name === 'AbortError') return;
    }
  }

  // Fallback for browsers without File System Access API
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = defaultName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function exportAllOutlinesToJson(outlines: Outline[]): Promise<void> {
  // Filter out the guide outline
  const userOutlines = outlines.filter(o => !o.isGuide);

  const dataStr = JSON.stringify(userOutlines, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const defaultName = `idiampro_backup_${timestamp}.json`;

  // Try to use the File System Access API for folder selection
  if ('showSaveFilePicker' in window) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: defaultName,
        types: [{
          description: 'JSON Files',
          accept: { 'application/json': ['.json'] },
        }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (err: any) {
      // User cancelled or API not supported, fall back to download
      if (err.name === 'AbortError') return;
    }
  }

  // Fallback for browsers without File System Access API
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = defaultName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
