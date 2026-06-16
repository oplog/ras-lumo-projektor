/** Trigger a browser download of a text blob. */
export function downloadFile(filename: string, content: string, type = 'application/xml'): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Sanitize a station/file name for use as a download filename. */
export function safeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_');
}
