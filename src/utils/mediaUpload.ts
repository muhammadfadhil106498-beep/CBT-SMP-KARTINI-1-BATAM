import type { QuestionMedia, QuestionMediaType } from '../types/exam';
import { readAndResizeImageAsDataUrl } from './imageUpload';

export interface ProcessedQuestionMedia extends QuestionMedia {
  sizeKb: number;
}

const MAX_AUDIO_BYTES = 4 * 1024 * 1024;
const MAX_VIDEO_BYTES = 8 * 1024 * 1024;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca file media soal.'));
    reader.onload = () => {
      const res = typeof reader.result === 'string' ? reader.result : '';
      if (!res) {
        reject(new Error('File media kosong atau tidak dapat dibaca.'));
        return;
      }
      resolve(res);
    };
    reader.readAsDataURL(file);
  });
}

export function detectMediaTypeFromFile(file: File): QuestionMediaType | null {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('audio/')) return 'audio';
  if (file.type.startsWith('video/')) return 'video';

  const lower = file.name.toLowerCase();
  if (/\.(png|jpe?g|webp|gif|svg)$/.test(lower)) return 'image';
  if (/\.(mp3|wav|ogg|m4a|aac)$/.test(lower)) return 'audio';
  if (/\.(mp4|webm|mov)$/.test(lower)) return 'video';
  return null;
}

export function inferMediaTypeFromUrl(url: string): QuestionMediaType {
  const clean = url.trim().toLowerCase().split('?')[0];
  if (/\.(mp3|wav|ogg|m4a|aac)$/.test(clean) || clean.startsWith('data:audio/')) {
    return 'audio';
  }
  if (/\.(mp4|webm|mov)$/.test(clean) || clean.startsWith('data:video/')) {
    return 'video';
  }
  return 'image';
}

export async function readQuestionMediaFile(
  file: File
): Promise<ProcessedQuestionMedia> {
  const mediaType = detectMediaTypeFromFile(file);
  if (!mediaType) {
    throw new Error(
      'Format media tidak didukung. Unggah gambar (PNG/JPG/WebP), audio (MP3/WAV/OGG), atau video (MP4/WebM).'
    );
  }

  if (mediaType === 'image') {
    const resized = await readAndResizeImageAsDataUrl(file, {
      maxWidth: 1024,
      maxHeight: 768,
      quality: 0.85,
    });
    return {
      type: 'image',
      url: resized.dataUrl,
      name: file.name,
      sizeKb: resized.sizeKb,
    };
  }

  if (mediaType === 'audio' && file.size > MAX_AUDIO_BYTES) {
    throw new Error(
      'Ukuran file audio maksimal 4 MB agar cepat dimuat saat ujian berlangsung.'
    );
  }

  if (mediaType === 'video' && file.size > MAX_VIDEO_BYTES) {
    throw new Error(
      'Ukuran file video maksimal 8 MB agar tidak membebani penyimpanan ujian.'
    );
  }

  const dataUrl = await readFileAsDataUrl(file);
  return {
    type: mediaType,
    url: dataUrl,
    name: file.name,
    sizeKb: Math.round(dataUrl.length / 1024),
  };
}
