import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';

type TemplateCategory = 'all' | 'sales' | 'marketing' | 'operations' | 'finance';

type TemplateItem = {
  id: string;
  name: string;
  description: string;
  category: string;
  prompt_text: string;
  use_count: number;
};

const TABS: Array<{ label: string; value: TemplateCategory }> = [
  { label: 'All', value: 'all' },
  { label: 'Sales', value: 'sales' },
  { label: 'Marketing', value: 'marketing' },
  { label: 'Operations', value: 'operations' },
  { label: 'Finance', value: 'finance' },
];

export default function Templates() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [activeTab, setActiveTab] = useState<TemplateCategory>('all');
  const [loading, setLoading] = useState(true);
  const [usingTemplateId, setUsingTemplateId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch('/api/templates')
      .then((res) => res.json())
      .then((data: { templates?: TemplateItem[] }) => {
        setTemplates(Array.isArray(data?.templates) ? data.templates : []);
      })
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false));
  }, []);

  const filteredTemplates = useMemo(() => {
    if (activeTab === 'all') return templates;
    return templates.filter((template) => template.category?.toLowerCase() === activeTab);
  }, [activeTab, templates]);

  const handleUseTemplate = async (templateId: string) => {
    try {
      setUsingTemplateId(templateId);
      const res = await fetch(`/api/templates/${templateId}/use`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) return;
      const promptText = String(data?.prompt_text ?? '').trim();
      if (promptText) {
        sessionStorage.setItem('pending-template-prompt', promptText);
      }
      navigate('/builder');
    } finally {
      setUsingTemplateId(null);
    }
  };

  return (
    <div className="min-h-full bg-background overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <span className="font-technical-mono text-technical-mono text-blueprint-muted uppercase tracking-widest">
              Workflow Templates
            </span>
            <h1 className="font-display-xl text-display-xl text-primary leading-tight mt-1">
              Templates
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant mt-2">Start in 30 seconds</p>
          </div>
        </div>

        <div className="flex items-center bg-surface-container rounded-full p-1 gap-0.5 w-fit">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={cn(
                'px-4 py-1.5 rounded-full font-ui-label text-ui-label transition-all',
                activeTab === tab.value
                  ? 'bg-surface-container-lowest text-primary shadow-sm border border-outline-variant'
                  : 'text-on-surface-variant hover:text-primary',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-20 border border-dashed border-blueprint-line rounded-2xl">
            <p className="text-blueprint-muted font-mono">Loading templates...</p>
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-blueprint-line rounded-2xl">
            <p className="text-blueprint-muted font-mono">No templates found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {filteredTemplates.map((template) => (
              <div
                key={template.id}
                className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-primary text-base truncate">{template.name}</h3>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium capitalize bg-surface-container text-on-surface-variant border border-outline-variant">
                    {template.category}
                  </span>
                </div>
                <p className="text-sm text-on-surface-variant line-clamp-2 mb-4">{template.description}</p>

                <div className="flex items-center justify-between mb-4">
                  <span className="text-technical-mono text-blueprint-muted">{template.use_count} uses</span>
                </div>

                <button
                  onClick={() => handleUseTemplate(template.id)}
                  disabled={usingTemplateId === template.id}
                  className="w-full flex items-center justify-center gap-2 bg-primary text-on-primary px-5 py-2.5 rounded-full font-ui-label text-ui-label hover:bg-inverse-surface transition-colors disabled:opacity-60"
                >
                  {usingTemplateId === template.id ? 'Using...' : 'Use Template'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
