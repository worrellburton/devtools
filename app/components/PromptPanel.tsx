import { useState, useRef } from 'react';
import type { Prompt } from '~/lib/types';

interface PromptPanelProps {
  prompts: Prompt[];
  onRemove: (id: string) => void;
  onEdit: (prompt: Prompt) => void;
  onNew: () => void;
}

export function PromptPanel({ prompts, onRemove, onEdit, onNew }: PromptPanelProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  function copyPrompt(p: Prompt) {
    navigator.clipboard.writeText(p.text);
    setCopiedId(p.id);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopiedId(null), 1200);
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <span className="panel-title">Prompts</span>
        <span className="panel-count">{prompts.length}</span>
      </div>
      <div className="panel-body">
        {prompts.length === 0 ? (
          <div className="empty">Add prompts to build<br />your quick-copy library</div>
        ) : (
          prompts.map(p => (
            <div key={p.id} className="prompt-item" onClick={() => copyPrompt(p)}>
              <div className="prompt-top">
                <span className="prompt-name">
                  {copiedId === p.id ? <span className="copy-toast">Copied!</span> : p.name}
                </span>
                <div className="prompt-actions">
                  <button
                    className="item-btn"
                    title="Edit"
                    onClick={e => { e.stopPropagation(); onEdit(p); }}
                  >
                    ✎
                  </button>
                  <button
                    className="item-btn"
                    title="Remove"
                    onClick={e => { e.stopPropagation(); onRemove(p.id); }}
                  >
                    ✕
                  </button>
                </div>
              </div>
              <div className="prompt-preview">{p.text}</div>
            </div>
          ))
        )}
      </div>
      <div className="add-bar">
        <button className="btn btn-primary" style={{ width: '100%' }} onClick={onNew}>
          + New Prompt
        </button>
      </div>
    </div>
  );
}
