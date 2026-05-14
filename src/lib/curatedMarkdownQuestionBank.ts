import fs from 'node:fs';
import path from 'node:path';
import type { BankQuestion, QuestionType } from './questionBank.js';

export type CuratedRoundKey = 'fundamentals' | 'concept' | 'fill' | 'scenario' | 'architecture' | 'coding' | 'mock' | 'faang';

type RoundConfig = {
  key: CuratedRoundKey;
  type: QuestionType;
  roundTag: string;
  label: string;
  difficulty: 1 | 2 | 3;
  timeLimitMinutes: number;
};

type ParsedOption = {
  letter: string;
  text: string;
};

export type CuratedMarkdownConfig = {
  bankFile: string;
  idPrefix: string;
  domain: string;
  domainLabel: string;
  topicAliases?: Record<string, string>;
  roundTopics?: Partial<Record<CuratedRoundKey, string>>;
};

const ROUND_CONFIGS: Record<CuratedRoundKey, RoundConfig> = {
  fundamentals: { key: 'fundamentals', type: 'fundamentals', roundTag: 'fundamentals', label: 'Fundamentals', difficulty: 1, timeLimitMinutes: 8 },
  concept: { key: 'concept', type: 'mcq', roundTag: 'concept-mcq', label: 'Concept MCQ', difficulty: 1, timeLimitMinutes: 8 },
  fill: { key: 'fill', type: 'fill_blank', roundTag: 'fill-in-the-blank', label: 'Fill in the Blank', difficulty: 1, timeLimitMinutes: 8 },
  scenario: { key: 'scenario', type: 'scenario', roundTag: 'scenario', label: 'Scenario', difficulty: 2, timeLimitMinutes: 16 },
  architecture: { key: 'architecture', type: 'system_design', roundTag: 'architecture', label: 'Architecture', difficulty: 3, timeLimitMinutes: 24 },
  coding: { key: 'coding', type: 'coding', roundTag: 'coding-round', label: 'Coding Round', difficulty: 3, timeLimitMinutes: 40 },
  mock: { key: 'mock', type: 'mock', roundTag: 'mock-interview', label: 'Mock Interview', difficulty: 2, timeLimitMinutes: 20 },
  faang: { key: 'faang', type: 'system_design', roundTag: 'faang-tagged', label: 'FAANG Tagged', difficulty: 3, timeLimitMinutes: 24 },
};

function readBundle(bankFile: string) {
  const bankPath = path.resolve(process.cwd(), 'data', bankFile);
  return fs.existsSync(bankPath) ? fs.readFileSync(bankPath, 'utf8') : '';
}

function normalizeInlineWhitespace(value: string) {
  return value.replace(/\r/g, '').replace(/[ \t]+/g, ' ').trim();
}

function titleCase(value: string) {
  return value
    .replace(/\s+—\s+/g, ' - ')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((word) => (word.length <= 3 && !['and', 'for', 'the', 'to', 'of', 'in'].includes(word) ? word.toUpperCase() : word[0]?.toUpperCase() + word.slice(1)))
    .join(' ')
    .replace(/\bAI\b/gi, 'AI')
    .replace(/\bML\b/gi, 'ML')
    .replace(/\bNLP\b/gi, 'NLP')
    .replace(/\bSQL\b/gi, 'SQL')
    .replace(/\bPython\b/g, 'Python')
    .replace(/\bPandas\b/g, 'Pandas')
    .replace(/\bNumPy\b/g, 'NumPy')
    .replace(/\bAPI\b/gi, 'API')
    .replace(/\bKPI\b/gi, 'KPI')
    .replace(/\bETL\b/gi, 'ETL')
    .replace(/\bEDA\b/gi, 'EDA')
    .replace(/\bA\/B\b/gi, 'A/B');
}

function normalizeTopic(value: string, aliases: Record<string, string> = {}) {
  const cleaned = value.replace(/^TOPIC\s+\d+:\s*/i, '').trim();
  return aliases[cleaned.toUpperCase()] ?? titleCase(cleaned);
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function parseOptions(value: string): ParsedOption[] {
  return [...normalizeInlineWhitespace(value).matchAll(/([A-D])\)\s*(.*?)(?=\s+[A-D]\)\s|$)/g)]
    .map((match) => ({ letter: String(match[1] ?? '').trim(), text: String(match[2] ?? '').trim() }))
    .filter((option) => option.letter && option.text);
}

function splitMcqPrompt(value: string) {
  const normalized = normalizeInlineWhitespace(value);
  const firstOption = normalized.search(/\sA\)\s/);
  if (firstOption === -1) return { questionText: normalized, optionSource: '' };
  return {
    questionText: normalized.slice(0, firstOption).trim(),
    optionSource: normalized.slice(firstOption).trim(),
  };
}

function splitAnswerBlock(block: string) {
  const marker = /(?:^|\n)(Answer|How to answer):\s*/i.exec(block);
  if (!marker || marker.index === undefined) return { lead: block.trim(), answer: '' };
  return {
    lead: block.slice(0, marker.index).trim(),
    answer: block.slice(marker.index + marker[0].length).trim(),
  };
}

function codeFence(answer: string) {
  const trimmed = answer.trim();
  if (!trimmed || trimmed.includes('```')) return trimmed;
  const lang = /\b(select|join|where|group by|order by)\b/i.test(trimmed) ? 'sql' : /\b(def|import pandas|print\(|return)\b/i.test(trimmed) ? 'python' : 'text';
  return `\`\`\`${lang}\n${trimmed}\n\`\`\``;
}

function collectHeadings(markdown: string) {
  return [...markdown.matchAll(/^(#{2,3})\s+(.+)$/gm)].map((match) => ({
    index: match.index ?? 0,
    level: String(match[1] ?? ''),
    text: String(match[2] ?? '').trim(),
  }));
}

function inferRoundKey(section: string, subsection: string): CuratedRoundKey {
  const searchable = `${section} ${subsection}`.toLowerCase();
  if (searchable.includes('faang')) return 'faang';
  if (searchable.includes('mock interview')) return 'mock';
  if (searchable.includes('coding') || searchable.includes('technical')) return 'coding';
  if (searchable.includes('architecture') || searchable.includes('system design')) return 'architecture';
  if (searchable.includes('fill in the blank')) return 'fill';
  if (searchable.includes('scenario')) return 'scenario';
  if (searchable.includes('concept mcq') || searchable.includes('rapid fire')) return 'concept';
  return 'fundamentals';
}

function stateAt(index: number, headings: ReturnType<typeof collectHeadings>) {
  let topicHeading = '';
  let subsectionHeading = '';
  let roundHeading = '';

  for (const heading of headings) {
    if (heading.index > index) break;
    if (heading.level === '##' && /^TOPIC\s+\d+:/i.test(heading.text)) {
      topicHeading = heading.text;
      subsectionHeading = '';
      roundHeading = '';
      continue;
    }
    if (heading.level === '##' && /^ROUND TYPE:/i.test(heading.text)) {
      roundHeading = heading.text.replace(/^ROUND TYPE:\s*/i, '').trim();
      topicHeading = '';
      subsectionHeading = '';
      continue;
    }
    if (heading.level === '###') subsectionHeading = heading.text;
  }

  return { topicHeading, subsectionHeading, roundHeading };
}

function roundTopic(config: CuratedMarkdownConfig, roundKey: CuratedRoundKey, roundHeading: string) {
  if (config.roundTopics?.[roundKey]) return config.roundTopics[roundKey]!;
  const base = config.domainLabel;
  if (roundKey === 'architecture') return `${base} Architecture`;
  if (roundKey === 'coding') return `${base} Coding`;
  if (roundKey === 'mock') return `${base} Mock Interview`;
  if (roundKey === 'faang') return `${base} FAANG`;
  if (roundKey === 'concept' || roundKey === 'fill') return `${base} Mixed Concepts`;
  if (roundHeading) return `${base} Scenarios`;
  return `${base} Fundamentals`;
}

export function loadCuratedMarkdownQuestions(config: CuratedMarkdownConfig) {
  const markdown = readBundle(config.bankFile);
  const headings = collectHeadings(markdown);
  const matches = [...markdown.matchAll(/^Q\s*(\d+)\.\s+(.+)$/gm)];
  const questions = matches.map((match, index) => {
    const questionNumber = Number(match[1] ?? 0);
    const start = (match.index ?? 0) + match[0].length;
    const end = index + 1 < matches.length ? (matches[index + 1].index ?? markdown.length) : markdown.length;
    const state = stateAt(match.index ?? 0, headings);
    const roundKey = inferRoundKey(state.roundHeading, state.subsectionHeading);
    const roundConfig = ROUND_CONFIGS[roundKey];
    const topic = state.topicHeading ? normalizeTopic(state.topicHeading, config.topicAliases) : roundTopic(config, roundKey, state.roundHeading);
    const { lead, answer } = splitAnswerBlock(markdown.slice(start, end));
    const questionText = String(match[2] ?? '').trim();
    const tags = ['curated', config.domain, `round:${roundConfig.roundTag}`, `topic:${slugify(topic)}`];
    if (roundKey === 'faang') tags.push('faang');

    if (roundConfig.type === 'mcq') {
      const prompt = splitMcqPrompt(`${questionText} ${lead}`);
      const options = parseOptions(prompt.optionSource);
      const answerLetter = answer.match(/^([A-D])\b/i)?.[1]?.toUpperCase() ?? '';
      const selectedOption = options.find((option) => option.letter === answerLetter)?.text;
      const explanation = answer.replace(/^([A-D])\s*(?:—|-)?\s*/i, '').trim();
      return {
        id: `${config.idPrefix}-${String(questionNumber).padStart(3, '0')}`,
        domain: config.domain,
        domainLabel: config.domainLabel,
        topic,
        type: roundConfig.type,
        difficulty: roundConfig.difficulty,
        questionText: prompt.questionText || questionText,
        options: options.map((option) => option.text),
        correctAnswer: selectedOption ?? answer,
        explanation: explanation && explanation !== selectedOption ? explanation : '',
        tags,
        timeLimitMinutes: roundConfig.timeLimitMinutes,
      } satisfies BankQuestion;
    }

    return {
      id: `${config.idPrefix}-${String(questionNumber).padStart(3, '0')}`,
      domain: config.domain,
      domainLabel: config.domainLabel,
      topic,
      type: roundConfig.type,
      difficulty: roundConfig.difficulty,
      questionText,
      correctAnswer: roundConfig.type === 'coding' ? codeFence(answer) : answer,
      explanation: '',
      tags,
      timeLimitMinutes: roundConfig.timeLimitMinutes,
    } satisfies BankQuestion;
  }).filter((question) => question.questionText && question.correctAnswer);

  return {
    questions,
    report: {
      totalQuestions: questions.length,
      rounds: Object.values(ROUND_CONFIGS).map((round) => ({
        key: round.key,
        label: round.label,
        imported: questions.filter((question) => question.tags.includes(`round:${round.roundTag}`)).length,
      })),
      topics: [...new Map(questions.map((question) => [question.topic, questions.filter((item) => item.topic === question.topic).length])).entries()]
        .map(([topic, total]) => ({ topic, total })),
    },
  };
}
