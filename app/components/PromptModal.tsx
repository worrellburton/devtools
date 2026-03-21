import { useState, useEffect, useRef, useCallback } from 'react';
import type { Prompt } from '~/lib/types';

interface PromptModalProps {
  isOpen: boolean;
  editingPrompt: Prompt | null;
  onSave: (name: string, text: string) => void;
  onClose: () => void;
}

export function PromptModal({ isOpen, editingPrompt, onSave, onClose }: PromptModalProps) {
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const initialName = useRef('');
  const initialText = useRef('');
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      const n = editingPrompt?.name ?? '';
      const t = editingPrompt?.text ?? '';
      setName(n);
      setText(t);
      initialName.current = n;
      initialText.current = t;
      setTimeout(() => nameRef.current?.focus(), 100);
    }
  }, [isOpen, editingPrompt]);

  const isDirty = name !== initialName.current || text !== initialText.current;

  const handleClose = useCallback(() => {
    if (isDirty) {
      if (!confirm('You have unsaved changes. Discard them?')) return;
    }
    onClose();
  }, [isDirty, onClose]);

  const handleSave = useCallback(() => {
    const trimName = name.trim();
    const trimText = text.trim();
    if (!trimName || !trimText) return;
    onSave(trimName, trimText);
  }, [name, text, onSave]);

  // Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, handleClose]);

  return (
    <div
      className={`modal-overlay${isOpen ? ' active' : ''}`}
      onClick={e => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">{editingPrompt ? 'Edit Prompt' : 'New Prompt'}</span>
          <button className="modal-close" onClick={handleClose}>&times;</button>
        </div>
        <div className="modal-body">
          <label className="modal-label">Name</label>
          <input
            ref={nameRef}
            className="modal-input"
            placeholder="e.g. Code Review"
            value={name}
            onChange={e => setName(e.target.value)}
          />
          <label className="modal-label">Prompt</label>
          <textarea
            className="modal-textarea"
            placeholder="Enter your prompt text..."
            value={text}
            onChange={e => setText(e.target.value)}
          />
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={handleClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  );
}
