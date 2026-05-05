export type QuestionType = 'mcq' | 'fill_blank' | 'scenario' | 'system_design' | 'coding' | 'mock';

export interface BankQuestion {
  id: string;
  domain: string;
  domainLabel: string;
  topic: string;
  type: QuestionType;
  difficulty: 1 | 2 | 3;
  questionText: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
  codeSnippet?: string;
  tags: string[];
  timeLimitMinutes: number;
}

export const QUESTION_TYPES: Array<{ id: QuestionType; label: string }> = [
  { id: 'mcq', label: 'Concept MCQ' },
  { id: 'fill_blank', label: 'Fill in the Blank' },
  { id: 'scenario', label: 'Scenario' },
  { id: 'system_design', label: 'Architecture' },
  { id: 'coding', label: 'Coding Round' },
  { id: 'mock', label: 'Mock Interview' },
];

export const QUESTION_DOMAINS: Array<{ id: string; label: string; topics: string[] }> = [
  {
    id: 'frontend',
    label: 'Frontend',
    topics: ['React', 'Next.js', 'Vue.js', 'Angular', 'SvelteKit', 'HTML and CSS fundamentals', 'Tailwind CSS', 'Accessibility', 'Web performance', 'Browser APIs', 'Design systems', 'Micro-frontends', 'Storybook', 'Three.js and WebGL', 'D3.js', 'Client WebSockets'],
  },
  {
    id: 'backend',
    label: 'Backend',
    topics: ['Node.js with Express', 'Fastify', 'NestJS', 'Django', 'Flask', 'FastAPI', 'Spring Boot', 'Ruby on Rails', 'Laravel', 'Go services', 'Rust Actix', 'ASP.NET Core', 'GraphQL API design', 'REST API design', 'gRPC', 'Server WebSockets', 'Serverless functions', 'Rate limiting', 'Background jobs'],
  },
  {
    id: 'full-stack',
    label: 'Full Stack',
    topics: ['Next.js full stack', 'Remix full stack', 'SvelteKit full stack', 'MERN stack', 'MEAN stack', 'T3 stack', 'RedwoodJS', 'Wasp', 'API contracts', 'Client-server state', 'Auth flows', 'Deployment tradeoffs'],
  },
  {
    id: 'database',
    label: 'Database',
    topics: ['PostgreSQL', 'MySQL', 'SQLite', 'MongoDB', 'DynamoDB', 'Redis', 'Elasticsearch', 'Neo4j', 'Prisma ORM', 'Drizzle ORM', 'SQLAlchemy', 'Mongoose', 'Normalization', 'Indexing', 'Transactions', 'Migrations', 'Vector databases'],
  },
  {
    id: 'devops',
    label: 'DevOps and Infrastructure',
    topics: ['Docker', 'Kubernetes', 'Helm', 'Docker Compose', 'GitHub Actions', 'GitLab CI', 'Jenkins', 'ArgoCD', 'Terraform', 'Ansible', 'AWS', 'GCP', 'Azure', 'Vercel deployment', 'Linux', 'Nginx', 'Load balancing', 'Prometheus and Grafana', 'Incident response'],
  },
  {
    id: 'ai-ml',
    label: 'AI and Machine Learning',
    topics: ['Python for ML', 'NumPy and Pandas', 'Scikit-learn', 'TensorFlow', 'PyTorch', 'Hugging Face Transformers', 'LangChain', 'LlamaIndex', 'OpenAI API integration', 'Prompt engineering', 'Fine-tuning', 'RAG systems', 'Embeddings', 'OpenCV', 'NLP', 'Recommendation systems', 'MLflow', 'Model evaluation'],
  },
  {
    id: 'data',
    label: 'Data Engineering',
    topics: ['Apache Spark', 'Apache Kafka', 'Apache Airflow', 'dbt', 'Apache Flink', 'Snowflake', 'BigQuery', 'Redshift', 'Databricks', 'Delta Lake', 'ETL vs ELT', 'Warehouse design', 'Data lake architecture', 'Streaming data', 'Data quality', 'Great Expectations', 'Apache Iceberg', 'Prefect'],
  },
  {
    id: 'mobile',
    label: 'Mobile',
    topics: ['React Native', 'Expo', 'Flutter', 'SwiftUI', 'Jetpack Compose', 'Android fundamentals', 'iOS fundamentals', 'Mobile performance', 'Push notifications', 'Offline-first apps', 'Deep linking', 'Mobile authentication', 'Mobile testing'],
  },
  {
    id: 'security',
    label: 'Security',
    topics: ['Application security', 'OWASP Top 10', 'Authentication', 'Authorization', 'JWT', 'OAuth 2.0', 'OpenID Connect', 'Session management', 'SQL injection prevention', 'XSS prevention', 'CSRF prevention', 'TLS', 'API security', 'Secret management', 'Security headers', 'Rate limiting as security'],
  },
  {
    id: 'system-design',
    label: 'System Design',
    topics: ['Distributed systems', 'CAP theorem', 'Consistent hashing', 'Load balancing', 'Caching strategies', 'CDN design', 'Message queues', 'Saga pattern', 'CQRS', 'Event sourcing', 'Microservices', 'Service discovery', 'Circuit breakers', 'High availability', 'Fault tolerance', 'Search systems', 'Payment systems', 'Chat systems'],
  },
  {
    id: 'cloud-platform',
    label: 'Cloud Native and Platform Engineering',
    topics: ['Platform engineering', 'Internal developer platforms', 'Backstage', 'OpenTelemetry', 'Observability stack design', 'GitOps', 'Multi-cloud strategy', 'Cloud cost optimization', 'FinOps', 'Container security', 'Vault', 'Service catalogs', 'Developer experience tooling'],
  },
  {
    id: 'web3',
    label: 'Web3 and Blockchain',
    topics: ['Solidity', 'Ethereum fundamentals', 'Hardhat', 'Foundry', 'Web3.js', 'Ethers.js', 'IPFS', 'DeFi protocol design', 'NFT standards', 'Layer 2 solutions', 'Wallet integration', 'Smart contract auditing'],
  },
  {
    id: 'testing',
    label: 'Testing',
    topics: ['Unit testing', 'Integration testing', 'Playwright', 'Cypress', 'TDD', 'BDD', 'Jest', 'Vitest', 'Pytest', 'React component testing', 'API testing', 'Load testing with k6', 'Contract testing', 'Mocking and stubbing', 'Coverage quality'],
  },
  {
    id: 'languages',
    label: 'Languages',
    topics: ['JavaScript deep dive', 'TypeScript deep dive', 'Python deep dive', 'Go deep dive', 'Rust deep dive', 'Java deep dive', 'C sharp deep dive', 'Kotlin deep dive', 'Swift deep dive', 'Ruby deep dive', 'PHP deep dive', 'Elixir deep dive', 'Scala deep dive', 'Dart deep dive'],
  },
  {
    id: 'cs-fundamentals',
    label: 'Computer Science Fundamentals',
    topics: ['Object-oriented design', 'Functional programming', 'Concurrency', 'Multithreading', 'Memory management', 'Operating systems', 'Networking fundamentals', 'Compiler basics', 'Design patterns', 'Process scheduling', 'I/O models', 'Thread safety'],
  },
];

const SEEN_KEY = 'promptly_seen_question_ids';

function questionFor(domainLabel: string, topic: string, type: QuestionType, difficulty: 1 | 2 | 3, index: number): Omit<BankQuestion, 'id' | 'domain' | 'domainLabel' | 'topic' | 'type' | 'difficulty' | 'tags' | 'timeLimitMinutes'> {
  const context = difficulty === 1 ? 'core implementation' : difficulty === 2 ? 'production behavior' : 'senior-level tradeoff';
  if (type === 'fill_blank') {
    return {
      questionText: `Fill the missing logic for a ${topic} ${context} case in ${domainLabel}.`,
      codeSnippet: `function handle${index}(input) {\n  const normalized = String(input ?? '').trim();\n  if (!normalized) return ___;\n  return ___;\n}`,
      options: undefined,
      correctAnswer: 'a guarded return followed by the domain-specific transformation',
      explanation: `This checks whether the candidate can place the important ${topic} guard before the main behavior, which is where many production bugs start.`,
    };
  }

  if (type === 'scenario') {
    return {
      questionText: `A ${topic} feature works in happy-path demos but fails under real user traffic. What should you inspect first, and why?`,
      options: ['Trace the failing path and add observability before rewriting it', 'Rewrite the module from scratch', 'Disable the feature until the next sprint', 'Move the logic to the client without changing the contract'],
      correctAnswer: 'Trace the failing path and add observability before rewriting it',
      explanation: `Scenario rounds reward diagnosis. For ${topic}, the best answer names the failure mode, validates it, and then changes the smallest reliable surface.`,
    };
  }

  if (type === 'system_design') {
    return {
      questionText: `Design a ${topic} flow for ${domainLabel}. Include the boundaries, failure handling, and the one metric you would watch first.`,
      correctAnswer: 'a bounded design with clear ownership, failure handling, and a measurable operational signal',
      explanation: `Architecture answers need boundaries and tradeoffs, not only component names. This prompt keeps the candidate grounded in observable behavior.`,
    };
  }

  if (type === 'coding') {
    return {
      questionText: `Implement a small ${topic} utility that handles empty input, duplicate submissions, and one recoverable error without hiding state from the caller.`,
      codeSnippet: `export function solve(input) {\n  // Keep this pure and make error states explicit.\n}\n`,
      correctAnswer: 'a pure implementation that validates input, avoids duplicate effects, and returns explicit success or error state',
      explanation: `The coding expectation is not algorithm trivia; it checks practical state, validation, and error handling for ${topic}.`,
    };
  }

  if (type === 'mock') {
    return {
      questionText: `Walk me through a project decision involving ${topic}. What did you choose, what broke, and what would you change now?`,
      correctAnswer: 'a structured answer covering problem, decision, tradeoff, result, and improvement',
      explanation: `Mock interview prompts test communication depth and whether the candidate can connect ${topic} to real engineering decisions.`,
    };
  }

  return {
    questionText: `In ${domainLabel}, which answer best describes the safest ${context} approach for ${topic}?`,
    options: ['Make the contract explicit and handle the failure path', 'Optimize the implementation before defining behavior', 'Hide errors so users see fewer states', 'Use a global mutable flag to coordinate everything'],
    correctAnswer: 'Make the contract explicit and handle the failure path',
    explanation: `This checks practical judgment around ${topic}: define behavior first, then choose the implementation details.`,
  };
}

export const QUESTION_BANK: BankQuestion[] = QUESTION_DOMAINS.flatMap((domain) => (
  Array.from({ length: 300 }, (_, index) => {
    const topic = domain.topics[index % domain.topics.length];
    const type = QUESTION_TYPES[index % QUESTION_TYPES.length].id;
    const difficulty = ((index % 3) + 1) as 1 | 2 | 3;
    const base = questionFor(domain.label, topic, type, difficulty, index + 1);
    return {
      ...base,
      id: `${domain.id}-${type}-${String(index + 1).padStart(3, '0')}`,
      domain: domain.id,
      domainLabel: domain.label,
      topic,
      type,
      difficulty,
      tags: [
        type,
        difficulty === 3 ? 'faang' : difficulty === 2 ? 'product-startup' : 'standard',
        index % 5 === 0 ? 'trade-off' : 'practical',
        index % 7 === 0 ? 'project-ready' : 'domain-bank',
      ],
      timeLimitMinutes: type === 'coding' ? 45 : type === 'mock' ? 25 : type === 'system_design' ? 20 : type === 'scenario' ? 12 : 8,
    };
  })
));

export function getQuestionStats() {
  return QUESTION_DOMAINS.map((domain) => ({
    ...domain,
    total: QUESTION_BANK.filter((question) => question.domain === domain.id).length,
  }));
}

export function filterQuestions(filters: {
  domain?: string;
  type?: QuestionType | 'all';
  search?: string;
  faangOnly?: boolean;
  limit?: number;
  excludeSeen?: boolean;
} = {}) {
  const search = filters.search?.trim().toLowerCase() ?? '';
  const seen = filters.excludeSeen ? getSeenQuestionIds() : new Set<string>();
  const items = QUESTION_BANK.filter((question) => {
    if (filters.domain && filters.domain !== 'all' && question.domain !== filters.domain) return false;
    if (filters.type && filters.type !== 'all' && question.type !== filters.type) return false;
    if (filters.faangOnly && !question.tags.includes('faang')) return false;
    if (seen.has(question.id)) return false;
    if (!search) return true;
    return [
      question.questionText,
      question.domainLabel,
      question.topic,
      question.type,
      ...question.tags,
    ].some((value) => value.toLowerCase().includes(search));
  });

  return typeof filters.limit === 'number' ? items.slice(0, filters.limit) : items;
}

export function getSeenQuestionIds() {
  try {
    return new Set<string>(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'));
  } catch {
    return new Set<string>();
  }
}

export function markQuestionsSeen(ids: string[]) {
  const seen = getSeenQuestionIds();
  ids.forEach((id) => seen.add(id));
  localStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(seen)));
}

export function selectUnseenQuestions(domain: string, type: QuestionType, limit: number) {
  const questions = filterQuestions({ domain, type, limit, excludeSeen: true });
  const fallback = questions.length >= limit ? questions : filterQuestions({ domain, type, limit });
  const selected = fallback.slice(0, limit);
  markQuestionsSeen(selected.map((question) => question.id));
  return selected;
}
