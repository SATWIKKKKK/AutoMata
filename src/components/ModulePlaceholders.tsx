import React from 'react';

function PlaceholderSurface({
  title,
  description,
  className = '',
  variant = 'light',
}: {
  title: string;
  description: string;
  className?: string;
  variant?: 'light' | 'dark';
}) {
  const isDark = variant === 'dark';

  return (
    <div className={`rounded-xl border p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)] ${isDark ? 'border-[#333333] bg-[#141414] text-white' : 'border-blueprint-line bg-white/80'} ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <p className={`text-ui-label ${isDark ? 'text-[#888888]' : 'text-blueprint-muted'}`}>Coming Next</p>
          <h3 className={`mt-2 text-headline-md not-italic ${isDark ? 'text-white' : 'text-primary'}`}>{title}</h3>
        </div>
        <div className={`rounded-full border px-4 py-2 text-ui-label ${isDark ? 'border-[#333333] text-[#888888]' : 'border-blueprint-line text-blueprint-muted'}`}>
          Planned
        </div>
      </div>
      <p className={`max-w-xl text-body-md ${isDark ? 'text-[#a3a3a3]' : 'text-blueprint-muted'}`}>{description}</p>
    </div>
  );
}

export function QuizModule({ className = '', variant }: { className?: string; variant?: 'light' | 'dark' }) {
  // MODULE: QuizModule — to be implemented.
  return (
    <PlaceholderSurface
      title="Quiz Module"
      description="This space will hold timed quiz questions, answer review, and topic-based scoring for each round."
      className={className}
      variant={variant}
    />
  );
}

export function CodingPlayground({ className = '', variant }: { className?: string; variant?: 'light' | 'dark' }) {
  // MODULE: CodingPlayground — to be implemented.
  return (
    <PlaceholderSurface
      title="Coding Playground"
      description="This space will hold the coding editor, checks, and submission review for the live coding round."
      className={className}
      variant={variant}
    />
  );
}

export function ScenarioMCQ({ className = '', variant }: { className?: string; variant?: 'light' | 'dark' }) {
  // MODULE: ScenarioMCQ — to be implemented.
  return (
    <PlaceholderSurface
      title="Scenario MCQ"
      description="This space will hold scenario rounds with timed choices, explanation review, and retry prompts."
      className={className}
      variant={variant}
    />
  );
}

export function GapAnalysisDashboard({ className = '', variant }: { className?: string; variant?: 'light' | 'dark' }) {
  // MODULE: GapAnalysisDashboard — to be implemented.
  return (
    <PlaceholderSurface
      title="Gap Analysis Dashboard"
      description="This space will hold topic gaps, session trends, and the next practice targets for the selected role."
      className={className}
      variant={variant}
    />
  );
}

export function ProjectScanner({ className = '', variant }: { className?: string; variant?: 'light' | 'dark' }) {
  // MODULE: ProjectScanner — to be implemented.
  return (
    <PlaceholderSurface
      title="Project Scanner"
      description="This space will hold repo scans, project talking points, and the follow-up questions likely to come up in interviews."
      className={className}
      variant={variant}
    />
  );
}

export function LiveCodingSession({ className = '', variant }: { className?: string; variant?: 'light' | 'dark' }) {
  // MODULE: LiveCodingSession — to be implemented.
  return (
    <PlaceholderSurface
      title="Live Coding Session"
      description="This space will hold the guided mock round, interviewer prompts, and live feedback while you respond."
      className={className}
      variant={variant}
    />
  );
}
