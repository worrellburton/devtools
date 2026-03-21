interface TopBarProps {
  ghToken: string;
  theme: string;
  onToggleTheme: () => void;
  onOpenTokenModal: () => void;
}

export function TopBar({ ghToken, theme, onToggleTheme, onOpenTokenModal }: TopBarProps) {
  return (
    <div className="topbar">
      <div className="logo"><span>&gt;</span> devtools</div>
      <div className="sep" />
      <div className="tagline">repos &middot; sites &middot; prompts</div>
      <div className="topbar-right">
        <span className={`gh-status${ghToken ? ' connected' : ''}`}>
          {ghToken ? 'connected' : ''}
        </span>
        <button className="topbar-btn" onClick={onOpenTokenModal}>
          {ghToken ? 'GitHub' : 'Connect GitHub'}
        </button>
        <button
          className="theme-toggle"
          onClick={onToggleTheme}
          title="Toggle theme"
          dangerouslySetInnerHTML={{ __html: theme === 'dark' ? '&#9790;' : '&#9728;' }}
        />
      </div>
    </div>
  );
}
