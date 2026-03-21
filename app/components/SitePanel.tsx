import { useState } from 'react';
import { initials } from '~/lib/helpers';
import type { Site } from '~/lib/types';

interface SitePanelProps {
  sites: Site[];
  linkingMode: { type: string; id: string } | null;
  onAdd: (url: string) => void;
  onRemove: (id: string) => void;
  onBump: (id: string) => void;
  onLink: (type: 'repo' | 'site', id: string) => void;
  getLinkedRepo: (id: string) => string | null;
  onHighlight: (type: 'repo' | 'site', id: string) => void;
  onClearHighlight: () => void;
}

export function SitePanel({
  sites, linkingMode, onAdd, onRemove, onBump, onLink,
  getLinkedRepo, onHighlight, onClearHighlight,
}: SitePanelProps) {
  const [inputVal, setInputVal] = useState('');

  return (
    <div className="panel">
      <div className="panel-header">
        <span className="panel-title">Sites</span>
        <span className="panel-count">{sites.length}</span>
      </div>
      <div className="panel-body">
        {sites.length === 0 ? (
          <div className="empty">Paste a site URL below<br />to get started</div>
        ) : (
          sites.map(s => {
            const linked = getLinkedRepo(s.id);
            const isLinking = linkingMode && linkingMode.type === 'repo';
            const linkLabel = linked ? '⇄' : (isLinking ? '← link' : '⇄');
            const favicon = `https://icons.duckduckgo.com/ip3/${s.domain}.ico`;

            return (
              <a
                key={s.id}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="item"
                data-site-id={s.id}
                onClick={() => onBump(s.id)}
                onMouseEnter={() => onHighlight('site', s.id)}
                onMouseLeave={onClearHighlight}
              >
                <img
                  src={favicon}
                  width={28}
                  height={28}
                  style={{ borderRadius: 'var(--radius-sm)', flexShrink: 0 }}
                  onError={e => {
                    (e.target as HTMLElement).style.display = 'none';
                    (e.target as HTMLElement).nextElementSibling?.setAttribute('style', 'display:flex');
                  }}
                />
                <div className="item-icon site" style={{ display: 'none' }}>{initials(s.name)}</div>
                <div className="item-info">
                  <div className="item-name">
                    {s.name}
                    {linked && <span className="link-indicator"> ⇄</span>}
                  </div>
                  <div className="item-url">{s.domain}</div>
                </div>
                <div className="item-actions">
                  <button
                    className="item-btn"
                    title={linked ? 'Unlink' : 'Link to repo'}
                    onClick={e => { e.preventDefault(); e.stopPropagation(); onLink('site', s.id); }}
                  >
                    {linkLabel}
                  </button>
                  <button
                    className="item-btn"
                    title="Remove"
                    onClick={e => { e.preventDefault(); e.stopPropagation(); onRemove(s.id); }}
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
          placeholder="Paste site URL and press Enter"
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
