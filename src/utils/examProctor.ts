// Browser proctoring utilities: fullscreen enforcement, max-volume alert siren & speech warning

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedAudioCtx) {
    sharedAudioCtx = new AudioCtx();
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

export function playVolumeTestTone(): boolean {
  try {
    const ctx = getAudioContext();
    if (!ctx) return false;
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.14);
      gain.gain.setValueAtTime(1.0, now + idx * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.14 + 0.13);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.14);
      osc.stop(now + idx * 0.14 + 0.14);
    });
    return true;
  } catch {
    return false;
  }
}

export function playViolationAlertSound(
  strikeCount: number,
  isFinalAutoSubmit: boolean
): void {
  try {
    const ctx = getAudioContext();
    if (ctx) {
      const now = ctx.currentTime;
      const bursts = isFinalAutoSubmit ? 4 : 3;
      for (let i = 0; i < bursts; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        const start = now + i * 0.24;
        osc.frequency.setValueAtTime(i % 2 === 0 ? 940 : 680, start);
        gain.gain.setValueAtTime(1.0, start);
        gain.gain.exponentialRampToValueAtTime(0.02, start + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.21);
      }
    }
  } catch {
    // Web Audio may fail in restricted contexts; fall through gracefully
  }

  try {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const text = isFinalAutoSubmit
        ? `Peringatan ke-${strikeCount}. Batas pindah tab tercapai, ujian diselesaikan otomatis.`
        : `Peringatan pengawas! Terdeteksi keluar dari layar ujian, pelanggaran ke-${strikeCount}.`;
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'id-ID';
      utter.volume = 1.0;
      utter.rate = 1.05;
      window.speechSynthesis.speak(utter);
    }
  } catch {
    // Ignore speech synthesis errors in headless environments
  }
}

export function isFullscreenSupported(): boolean {
  if (typeof document === 'undefined') return false;
  return Boolean(
    document.fullscreenEnabled ||
      (document.documentElement as HTMLElement & {
        webkitRequestFullscreen?: () => Promise<void>;
      }).webkitRequestFullscreen
  );
}

export function isCurrentlyFullscreen(): boolean {
  if (typeof document === 'undefined') return false;
  return Boolean(
    document.fullscreenElement ||
      (document as Document & { webkitFullscreenElement?: Element | null })
        .webkitFullscreenElement
  );
}

export async function requestExamFullscreen(): Promise<boolean> {
  if (typeof document === 'undefined') return false;
  try {
    const root = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void>;
    };
    if (isCurrentlyFullscreen()) return true;
    if (root.requestFullscreen) {
      await root.requestFullscreen();
      return true;
    }
    if (root.webkitRequestFullscreen) {
      await root.webkitRequestFullscreen();
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function exitExamFullscreen(): Promise<void> {
  if (typeof document === 'undefined') return;
  try {
    const doc = document as Document & {
      webkitFullscreenElement?: Element | null;
      webkitExitFullscreen?: () => Promise<void>;
    };
    if (doc.fullscreenElement && doc.exitFullscreen) {
      await doc.exitFullscreen();
    } else if (doc.webkitFullscreenElement && doc.webkitExitFullscreen) {
      await doc.webkitExitFullscreen();
    }
  } catch {
    // Ignore errors when fullscreen was already exited
  }
}
