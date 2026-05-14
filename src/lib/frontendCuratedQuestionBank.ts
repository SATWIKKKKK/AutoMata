import { loadCuratedMarkdownQuestions } from './curatedMarkdownQuestionBank.js';

export function loadFrontendCuratedQuestions() {
  return loadCuratedMarkdownQuestions({
    bankFile: 'frontend-question-bank.md',
    idPrefix: 'frontend-curated',
    domain: 'frontend',
    domainLabel: 'Frontend',
    topicAliases: {
      'HTML FUNDAMENTALS': 'HTML Fundamentals',
      'CSS FUNDAMENTALS': 'CSS Fundamentals',
      'JAVASCRIPT FUNDAMENTALS': 'JavaScript Fundamentals',
      'DOM AND BROWSER APIS': 'DOM And Browser APIs',
      'REACT FUNDAMENTALS': 'React Fundamentals',
      'REACT HOOKS': 'React Hooks',
      'STATE MANAGEMENT': 'State Management',
      'TYPESCRIPT FOR FRONTEND': 'TypeScript For Frontend',
      'API INTEGRATION': 'API Integration',
      'TESTING FRONTEND APPS': 'Testing Frontend Apps',
      'PERFORMANCE OPTIMIZATION': 'Performance Optimization',
      'ACCESSIBILITY': 'Accessibility',
      'SECURITY FOR FRONTEND': 'Frontend Security',
      'NEXT.JS AND SSR': 'Next.js And SSR',
      'FRONTEND ARCHITECTURE': 'Frontend Architecture',
    },
    roundTopics: {
      concept: 'Frontend Mixed Concepts',
      fill: 'Frontend Mixed Concepts',
      scenario: 'Frontend Scenarios',
      architecture: 'Frontend Architecture',
      coding: 'Frontend Coding',
      mock: 'Frontend Mock Interview',
      faang: 'Frontend FAANG',
    },
  });
}
