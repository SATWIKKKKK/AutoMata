import crypto from 'node:crypto';
import db, { withClient } from './db.js';
import { QUESTION_BANK, QUESTION_DOMAINS, type BankQuestion, type QuestionType } from './questionBank.js';

type DbQuestionRow = {
  id: string;
  domain: string;
  domain_label: string;
  topic: string;
  type: string;
  difficulty: number;
  question_text: string;
  options: unknown;
  correct_answer: string;
  explanation: string;
  code_snippet: string | null;
  tags: unknown;
  time_limit_minutes: number;
};

type DbRoundAttemptRow = {
  id: string;
  round_type: string;
  question_type: string;
  domain: string;
  status: string;
  duration_minutes: number;
  question_ids: unknown;
  answer_payload: unknown;
  result_payload: unknown;
  total_questions: number;
  correct_answers: number;
  score: number;
  time_spent_seconds: number | null;
  started_at: string;
  submitted_at: string | null;
  expires_at: string | null;
};

export type QuestionStatsItem = {
  id: string;
  label: string;
  total: number;
};

export type RoundAttemptAnswerInput = {
  questionId: string;
  selectedAnswer?: string | null;
  codeAnswer?: string | null;
  notes?: string | null;
};

export type RoundAttemptDetail = {
  questionId: string;
  topic: string;
  prompt: string;
  submittedAnswer: string | null;
  correctAnswer: string;
  explanation: string;
  isCorrect: boolean;
  score: number;
  observations: string[];
};

export type StoredRoundAttempt = {
  id: string;
  roundType: string;
  questionType: QuestionType;
  domain: string;
  status: string;
  durationMinutes: number;
  totalQuestions: number;
  correctAnswers: number;
  score: number;
  timeSpentSeconds: number | null;
  startedAt: string;
  submittedAt: string | null;
  expiresAt: string | null;
  summary: string;
  focusAreas: string[];
  nextSteps: string[];
  questions: BankQuestion[];
  answers: RoundAttemptAnswerInput[];
  results: RoundAttemptDetail[];
};

const questionSliceSeedPromises = new Map<string, Promise<void>>();

type AiEvaluation = {
  score?: number;
  isCorrect?: boolean;
  observations?: string[];
  explanation?: string;
};

function matchesSeedFilters(question: BankQuestion, filters: {
  domain?: string;
  type?: QuestionType | 'all';
  search?: string;
  faangOnly?: boolean;
}) {
  if (filters.domain && filters.domain !== 'all' && question.domain !== filters.domain) return false;
  if (filters.type && filters.type !== 'all' && question.type !== filters.type) return false;
  if (filters.faangOnly && !question.tags.includes('faang')) return false;

  const search = String(filters.search ?? '').trim().toLowerCase();
  if (!search) return true;

  return [question.questionText, question.topic, question.domainLabel, question.type, question.tags.join(' ')].some((value) => value.toLowerCase().includes(search));
}

function sortSeedQuestions(left: BankQuestion, right: BankQuestion) {
  return left.domainLabel.localeCompare(right.domainLabel)
    || left.topic.localeCompare(right.topic)
    || left.difficulty - right.difficulty
    || left.id.localeCompare(right.id);
}

async function upsertSeedQuestions(questions: BankQuestion[]) {
  if (!questions.length) return;

  await withClient(async (client) => {
    await client.query('BEGIN');
    try {
      for (let startIndex = 0; startIndex < questions.length; startIndex += 200) {
        const batch = questions.slice(startIndex, startIndex + 200).map((question) => ({
          id: question.id,
          domain: question.domain,
          domain_label: question.domainLabel,
          topic: question.topic,
          type: question.type,
          difficulty: question.difficulty,
          question_text: question.questionText,
          options: question.options ?? [],
          correct_answer: question.correctAnswer,
          explanation: question.explanation,
          code_snippet: question.codeSnippet ?? null,
          tags: question.tags,
          time_limit_minutes: question.timeLimitMinutes,
        }));

        await client.query(
          `INSERT INTO questions (
            id, domain, domain_label, topic, type, difficulty, question_text, options,
            correct_answer, explanation, code_snippet, tags, time_limit_minutes, created_at, updated_at
          )
          SELECT
            item.id,
            item.domain,
            item.domain_label,
            item.topic,
            item.type,
            item.difficulty,
            item.question_text,
            item.options,
            item.correct_answer,
            item.explanation,
            item.code_snippet,
            item.tags,
            item.time_limit_minutes,
            NOW(),
            NOW()
          FROM jsonb_to_recordset($1::jsonb) AS item(
            id text,
            domain text,
            domain_label text,
            topic text,
            type text,
            difficulty integer,
            question_text text,
            options jsonb,
            correct_answer text,
            explanation text,
            code_snippet text,
            tags jsonb,
            time_limit_minutes integer
          )
          ON CONFLICT (id) DO UPDATE SET
            domain = EXCLUDED.domain,
            domain_label = EXCLUDED.domain_label,
            topic = EXCLUDED.topic,
            type = EXCLUDED.type,
            difficulty = EXCLUDED.difficulty,
            question_text = EXCLUDED.question_text,
            options = EXCLUDED.options,
            correct_answer = EXCLUDED.correct_answer,
            explanation = EXCLUDED.explanation,
            code_snippet = EXCLUDED.code_snippet,
            tags = EXCLUDED.tags,
            time_limit_minutes = EXCLUDED.time_limit_minutes,
            updated_at = NOW()`,
          [JSON.stringify(batch)],
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}

async function ensureQuestionSliceSeeded(filters: {
  domain?: string;
  type?: QuestionType | 'all';
  search?: string;
  faangOnly?: boolean;
  limit?: number;
}) {
  const seedQuestions = QUESTION_BANK
    .filter((question) => matchesSeedFilters(question, filters))
    .sort(sortSeedQuestions)
    .slice(0, Math.max(1, Number(filters.limit ?? QUESTION_BANK.length)));

  if (!seedQuestions.length) return;

  const existingRows = await db.query<{ id: string }>(
    'SELECT id FROM questions WHERE id = ANY($1::text[])',
    [seedQuestions.map((question) => question.id)],
  );
  const existingIds = new Set(existingRows.map((row) => row.id));
  const missingQuestions = seedQuestions.filter((question) => !existingIds.has(question.id));
  if (!missingQuestions.length) return;

  const key = missingQuestions.map((question) => question.id).join('|');
  if (!questionSliceSeedPromises.has(key)) {
    questionSliceSeedPromises.set(key, upsertSeedQuestions(missingQuestions).finally(() => {
      questionSliceSeedPromises.delete(key);
    }));
  }

  await questionSliceSeedPromises.get(key);
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? '').trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    try {
      return asStringArray(JSON.parse(value));
    } catch {
      return value.trim() ? [value.trim()] : [];
    }
  }
  return [];
}

function asObject<T>(value: unknown, fallback: T): T {
  if (value && typeof value === 'object') return value as T;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function mapQuestionRow(row: DbQuestionRow): BankQuestion {
  return {
    id: row.id,
    domain: row.domain,
    domainLabel: row.domain_label,
    topic: row.topic,
    type: row.type as QuestionType,
    difficulty: Math.min(3, Math.max(1, Number(row.difficulty))) as 1 | 2 | 3,
    questionText: row.question_text,
    options: asStringArray(row.options),
    correctAnswer: row.correct_answer,
    explanation: row.explanation,
    codeSnippet: row.code_snippet ?? undefined,
    tags: asStringArray(row.tags),
    timeLimitMinutes: Number(row.time_limit_minutes),
  };
}

function questionSelectFields(alias = 'q') {
  return [
    `${alias}.id`,
    `${alias}.domain`,
    `${alias}.domain_label`,
    `${alias}.topic`,
    `${alias}.type`,
    `${alias}.difficulty`,
    `${alias}.question_text`,
    `${alias}.options`,
    `${alias}.correct_answer`,
    `${alias}.explanation`,
    `${alias}.code_snippet`,
    `${alias}.tags`,
    `${alias}.time_limit_minutes`,
  ].join(', ');
}

function buildQuestionFilterClause(
  filters: {
    domain?: string;
    type?: QuestionType | 'all';
    search?: string;
    faangOnly?: boolean;
  },
  params: unknown[],
  alias = 'q',
) {
  const conditions: string[] = [];

  if (filters.domain && filters.domain !== 'all') {
    params.push(filters.domain);
    conditions.push(`${alias}.domain = $${params.length}`);
  }

  if (filters.type && filters.type !== 'all') {
    params.push(filters.type);
    conditions.push(`${alias}.type = $${params.length}`);
  }

  if (filters.faangOnly) {
    params.push(JSON.stringify(['faang']));
    conditions.push(`${alias}.tags @> $${params.length}::jsonb`);
  }

  const normalizedSearch = String(filters.search ?? '').trim();
  if (normalizedSearch) {
    params.push(`%${normalizedSearch}%`);
    const searchParam = `$${params.length}`;
    conditions.push(`(
      ${alias}.question_text ILIKE ${searchParam}
      OR ${alias}.topic ILIKE ${searchParam}
      OR ${alias}.domain_label ILIKE ${searchParam}
      OR ${alias}.type ILIKE ${searchParam}
      OR ${alias}.tags::text ILIKE ${searchParam}
    )`);
  }

  return conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
}

async function getQuestionsByIds(ids: string[]): Promise<BankQuestion[]> {
  if (!ids.length) return [];

  const rows = await db.query<DbQuestionRow>(
    `SELECT ${questionSelectFields('q')}
       FROM questions q
      WHERE q.id = ANY($1::text[])`,
    [ids],
  );

  const questionsById = new Map(rows.map((row) => [row.id, mapQuestionRow(row)]));
  return ids.map((id) => questionsById.get(id)).filter(Boolean) as BankQuestion[];
}

function evaluateObjectiveAnswer(question: BankQuestion, answer: RoundAttemptAnswerInput | undefined): RoundAttemptDetail {
  const submittedAnswer = String(answer?.selectedAnswer ?? '').trim() || null;
  const isCorrect = submittedAnswer === question.correctAnswer;
  return {
    questionId: question.id,
    topic: question.topic,
    prompt: question.questionText,
    submittedAnswer,
    correctAnswer: question.correctAnswer,
    explanation: question.explanation,
    isCorrect,
    score: submittedAnswer ? (isCorrect ? 100 : 30) : 0,
    observations: [
      submittedAnswer
        ? (isCorrect ? 'Selected the stored correct answer for this prompt.' : 'Submitted an answer, but it did not match the stored solution.')
        : 'No answer was submitted before the round ended.',
    ],
  };
}

function evaluateCodingAnswer(question: BankQuestion, answer: RoundAttemptAnswerInput | undefined): RoundAttemptDetail {
  const submittedCode = String(answer?.codeAnswer ?? '').trim();
  const notes = String(answer?.notes ?? '').trim();
  const observations: string[] = [];
  let score = 0;

  if (!submittedCode) {
    return {
      questionId: question.id,
      topic: question.topic,
      prompt: question.questionText,
      submittedAnswer: null,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
      isCorrect: false,
      score: 0,
      observations: ['No code was submitted for this attempt.'],
    };
  }

  score += 25;
  observations.push('A code submission was captured for review.');

  if (submittedCode.length >= 120) {
    score += 20;
    observations.push('The solution includes enough implementation detail to review flow and structure.');
  } else {
    observations.push('The solution is still short; expand it before the next timed attempt.');
  }

  if (/\breturn\b|\byield\b/.test(submittedCode)) {
    score += 10;
    observations.push('Includes an explicit return path.');
  }

  if (/\bif\b|\belse\b|\btry\b|\bcatch\b/.test(submittedCode)) {
    score += 15;
    observations.push('Handles branching or recovery logic.');
  }

  if (/\basync\b|\bawait\b|Promise|fetch\(/.test(submittedCode)) {
    score += 10;
    observations.push('Touches async or request-handling behavior.');
  }

  if (/error|throw|validate|guard|abort|rollback|idempot|dedup|cache|cleanup/i.test(submittedCode)) {
    score += 10;
    observations.push('Shows awareness of defensive or production-oriented checks.');
  }

  if (notes.length >= 40) {
    score += 10;
    observations.push('Tradeoff notes were included with the submission.');
  }

  const boundedScore = Math.min(100, score);
  return {
    questionId: question.id,
    topic: question.topic,
    prompt: question.questionText,
    submittedAnswer: submittedCode,
    correctAnswer: question.correctAnswer,
    explanation: question.explanation,
    isCorrect: boundedScore >= 70,
    score: boundedScore,
    observations,
  };
}

function evaluateSubjectiveAnswer(question: BankQuestion, answer: RoundAttemptAnswerInput | undefined): RoundAttemptDetail {
  const submittedAnswer = String(answer?.selectedAnswer ?? answer?.notes ?? '').trim();
  if (!submittedAnswer) {
    return {
      questionId: question.id,
      topic: question.topic,
      prompt: question.questionText,
      submittedAnswer: null,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
      isCorrect: false,
      score: 0,
      observations: ['No answer was submitted for this prompt.'],
    };
  }

  const observations: string[] = ['A written or spoken response was captured for review.'];
  let score = 25;
  if (submittedAnswer.length >= 180) {
    score += 20;
    observations.push('The response has enough depth to evaluate structure and reasoning.');
  } else {
    observations.push('The response is short; add more implementation detail next time.');
  }
  if (/tradeoff|trade-off|because|therefore|however|risk|cost/i.test(submittedAnswer)) {
    score += 15;
    observations.push('Mentions reasoning or tradeoffs instead of only naming a tool.');
  }
  if (/test|verify|metric|measure|monitor|log|trace/i.test(submittedAnswer)) {
    score += 15;
    observations.push('Includes a verification or measurement plan.');
  }
  if (/failure|edge|fallback|rollback|retry|error|race|security|latency/i.test(submittedAnswer)) {
    score += 15;
    observations.push('Covers a production failure mode or edge case.');
  }
  if (question.correctAnswer.split(/\s+/).some((word) => word.length > 6 && submittedAnswer.toLowerCase().includes(word.toLowerCase()))) {
    score += 10;
    observations.push('Overlaps with the stored answer key for this topic.');
  }

  const boundedScore = Math.min(100, score);
  return {
    questionId: question.id,
    topic: question.topic,
    prompt: question.questionText,
    submittedAnswer,
    correctAnswer: question.correctAnswer,
    explanation: question.explanation,
    isCorrect: boundedScore >= 70,
    score: boundedScore,
    observations,
  };
}

async function evaluateWithDeepSeek(question: BankQuestion, answer: RoundAttemptAnswerInput | undefined, fallback: RoundAttemptDetail): Promise<RoundAttemptDetail> {
  const apiKey = process.env.AICREDITS_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim();
  const baseUrl = (process.env.AICREDITS_BASE_URL?.trim() || process.env.OPENAI_COMPAT_BASE_URL?.trim() || 'https://api.aicredits.in/v1').replace(/\/$/, '');
  const model = process.env.CODE_EVALUATION_MODEL?.trim() || 'deepseek/deepseek-chat';
  const submittedAnswer = String(answer?.codeAnswer ?? answer?.selectedAnswer ?? answer?.notes ?? '').trim();
  if (!apiKey || !submittedAnswer || !['coding', 'mock', 'scenario', 'system_design'].includes(question.type)) return fallback;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.CODE_EVALUATION_TIMEOUT_MS ?? 20000));
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        max_tokens: Number(process.env.CODE_EVALUATION_MAX_TOKENS ?? 900),
        messages: [
          {
            role: 'system',
            content: 'Evaluate interview practice answers. Return only JSON with score number 0-100, isCorrect boolean, observations string array, and explanation string. Be strict, practical, and domain-specific.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              domain: question.domainLabel,
              type: question.type,
              topic: question.topic,
              prompt: question.questionText,
              expectedAnswer: question.correctAnswer,
              submittedAnswer,
              fallbackObservations: fallback.observations,
            }),
          },
        ],
      }),
    });
    const data = await response.json().catch(() => ({})) as { choices?: Array<{ message?: { content?: string } }> };
    if (!response.ok) return fallback;
    const raw = String(data.choices?.[0]?.message?.content ?? '').trim();
    const jsonText = raw.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const parsed = JSON.parse(jsonText) as AiEvaluation;
    const score = Math.max(0, Math.min(100, Math.round(Number(parsed.score ?? fallback.score))));
    return {
      ...fallback,
      score,
      isCorrect: typeof parsed.isCorrect === 'boolean' ? parsed.isCorrect : score >= 70,
      explanation: parsed.explanation || fallback.explanation,
      observations: Array.isArray(parsed.observations) && parsed.observations.length ? parsed.observations.map(String).slice(0, 5) : fallback.observations,
    };
  } catch {
    return fallback;
  } finally {
    clearTimeout(timeout);
  }
}

function buildAttemptRecord(row: DbRoundAttemptRow, questions: BankQuestion[]): StoredRoundAttempt {
  const answerPayload = asObject<{ answers?: RoundAttemptAnswerInput[] }>(row.answer_payload, {});
  const resultPayload = asObject<{
    summary?: string;
    focusAreas?: string[];
    nextSteps?: string[];
    results?: RoundAttemptDetail[];
  }>(row.result_payload, {});

  return {
    id: row.id,
    roundType: row.round_type,
    questionType: row.question_type as QuestionType,
    domain: row.domain,
    status: row.status,
    durationMinutes: Number(row.duration_minutes),
    totalQuestions: Number(row.total_questions),
    correctAnswers: Number(row.correct_answers),
    score: Number(row.score),
    timeSpentSeconds: row.time_spent_seconds === null ? null : Number(row.time_spent_seconds),
    startedAt: row.started_at,
    submittedAt: row.submitted_at,
    expiresAt: row.expires_at,
    summary: resultPayload.summary ?? '',
    focusAreas: Array.isArray(resultPayload.focusAreas) ? resultPayload.focusAreas : [],
    nextSteps: Array.isArray(resultPayload.nextSteps) ? resultPayload.nextSteps : [],
    questions,
    answers: Array.isArray(answerPayload.answers) ? answerPayload.answers : [],
    results: Array.isArray(resultPayload.results) ? resultPayload.results : [],
  };
}

export async function ensureQuestionBankSeeded() {
  await upsertSeedQuestions(QUESTION_BANK);
}

export async function listQuestionStats(): Promise<QuestionStatsItem[]> {
  const rows = await db.query<{ domain: string; label: string; total: number }>(
    `SELECT domain, MAX(domain_label) AS label, COUNT(*)::int AS total
       FROM questions
      GROUP BY domain`,
  );

  const statsByDomain = new Map(rows.map((row) => [row.domain, row]));
  return QUESTION_DOMAINS.map((domain) => {
    const stats = statsByDomain.get(domain.id);
    return {
      id: domain.id,
      label: stats?.label ?? domain.label,
      total: Number(stats?.total ?? 0),
    };
  });
}

export async function listQuestions(filters: {
  domain?: string;
  type?: QuestionType | 'all';
  search?: string;
  faangOnly?: boolean;
  limit?: number;
}) {
  const limit = Math.min(300, Math.max(1, Number(filters.limit ?? 50)));
  const params: unknown[] = [];
  const whereClause = buildQuestionFilterClause(filters, params);
  params.push(limit);

  const rows = await db.query<DbQuestionRow>(
    `SELECT ${questionSelectFields('q')}
       FROM questions q
       ${whereClause}
      ORDER BY q.domain_label ASC, q.topic ASC, q.difficulty ASC, q.id ASC
      LIMIT $${params.length}`,
    params,
  );

  return rows.map(mapQuestionRow);
}

export async function createRoundAttempt(params: {
  userId: string;
  roundType: string;
  questionType: QuestionType;
  domain: string;
  limit: number;
  durationMinutes?: number;
}) {
  const selectionLimit = Math.max(1, Number(params.limit));
  const questionRows = await db.query<DbQuestionRow>(
    `SELECT ${questionSelectFields('q')}
       FROM questions q
       LEFT JOIN (
         SELECT question_id, MAX(assigned_at) AS last_assigned_at
           FROM question_assignments
          WHERE user_id = $1
          GROUP BY question_id
       ) assignment ON assignment.question_id = q.id
      WHERE q.domain = $2 AND q.type = $3
      ORDER BY
        CASE WHEN assignment.last_assigned_at IS NULL THEN 0 ELSE 1 END ASC,
        assignment.last_assigned_at ASC NULLS FIRST,
        q.domain_label ASC,
        q.topic ASC,
        q.difficulty ASC,
        q.id ASC
      LIMIT $4`,
    [params.userId, params.domain, params.questionType, selectionLimit],
  );

  const questions = questionRows.map(mapQuestionRow);

  if (!questions.length) {
    throw new Error('No questions are available for this round yet.');
  }

  const attemptId = crypto.randomUUID();
  const durationMinutes = params.durationMinutes ?? Math.max(...questions.map((question) => question.timeLimitMinutes));
  const questionIds = questions.map((question) => question.id);

  await withClient(async (client) => {
    await client.query('BEGIN');
    try {
      await client.query(
        `INSERT INTO round_attempts (
          id, user_id, round_type, question_type, domain, status, duration_minutes,
          question_ids, total_questions, correct_answers, score, started_at, expires_at, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, 'started', $6,
          $7::jsonb, $8, 0, 0, NOW(), NOW() + make_interval(mins => $6), NOW(), NOW()
        )`,
        [attemptId, params.userId, params.roundType, params.questionType, params.domain, durationMinutes, JSON.stringify(questionIds), questionIds.length],
      );

      for (const questionId of questionIds) {
        await client.query(
          `INSERT INTO question_assignments (
            id, user_id, question_id, attempt_id, round_type, assigned_at, created_at
          ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
          [crypto.randomUUID(), params.userId, questionId, attemptId, params.roundType],
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });

  return {
    id: attemptId,
    roundType: params.roundType,
    questionType: params.questionType,
    domain: params.domain,
    status: 'started',
    durationMinutes,
    totalQuestions: questions.length,
    correctAnswers: 0,
    score: 0,
    timeSpentSeconds: null,
    startedAt: new Date().toISOString(),
    submittedAt: null,
    expiresAt: null,
    summary: '',
    focusAreas: [],
    nextSteps: [],
    questions,
    answers: [],
    results: [],
  } satisfies StoredRoundAttempt;
}

export async function submitRoundAttempt(params: {
  userId: string;
  attemptId: string;
  answers: RoundAttemptAnswerInput[];
  timeSpentSeconds?: number;
  autoSubmitted?: boolean;
}) {
  const row = await db.queryOne<DbRoundAttemptRow>(
    `SELECT id, round_type, question_type, domain, status, duration_minutes, question_ids, answer_payload, result_payload, total_questions, correct_answers, score, time_spent_seconds, started_at, submitted_at, expires_at
       FROM round_attempts
      WHERE id = $1 AND user_id = $2`,
    [params.attemptId, params.userId],
  );

  if (!row) {
    throw new Error('Round attempt not found.');
  }

  const questions = await getQuestionsByIds(asStringArray(row.question_ids));
  const answersById = new Map(params.answers.map((answer) => [answer.questionId, answer]));
  const results = await Promise.all(questions.map(async (question) => {
    const answer = answersById.get(question.id);
    const fallback = question.type === 'coding'
      ? evaluateCodingAnswer(question, answer)
      : question.type === 'mock' || question.type === 'system_design'
        ? evaluateSubjectiveAnswer(question, answer)
        : evaluateObjectiveAnswer(question, answer);
    return evaluateWithDeepSeek(question, answer, fallback);
  }));

  const correctAnswers = results.filter((result) => result.isCorrect).length;
  const score = results.length ? Math.round(results.reduce((sum, result) => sum + result.score, 0) / results.length) : 0;
  const focusAreas = results.filter((result) => !result.isCorrect).map((result) => result.topic).slice(0, 3);
  const nextSteps = row.question_type === 'coding'
    ? [
      'Re-run this coding prompt and add one stronger failure-handling branch.',
      'Explain the control flow before you type on the next attempt.',
      'Use the question bank to drill one adjacent coding topic before repeating this round.',
    ]
    : row.question_type === 'mock'
      ? [
        'Repeat the answer with a clearer problem, decision, tradeoff, result, and validation structure.',
        'Add one measurable signal or test you would use to prove the fix works.',
        'Use the question bank to rehearse one adjacent project follow-up before the next mock.',
      ]
    : [
      'Review the scenario prompts you missed and state the failure mode first.',
      'Drill one adjacent scenario topic from the question bank before the next timed attempt.',
      'Keep the answer and the production reason paired together.',
    ];
  const summary = row.question_type === 'coding'
    ? `Coding attempt scored ${score} based on the submitted draft and structural checks.`
    : row.question_type === 'mock'
      ? `Mock interview scored ${score} based on answer depth, tradeoffs, validation, and production awareness.`
    : `Completed ${results.length} scenario questions with a score of ${score}.`;
  const normalizedAnswers = questions.map((question) => answersById.get(question.id) ?? { questionId: question.id });

  await withClient(async (client) => {
    await client.query('BEGIN');
    try {
      await client.query(
        `UPDATE round_attempts
            SET status = 'submitted',
                answer_payload = $1::jsonb,
                result_payload = $2::jsonb,
                total_questions = $3,
                correct_answers = $4,
                score = $5,
                time_spent_seconds = $6,
                submitted_at = NOW(),
                updated_at = NOW()
          WHERE id = $7 AND user_id = $8`,
        [
          JSON.stringify({ answers: normalizedAnswers, autoSubmitted: Boolean(params.autoSubmitted) }),
          JSON.stringify({ results, focusAreas, nextSteps, summary, autoSubmitted: Boolean(params.autoSubmitted) }),
          questions.length,
          correctAnswers,
          score,
          params.timeSpentSeconds ?? null,
          params.attemptId,
          params.userId,
        ],
      );

      for (const result of results) {
        const sourceAnswer = answersById.get(result.questionId);
        await client.query(
          `UPDATE question_assignments
              SET selected_answer = $1,
                  code_answer = $2,
                  notes = $3,
                  is_correct = $4,
                  score = $5,
                  completed_at = NOW()
            WHERE attempt_id = $6 AND question_id = $7`,
          [
            sourceAnswer?.selectedAnswer ?? null,
            sourceAnswer?.codeAnswer ?? null,
            sourceAnswer?.notes ?? null,
            result.isCorrect,
            result.score,
            params.attemptId,
            result.questionId,
          ],
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });

  const submitted = await getRoundAttemptById(params.userId, params.attemptId);
  if (!submitted) {
    throw new Error('Unable to load the submitted round attempt.');
  }
  return submitted;
}

export async function getRoundAttemptById(userId: string, attemptId: string) {
  const row = await db.queryOne<DbRoundAttemptRow>(
    `SELECT id, round_type, question_type, domain, status, duration_minutes, question_ids, answer_payload, result_payload, total_questions, correct_answers, score, time_spent_seconds, started_at, submitted_at, expires_at
       FROM round_attempts
      WHERE id = $1 AND user_id = $2`,
    [attemptId, userId],
  );
  if (!row) return null;
  const questions = await getQuestionsByIds(asStringArray(row.question_ids));
  return buildAttemptRecord(row, questions);
}

export async function getLatestRoundAttempt(userId: string, roundType: string, domain?: string) {
  const params = domain ? [userId, roundType, domain] : [userId, roundType];
  const domainClause = domain ? 'AND domain = $3' : '';
  const row = await db.queryOne<DbRoundAttemptRow>(
    `SELECT id, round_type, question_type, domain, status, duration_minutes, question_ids, answer_payload, result_payload, total_questions, correct_answers, score, time_spent_seconds, started_at, submitted_at, expires_at
       FROM round_attempts
      WHERE user_id = $1 AND round_type = $2 ${domainClause}
      ORDER BY COALESCE(submitted_at, started_at) DESC, started_at DESC
      LIMIT 1`,
    params,
  );
  if (!row) return null;
  const questions = await getQuestionsByIds(asStringArray(row.question_ids));
  return buildAttemptRecord(row, questions);
}
