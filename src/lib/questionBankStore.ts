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
  const results = questions.map((question) => (
    question.type === 'coding'
      ? evaluateCodingAnswer(question, answersById.get(question.id))
      : evaluateObjectiveAnswer(question, answersById.get(question.id))
  ));

  const correctAnswers = results.filter((result) => result.isCorrect).length;
  const score = results.length ? Math.round(results.reduce((sum, result) => sum + result.score, 0) / results.length) : 0;
  const focusAreas = results.filter((result) => !result.isCorrect).map((result) => result.topic).slice(0, 3);
  const nextSteps = row.question_type === 'coding'
    ? [
      'Re-run this coding prompt and add one stronger failure-handling branch.',
      'Explain the control flow before you type on the next attempt.',
      'Use the question bank to drill one adjacent coding topic before repeating this round.',
    ]
    : [
      'Review the scenario prompts you missed and state the failure mode first.',
      'Drill one adjacent scenario topic from the question bank before the next timed attempt.',
      'Keep the answer and the production reason paired together.',
    ];
  const summary = row.question_type === 'coding'
    ? `Coding attempt scored ${score} based on the submitted draft and structural checks.`
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

export async function getLatestRoundAttempt(userId: string, roundType: string) {
  const row = await db.queryOne<DbRoundAttemptRow>(
    `SELECT id, round_type, question_type, domain, status, duration_minutes, question_ids, answer_payload, result_payload, total_questions, correct_answers, score, time_spent_seconds, started_at, submitted_at, expires_at
       FROM round_attempts
      WHERE user_id = $1 AND round_type = $2
      ORDER BY COALESCE(submitted_at, started_at) DESC, started_at DESC
      LIMIT 1`,
    [userId, roundType],
  );
  if (!row) return null;
  const questions = await getQuestionsByIds(asStringArray(row.question_ids));
  return buildAttemptRecord(row, questions);
}