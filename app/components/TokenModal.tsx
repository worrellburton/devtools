import { useState, useEffect, useRef } from 'react';

interface TokenModalProps {
  isOpen: boolean;
  hasToken: boolean;
  onSave: (token: string) => void;
  onDisconnect: () => void;
  onClose: () => void;
}

export function TokenModal({ isOpen, hasToken, onSave, onDisconnect, onClose }: TokenModalProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setValue(hasToken ? '••••••••••••••••' : '');
      if (!hasToken) setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, hasToken]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  function handleSave() {
    const trimmed = value.trim();
    if (!trimmed || trimmed.startsWith('••')) {
      onClose();
      return;
    }
    onSave(trimmed);
  }

  return (
    <div
      className={`modal-overlay${isOpen ? ' active' : ''}`}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">GitHub Connection</span>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <label className="modal-label">Personal Access Token</label>
          <input
            ref={inputRef}
            className="modal-input"
            type="password"
            placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
            style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}
            value={value}
            onChange={e => setValue(e.target.value)}
          />
          <p style={{ fontSize: '10px', color: 'var(--text-dim)', lineHeight: 1.7, marginTop: '-6px' }}>
            Create a token at GitHub &rarr; Settings &rarr; Developer settings &rarr; Personal access tokens.<br />
            Needs <code style={{ background: 'var(--bg)', padding: '1px 4px', borderRadius: '3px' }}>repo</code> scope to read workflow runs. Stored locally only.
          </p>
        </div>
        <div className="modal-footer">
          {hasToken && (
            <button
              className="btn btn-danger"
              style={{ marginRight: 'auto' }}
              onClick={() => { onDisconnect(); onClose(); }}
            >
              Disconnect
            </button>
          )}
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>Connect</button>
        </div>
      </div>
    </div>
  );
}
