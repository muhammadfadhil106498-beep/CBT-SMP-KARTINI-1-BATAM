export interface ProcessedImageResult {
  dataUrl: string;
  sizeKb: number;
}

export function readAndResizeImageAsDataUrl(
  file: File,
  options: { maxWidth: number; maxHeight: number; quality?: number } = {
    maxWidth: 1200,
    maxHeight: 800,
    quality: 0.84,
  }
): Promise<ProcessedImageResult> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('File harus berupa gambar (PNG, JPG, WebP, atau SVG).'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
    reader.onload = () => {
      const rawUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!rawUrl) {
        reject(new Error('Data gambar kosong.'));
        return;
      }

      // Preserve crisp SVG directly if reasonably sized
      if (file.type === 'image/svg+xml') {
        resolve({
          dataUrl: rawUrl,
          sizeKb: Math.round(rawUrl.length / 1024),
        });
        return;
      }

      const img = new Image();
      img.onerror = () => reject(new Error('Format gambar tidak dapat dimuat.'));
      img.onload = () => {
        const ratio = Math.min(
          1,
          options.maxWidth / Math.max(1, img.width),
          options.maxHeight / Math.max(1, img.height)
        );
        const targetWidth = Math.max(1, Math.round(img.width * ratio));
        const targetHeight = Math.max(1, Math.round(img.height * ratio));

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({
            dataUrl: rawUrl,
            sizeKb: Math.round(rawUrl.length / 1024),
          });
          return;
        }
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        const outputMime =
          file.type === 'image/png' || file.type === 'image/webp'
            ? 'image/webp'
            : 'image/jpeg';
        const dataUrl = canvas.toDataURL(outputMime, options.quality ?? 0.84);
        resolve({
          dataUrl,
          sizeKb: Math.round(dataUrl.length / 1024),
        });
      };
      img.src = rawUrl;
    };
    reader.readAsDataURL(file);
  });
}
