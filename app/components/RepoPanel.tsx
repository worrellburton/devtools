import { useState, useRef, useCallback } from 'react';
import { initials } from '~/lib/helpers';
import type { Repo, ActionStatus, LangInfo } from '~/lib/types';

interface RepoPanelProps {
  repos: Repo[];
  actionStatuses: Record<string, ActionStatus>;
  repoLanguages: Record<string, LangInfo[]>;
  linkingMode: { type: string; id: string } | null;
  ghToken: string;
  onAdd: (url: string) => void;
  onRemove: (id: string) => void;
  onSetup: (id: string) => Promise<string | null>;
  onEnableActions: (id: string) => Promise<string | null>;
  onLink: (type: 'repo' | 'site', id: string) => void;
  onOpenTokenModal: () => void;
  getLinkedSite: (id: string) => string | null;
  onHighlight: (type: 'repo' | 'site', id: string) => void;
  onClearHighlight: () => void;
}

export function RepoPanel({
  repos, actionStatuses, repoLanguages, linkingMode, ghToken,
  onAdd, onRemove, onSetup, onEnableActions, onLink, onOpenTokenModal,
  getLinkedSite, onHighlight, onClearHighlight,
}: RepoPanelProps) {
  const [inputVal, setInputVal] = useState('');
  const setupBtnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const enableBtnRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const handleSetup = useCallback(async (e: React.MouseEvent, repoId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!ghToken) { onOpenTokenModal(); return; }
    const btn = setupBtnRefs.current[repoId];
    if (btn) { btn.textContent = '...'; btn.classList.add('loading'); }
    const branchName = await onSetup(repoId);
    if (btn) {
      btn.classList.remove('loading');
      if (branchName) {
        btn.textContent = `✓ ${branchName}`;
        btn.style.color = '#34d399';
        btn.style.borderColor = '#34d39940';
        setTimeout(() => { btn.textContent = 'Setup'; btn.style.color = ''; btn.style.borderColor = ''; }, 2500);
      } else {
        btn.textContent = 'Setup';
      }
    }
  }, [ghToken, onSetup, onOpenTokenModal]);

  const handleEnableActions = useCallback(async (e: React.MouseEvent, repoId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!ghToken) { onOpenTokenModal(); return; }
    const btn = enableBtnRefs.current[repoId];
    if (btn) { btn.textContent = '...'; btn.classList.add('loading'); }
    const branchName = await onEnableActions(repoId);
    if (btn) {
      btn.classList.remove('loading');
      if (branchName) {
        btn.textContent = '✓ Copied';
        btn.style.color = '#34d399';
        btn.style.borderColor = '#34d39940';
        setTimeout(() => { btn.textContent = 'Enable Actions'; btn.style.color = ''; btn.style.borderColor = ''; }, 2500);
      } else {
        btn.textContent = 'Enable Actions';
      }
    }
  }, [ghToken, onEnableActions, onOpenTokenModal]);

  return (
    <div className="panel">
      <div className="panel-header">
        <span className="panel-title">Repos</span>
        <span className="panel-count">{repos.length}</span>
      </div>
      <div className="panel-body">
        {repos.length === 0 ? (
          <div className="empty">Paste a repo URL below<br />to get started</div>
        ) : (
          repos.map(r => {
            const st = actionStatuses[r.id];
            const dotClass = st ? st.status : 'none';
            const dotTitle = st ? st.label : 'No status';
            const linked = getLinkedSite(r.id);
            const isLinking = linkingMode && linkingMode.type === 'site';
            const linkLabel = linked ? '⇄' : (isLinking ? '← link' : '⇄');
            const langs = repoLanguages[r.id];

            return (
              <a
                key={r.id}
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="item"
                data-repo-id={r.id}
                onMouseEnter={() => onHighlight('repo', r.id)}
                onMouseLeave={onClearHighlight}
              >
                <img
                  src={`https://icons.duckduckgo.com/ip3/${r.domain}.ico`}
                  width={28}
                  height={28}
                  style={{ borderRadius: 'var(--radius-sm)', flexShrink: 0 }}
                  onError={e => {
                    (e.target as HTMLElement).style.display = 'none';
                    (e.target as HTMLElement).nextElementSibling?.setAttribute('style', 'display:flex');
                  }}
                />
                <div className="item-icon repo" style={{ display: 'none' }}>{initials(r.name)}</div>
                <div className="item-info">
                  <div className="item-name">
                    {r.name}
                    {linked && <span className="link-indicator"> ⇄</span>}
                  </div>
                  <div className="item-url">{r.domain}</div>
                  {langs && langs.length > 0 && (
                    <div className="tech-stack">
                      {langs.map(l => (
                        <span key={l.name} className="tech-tag" title={`${l.pct}%`}>{l.name}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className={`status-dot ${dotClass}`} title={dotTitle} />
                {dotClass === 'error' && (
                  <span className="status-label" style={{ color: '#ef4444' }}>⚠ hover for fix</span>
                )}
                <div className="item-actions">
                  {(dotClass === 'neutral' || dotClass === 'none') && (
                    <button
                      ref={el => { enableBtnRefs.current[r.id] = el; }}
                      className="setup-btn enable-btn"
                      title="Generate workflow prompt"
                      onClick={e => handleEnableActions(e, r.id)}
                      style={{ borderColor: '#f59e0b40', color: '#f59e0b', background: '#f59e0b10' }}
                    >
                      Enable Actions
                    </button>
                  )}
                  <button
                    ref={el => { setupBtnRefs.current[r.id] = el; }}
                    className="setup-btn"
                    title="Generate setup prompt"
                    onClick={e => handleSetup(e, r.id)}
                  >
                    Setup
                  </button>
                  <button
                    className="item-btn"
                    title={linked ? 'Unlink' : 'Link to site'}
                    onClick={e => { e.preventDefault(); e.stopPropagation(); onLink('repo', r.id); }}
                  >
                    {linkLabel}
                  </button>
                  <button
                    className="item-btn"
                    title="Remove"
                    onClick={e => { e.preventDefault(); onRemove(r.id); }}
                  >
                    ✕
                  </button>
                </div>
              </a>
            );
          })
        )}
      </div>
      <div className="add-bar">
        <input
          className="add-input"
          placeholder="Paste repo URL and press Enter"
          value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              onAdd(inputVal);
              setInputVal('');
            }
          }}
        />
      </div>
    </div>
  );
}
