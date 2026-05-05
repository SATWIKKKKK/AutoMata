import { BankQuestion } from './questionBank';

const ROUND_RESULTS_KEY = 'promptly_round_results';

export interface StoredRoundDetail {
  questionId: string;
  topic: string;
  prompt: string;
  selectedAnswer: string | null;
  correctAnswer: string;
  explanation: string;
  isCorrect: boolean;
}

export interface StoredRoundResult {
  roundType: string;
  roundName: string;
  domain: string;
  completedAt: string;
  durationMinutes: number;
  totalQuestions: number;
  answeredQuestions: number;
  correctAnswers: number;
  score: number;
  focusAreas: string[];
  nextSteps: string[];
  details: StoredRoundDetail[];
}

function readRoundResults() {
  try {
    return JSON.parse(localStorage.getItem(ROUND_RESULTS_KEY) || '{}') as Record<string, StoredRoundResult>;
  } catch {
    return {};
  }
}

export function getRoundResult(roundType: string) {
  return readRoundResults()[roundType] ?? null;
}

export function storeRoundResult(result: StoredRoundResult) {
  const current = readRoundResults();
  current[result.roundType] = result;
  localStorage.setItem(ROUND_RESULTS_KEY, JSON.stringify(current));
}

export function buildQuestionRoundResult({
  roundType,
  roundName,
  domain,
  durationMinutes,
  questions,
  answers,
  focusAreas,
  nextSteps,
}: {
  roundType: string;
  roundName: string;
  domain: string;
  durationMinutes: number;
  questions: BankQuestion[];
  answers: Record<string, string>;
  focusAreas: string[];
  nextSteps: string[];
}): StoredRoundResult {
  const details = questions.map((question) => {
    const selectedAnswer = answers[question.id] ?? null;
    return {
      questionId: question.id,
      topic: question.topic,
      prompt: question.questionText,
      selectedAnswer,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
      isCorrect: selectedAnswer === question.correctAnswer,
    };
  });
  const answeredQuestions = details.filter((item) => item.selectedAnswer).length;
  const correctAnswers = details.filter((item) => item.isCorrect).length;
  const score = questions.length ? Math.round((correctAnswers / questions.length) * 100) : 0;

  return {
    roundType,
    roundName,
    domain,
    completedAt: new Date().toISOString(),
    durationMinutes,
    totalQuestions: questions.length,
    answeredQuestions,
    correctAnswers,
    score,
    focusAreas,
    nextSteps,
    details,
  };
}