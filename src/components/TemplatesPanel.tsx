'use client';

import { useEffect, useMemo, useState } from 'react';

export interface TemplateDef {
  id: string;
  name: string;
  content: string;
}

interface TemplatesPanelProps {
  recording?: {
    filename?: string;
    transcript?: string | null;
    summary?: string | null;
    tags?: string[];
    actionItems?: any[];
  } | null;
}

const STORAGE_KEY = 'templates-v1';

function loadTemplates(): TemplateDef[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function saveTemplates(list: TemplateDef[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {}
}

function renderTemplate(tpl: string, ctx: Record<string, unknown>): string {
  return tpl.replace(/{{\s*([\w\.]+)\s*}}/g, (_, key: string) => {
    const parts = key.split('.');
    let val: any = ctx;
    for (const p of parts) {
      val = val?.[p];
      if (val == null) break;
    }
    if (Array.isArray(val)) return val.join(', ');
    return val == null ? '' : String(val);
  });
}

export default function TemplatesPanel({ recording }: TemplatesPanelProps) {
  const [templates, setTemplates] = useState<TemplateDef[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [filter, setFilter] = useState('');

  useEffect(() => {
    const list = loadTemplates();
    if (list.length === 0) {
      const seed: TemplateDef[] = [
        {
          id: 'summary-brief',
          name: 'Brief Summary',
          content: 'Title: {{filename}}\n\nSummary:\n{{summary}}\n\nTags: {{tags}}'
        },
        {
          id: 'action-items',
          name: 'Action Items',
          content: 'Action Items for {{filename}}:\n- {{actionItems}}'
        },
        {
          id: 'raw-transcript',
          name: 'Raw Transcript',
          content: '{{transcript}}'
        }
      ];
      setTemplates(seed);
      setActiveId(seed[0].id);
      saveTemplates(seed);
    } else {
      setTemplates(list);
      setActiveId(list[0]?.id || '');
    }
  }, []);

  const active = useMemo(() => templates.find(t => t.id === activeId) || null, [templates, activeId]);
  const preview = useMemo(() => {
    const ctx = {
      filename: recording?.filename || 'untitled',
      transcript: recording?.transcript || '',
      summary: recording?.summary || '',
      tags: recording?.tags || [],
      actionItems: (recording?.actionItems || []).map((a: any) => (typeof a === 'string' ? a : a?.text || a?.description || ''))
    };
    return active ? renderTemplate(active.content, ctx) : '';
  }, [active, recording]);

  const addTemplate = () => {
    const id = `tpl_${Date.now()}`;
    const next = [...templates, { id, name: 'New Template', content: 'Template body with {{summary}} or {{transcript}}' }];
    setTemplates(next);
    setActiveId(id);
    saveTemplates(next);
  };

  const removeTemplate = (id: string) => {
    const next = templates.filter(t => t.id !== id);
    setTemplates(next);
    if (activeId === id) setActiveId(next[0]?.id || '');
    saveTemplates(next);
  };

  const updateActive = (patch: Partial<TemplateDef>) => {
    if (!active) return;
    const next = templates.map(t => t.id === active.id ? { ...t, ...patch } : t);
    setTemplates(next);
    saveTemplates(next);
  };

  const filtered = templates.filter(t => !filter || t.name.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="flex h-full gap-4">
      <div className="w-64 flex-shrink-0 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 p-3 flex flex-col">
        <div className="flex items-center gap-2 mb-2">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search templates"
            className="w-full px-2 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
          />
          <button onClick={addTemplate} className="px-2 py-1.5 rounded-md bg-blue-600 text-white text-sm">New</button>
        </div>
        <div className="flex-1 overflow-auto space-y-1">
          {filtered.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveId(t.id)}
              className={`w-full text-left px-2 py-1.5 rounded-md text-sm ${t.id === activeId ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 p-4">
          <div className="flex items-center justify-between mb-2">
            <input
              value={active?.name || ''}
              onChange={(e) => updateActive({ name: e.target.value })}
              className="w-full mr-2 px-2 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
            />
            {active && (
              <button onClick={() => removeTemplate(active.id)} className="px-2 py-1.5 rounded-md border border-red-300 text-red-600 text-sm">Delete</button>
            )}
          </div>
          <textarea
            value={active?.content || ''}
            onChange={(e) => updateActive({ content: e.target.value })}
            className="w-full h-[420px] resize-none px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm font-mono"
          />
        </div>

        <div className="border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 p-4">
          <div className="text-sm font-semibold mb-2">Preview</div>
          <pre className="whitespace-pre-wrap text-sm leading-6 text-gray-900 dark:text-gray-100">{preview}</pre>
        </div>
      </div>
    </div>
  );
}


