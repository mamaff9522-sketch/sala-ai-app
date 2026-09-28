/**
 * Direct file download helper that pulls the file directly from the app server
 * into in-memory Blob, avoiding opening external URLs or new browser tabs
 * which can trigger the Google AI Studio Cookie Check redirect screen.
 */

export async function downloadMediaFile(
  url: string,
  filename: string,
  onProgress?: (isDownloading: boolean) => void
): Promise<void> {
  try {
    if (onProgress) onProgress(true);

    // If it's a data URL (e.g. Gemini generated inline base64 image)
    if (url.startsWith('data:')) {
      const parts = url.split(',');
      const mimeMatch = parts[0].match(/:(.*?);/);
      const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
      const bstr = atob(parts[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      const blob = new Blob([u8arr], { type: mime });
      triggerBlobSave(blob, filename);
      return;
    }

    // Determine the optimal server download endpoint for videos
    let fetchUrl = url;
    if (url.includes('/api/video-stream/')) {
      const parts = url.split('/api/video-stream/');
      if (parts[1]) {
        fetchUrl = `/api/download/video/${parts[1]}`;
      }
    } else if (filename.endsWith('.mp4') && !url.includes('/api/download/video/')) {
      // If it's a video file, check if there's an ID
      const match = url.match(/job_[a-zA-Z0-9_-]+/);
      if (match) {
        fetchUrl = `/api/download/video/${match[0]}`;
      }
    }

    // Fetch directly from server as binary blob within current session
    const response = await fetch(fetchUrl);
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }

    const blob = await response.blob();
    triggerBlobSave(blob, filename);
  } catch (error) {
    console.warn('Direct blob fetch failed, falling back to local iframe anchor save:', error);
    // Safe DOM anchor download fallback without opening new window or external URL
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (document.body.contains(a)) {
        document.body.removeChild(a);
      }
    }, 1000);
  } finally {
    if (onProgress) onProgress(false);
  }
}

function triggerBlobSave(blob: Blob, filename: string) {
  const blobUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    if (document.body.contains(a)) {
      document.body.removeChild(a);
    }
    window.URL.revokeObjectURL(blobUrl);
  }, 2000);
}
