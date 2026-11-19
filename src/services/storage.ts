import { SEED_DATABASE } from '../data/seedData';
import type { AppDatabase, DifficultyLevel, QuestionType } from '../types/exam';

const LOCAL_DB_KEY = 'smp_kartini_batam_cbt_db_v1';
const SESSION_USER_KEY = 'smp_kartini_batam_session_user_id_v1';

export interface BackendCapabilities {
  mode: 'server' | 'static';
  aiAvailable: boolean;
}

export async function checkBackendCapabilities(): Promise<BackendCapabilities> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1800);
    const res = await fetch('./api/health', { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) {
      return { mode: 'static', aiAvailable: false };
    }
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return { mode: 'static', aiAvailable: false };
    }
    const data = (await res.json()) as { ok?: boolean; aiAvailable?: boolean };
    if (data.ok) {
      return { mode: 'server', aiAvailable: Boolean(data.aiAvailable) };
    }
    return { mode: 'static', aiAvailable: false };
  } catch {
    return { mode: 'static', aiAvailable: false };
  }
}

export function readLocalDatabase(): AppDatabase | null {
  try {
    const raw = localStorage.getItem(LOCAL_DB_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppDatabase;
    if (
      parsed &&
      Array.isArray(parsed.users) &&
      Array.isArray(parsed.questions) &&
      Array.isArray(parsed.exams) &&
      Array.isArray(parsed.submissions)
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function writeLocalDatabase(db: AppDatabase): void {
  try {
    localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(db));
  } catch {
    // Ignore storage quota errors in private browsing
  }
}

export async function loadDatabase(): Promise<{
  db: AppDatabase;
  capabilities: BackendCapabilities;
}> {
  const capabilities = await checkBackendCapabilities();
  if (capabilities.mode === 'server') {
    try {
      const res = await fetch('./api/state');
      if (res.ok) {
        const serverDb = (await res.json()) as AppDatabase;
        writeLocalDatabase(serverDb);
        return { db: serverDb, capabilities };
      }
    } catch {
      // Fallback below
    }
  }

  const cached = readLocalDatabase();
  if (cached) {
    return { db: cached, capabilities };
  }

  const initial = structuredClone(SEED_DATABASE);
  writeLocalDatabase(initial);
  return { db: initial, capabilities };
}

export async function persistDatabase(
  db: AppDatabase,
  capabilities: BackendCapabilities
): Promise<void> {
  writeLocalDatabase(db);
  if (capabilities.mode === 'server') {
    try {
      await fetch('./api/state', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(db),
      });
    } catch {
      // LocalStorage already updated
    }
  }
}

export async function resetDatabase(
  capabilities: BackendCapabilities
): Promise<AppDatabase> {
  if (capabilities.mode === 'server') {
    try {
      const res = await fetch('./api/reset', { method: 'POST' });
      if (res.ok) {
        const fresh = (await res.json()) as AppDatabase;
        writeLocalDatabase(fresh);
        return fresh;
      }
    } catch {
      // Fallback below
    }
  }
  const fresh = structuredClone(SEED_DATABASE);
  writeLocalDatabase(fresh);
  return fresh;
}

export function getSavedSessionUserId(): string | null {
  try {
    return localStorage.getItem(SESSION_USER_KEY);
  } catch {
    return null;
  }
}

export function saveSessionUserId(userId: string | null): void {
  try {
    if (userId) {
      localStorage.setItem(SESSION_USER_KEY, userId);
    } else {
      localStorage.removeItem(SESSION_USER_KEY);
    }
  } catch {
    // Ignore
  }
}

export interface GeneratedQuestionDraft {
  prompt: string;
  options?: string[];
  correctOptionIndex?: number;
  rubric?: string;
  difficulty: DifficultyLevel;
  points: number;
}

export async function requestAiQuestionGeneration(params: {
  subject: string;
  gradeLevel: '7' | '8' | '9';
  topic: string;
  questionType: QuestionType;
  count: number;
}): Promise<{ questions?: GeneratedQuestionDraft[]; error?: string }> {
  try {
    const res = await fetch('./api/ai/teacher-assist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'generate_questions', ...params }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { error: data.error || 'Gagal menghasilkan soal dengan AI.' };
    }
    return { questions: data.questions };
  } catch {
    return {
      error:
        'Server AI tidak terjangkau. Mode statis (GitHub Pages) berjalan tanpa server Node/Gemini.',
    };
  }
}

export async function requestAiExamAnalysis(
  analysisPrompt: string
): Promise<{ analysis?: string; error?: string }> {
  try {
    const res = await fetch('./api/ai/teacher-assist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'analyze_exam', analysisPrompt }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { error: data.error || 'Gagal menganalisis ujian.' };
    }
    return { analysis: data.analysis };
  } catch {
    return {
      error:
        'Server AI tidak terjangkau. Mode statis (GitHub Pages) berjalan tanpa server Node/Gemini.',
    };
  }
}
