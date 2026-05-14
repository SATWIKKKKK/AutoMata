import dotenv from 'dotenv';
import path from 'node:path';
import { loadFrontendCuratedQuestions } from '../src/lib/frontendCuratedQuestionBank.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: false });

type VerificationResult = {
  checked: number;
  mismatches: Array<{ id: string; reason: string }>;
};

const compatBaseUrl = (process.env.AICREDITS_BASE_URL || process.env.OPENAI_COMPAT_BASE_URL || 'https://api.aicredits.in/v1').replace(/\/$/, '');
const apiKey = process.env.AICREDITS_API_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
const model = process.env.GITHUB_SCAN_MODEL || 'deepseek/deepseek-chat';

if (!apiKey) {
  throw new Error('No compatible API key is configured for DeepSeek verification.');
}

const { questions, report } = loadFrontendCuratedQuestions();

const chunks = [
  questions.filter((question) => question.type === 'mcq'),
  questions.filter((question) => question.type === 'fill_blank'),
  ...chunk(questions.filter((question) => question.type === 'scenario'), 20),
  ...chunk(questions.filter((question) => question.topic === 'Frontend Architecture'), 15),
  ...chunk(questions.filter((question) => question.type === 'coding'), 10),
  ...chunk(questions.filter((question) => question.type === 'mock'), 15),
  ...chunk(questions.filter((question) => question.tags.includes('faang')), 10),
].filter((items) => items.length);

function chunk<T>(items: T[], size: number) {
  const output: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    output.push(items.slice(index, index + size));
  }
  return output;
}

async function verifyBatch(batch: typeof questions): Promise<VerificationResult> {
  const pairs = batch.map((question) => ({
    id: question.id,
    question: question.questionText,
    answer: question.correctAnswer,
  }));

  const response = await fetch(`${compatBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 2000,
      messages: [
        {
          role: 'system',
          content: 'You audit whether a stored answer clearly belongs to the paired interview question. Return only strict JSON with shape {"checked":number,"mismatches":[{"id":"string","reason":"string"}]}. Only flag a mismatch when the answer appears paired to a different question or plainly does not answer the given prompt.',
        },
        {
          role: 'user',
          content: JSON.stringify({ pairs }),
        },
      ],
    }),
  });

  const data = await response.json().catch(() => ({})) as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } };
  if (!response.ok) {
    throw new Error(data.error?.message || `DeepSeek verification failed with HTTP ${response.status}.`);
  }

  const raw = String(data.choices?.[0]?.message?.content ?? '').trim();
  const parsed = JSON.parse(raw) as VerificationResult;
  return {
    checked: Number(parsed.checked ?? batch.length),
    mismatches: Array.isArray(parsed.mismatches) ? parsed.mismatches : [],
  };
}

async function main() {
  const summary = {
    importedQuestions: 'importedQuestions' in report ? report.importedQuestions : report.totalQuestions,
    structuralSkippedQuestionNumbers: 'skippedQuestionNumbers' in report ? report.skippedQuestionNumbers : [],
    rounds: 'rounds' in report ? report.rounds : undefined,
    topics: 'topics' in report ? report.topics : undefined,
    deepseekChecked: 0,
    deepseekMismatches: [] as Array<{ id: string; reason: string }>,
  };

  for (const batch of chunks) {
    const result = await verifyBatch(batch);
    summary.deepseekChecked += result.checked;
    summary.deepseekMismatches.push(...result.mismatches);
  }

  console.log(JSON.stringify(summary, null, 2));
}

void main();
