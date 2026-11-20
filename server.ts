import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { SEED_DATABASE } from './src/data/seedData.ts';
import type { AppDatabase } from './src/types/exam.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolveServerPort(): number {
  const portFlagIndex = process.argv.indexOf('--port');
  if (portFlagIndex !== -1 && process.argv[portFlagIndex + 1]) {
    const cliPort = Number(process.argv[portFlagIndex + 1]);
    if (Number.isFinite(cliPort) && cliPort > 0) {
      return cliPort;
    }
  }
  const envPort = Number(process.env.PORT);
  const nginxPort = Number(process.env.NGINX_PORT);
  if (
    process.env.NODE_ENV !== 'production' &&
    Number.isFinite(envPort) &&
    Number.isFinite(nginxPort) &&
    envPort === nginxPort
  ) {
    const fallbackPort = Number(process.env.DEFAULT_APP_PORT || 3000);
    return Number.isFinite(fallbackPort) && fallbackPort > 0 ? fallbackPort : 3000;
  }
  return Number.isFinite(envPort) && envPort > 0 ? envPort : 3000;
}

const PORT = resolveServerPort();
const DATA_DIR = path.resolve(__dirname, 'data');
const DB_FILE = path.resolve(DATA_DIR, 'db.json');

function ensureDatabase(): AppDatabase {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify(SEED_DATABASE, null, 2), 'utf-8');
      return structuredClone(SEED_DATABASE);
    }
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as AppDatabase;
    if (!parsed || !Array.isArray(parsed.users) || !Array.isArray(parsed.exams)) {
      throw new Error('Invalid database shape');
    }
    return parsed;
  } catch {
    return structuredClone(SEED_DATABASE);
  }
}

function writeDatabase(db: AppDatabase): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
}

function createGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '25mb' }));

  app.get('/api/health', (_req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    const aiAvailable = Boolean(apiKey && apiKey !== 'MY_GEMINI_API_KEY');
    res.json({ ok: true, mode: 'server', aiAvailable });
  });

  app.get('/api/state', (_req, res) => {
    const db = ensureDatabase();
    res.json(db);
  });

  app.put('/api/state', (req, res) => {
    const body = req.body as AppDatabase;
    if (
      !body ||
      !Array.isArray(body.users) ||
      !Array.isArray(body.questions) ||
      !Array.isArray(body.exams) ||
      !Array.isArray(body.submissions)
    ) {
      res.status(400).json({ error: 'Format data sistem ujian tidak valid.' });
      return;
    }
    writeDatabase(body);
    res.json({ ok: true });
  });

  app.post('/api/reset', (_req, res) => {
    const fresh = structuredClone(SEED_DATABASE);
    writeDatabase(fresh);
    res.json(fresh);
  });

  app.post('/api/ai/teacher-assist', async (req, res) => {
    const ai = createGeminiClient();
    if (!ai) {
      res.status(503).json({
        error:
          'Kunci GEMINI_API_KEY belum terpasang di server. Tambahkan API key pada Settings > Secrets untuk memakai Asisten Penalaran Mendalam.',
      });
      return;
    }

    const { mode, subject, gradeLevel, topic, questionType, count, analysisPrompt } =
      req.body as {
        mode: 'generate_questions' | 'analyze_exam';
        subject?: string;
        gradeLevel?: '7' | '8' | '9';
        topic?: string;
        questionType?: 'pg' | 'esai';
        count?: number;
        analysisPrompt?: string;
      };

    try {
      if (mode === 'generate_questions') {
        const safeCount = Math.min(5, Math.max(1, Number(count) || 2));
        const qType = questionType === 'esai' ? 'esai' : 'pg';

        const response = await ai.models.generateContent({
          model: 'gemini-4-carbon',
          contents: `Buatkan ${safeCount} soal ujian SMP (${gradeLevel ? `Kelas ${gradeLevel}` : 'Kelas 9'}) mata pelajaran ${subject || 'Matematika'} dengan topik "${topic || 'Pemecahan Masalah Kontekstual'}". Tipe soal: ${qType === 'pg' ? 'Pilihan Ganda (4 opsi A-D, 1 jawaban benar)' : 'Esai / Uraian lengkap dengan rubrik penilaian'}. Pastikan soal bernuansa Kurikulum Merdeka, menguji penalaran tingkat tinggi (HOTS), jelas, dan bebas ambiguitas.`,
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
            systemInstruction:
              'Anda adalah pakar asesmen pendidikan SMP di Indonesia (SMP Kartini 1 Batam). Hasilkan soal berkualitas tinggi dalam bahasa Indonesia baku.',
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  prompt: {
                    type: Type.STRING,
                    description: 'Teks pertanyaan ujian yang jelas untuk siswa SMP.',
                  },
                  options: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: '4 opsi jawaban jika pilihan ganda, atau array kosong jika esai.',
                  },
                  correctOptionIndex: {
                    type: Type.INTEGER,
                    description: 'Indeks 0..3 jawaban benar untuk pilihan ganda.',
                  },
                  rubric: {
                    type: Type.STRING,
                    description: 'Pedoman penskoran atau pembahasan singkat.',
                  },
                  difficulty: {
                    type: Type.STRING,
                    description: 'Mudah, Sedang, atau Sulit',
                  },
                  points: {
                    type: Type.INTEGER,
                    description: 'Bobot poin soal (contoh 20 atau 25).',
                  },
                },
                required: ['prompt', 'difficulty', 'points', 'rubric'],
              },
            },
          },
        });

        const rawJson = (response.text ?? '[]').trim();
        const generated = JSON.parse(rawJson);
        res.json({ ok: true, questions: generated });
        return;
      }

      if (mode === 'analyze_exam') {
        const response = await ai.models.generateContent({
          model: 'gemini-4-carbon',
          contents:
            analysisPrompt ||
            'Berikan evaluasi pedagogis dan rekomendasi tindak lanjut remedial untuk hasil ujian siswa SMP Kartini 1 Batam.',
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
            systemInstruction:
              'Anda adalah konsultan evaluasi pembelajaran SMP Kartini 1 Batam. Berikan analisis tajam, terstruktur, dan praktis dalam bahasa Indonesia dengan poin-poin yang mudah ditindaklanjuti oleh guru.',
          },
        });

        res.json({ ok: true, analysis: response.text ?? '' });
        return;
      }

      res.status(400).json({ error: 'Mode asisten AI tidak dikenali.' });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Terjadi kesalahan saat menghubungi layanan Gemini.';
      res.status(502).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const hmrEnabled = process.env.DISABLE_HMR !== 'true';
    const vitePromise = import('vite').then(({ createServer: createViteServer }) =>
      createViteServer({
        server: {
          middlewareMode: true,
          hmr: hmrEnabled,
          ws: hmrEnabled ? undefined : false,
        },
        appType: 'spa',
      })
    );

    vitePromise.catch((err) => {
      console.error('Failed to initialize Vite middleware:', err);
    });

    app.use(async (req, res, next) => {
      try {
        const vite = await vitePromise;
        vite.middlewares(req, res, next);
      } catch (err) {
        next(err);
      }
    });
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SMP Kartini 1 Batam CBT server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
