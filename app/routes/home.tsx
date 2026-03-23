import { useState, useRef, useCallback, useEffect } from "react";
import {
  connect,
  save,
  isConfigured,
  type DevtoolsData,
  type Repo,
  type Site,
  type Prompt,
  type Link,
} from "../firebase";

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function extractName(url: string) {
  try {
    const u = new URL(url);
    const parts = u.pathname.replace(/\/+$/, "").split("/").filter(Boolean);
    if (parts.length >= 2) return parts.slice(-2).join("/");
    if (parts.length === 1) return parts[0];
    return u.hostname;
  } catch {
    return url;
  }
}

function extractDomain(url: string) {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url;
  }
}

function initials(name: string) {
  const parts = name.split("/");
  return parts[parts.length - 1].substring(0, 2).toUpperCase();
}

function extractGhRepo(url: string) {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("github.com")) return null;
    const parts = u.pathname.replace(/\/+$/, "").split("/").filter(Boolean);
    if (parts.length >= 2) return parts[0] + "/" + parts[1];
  } catch {}
  return null;
}

type ActionStatus = { status: string; label: string };

export default function Home() {
  const [locked, setLocked] = useState(true);
  const [password, setPassword] = useState("");
  const [lockError, setLockError] = useState("");
  const [shaking, setShaking] = useState(false);

  const [repos, setRepos] = useState<Repo[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [ghToken, setGhToken] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">("light");

  const [actionStatuses, setActionStatuses] = useState<Record<string, ActionStatus>>({});
  const [linkingMode, setLinkingMode] = useState<{ type: "repo" | "site"; id: string } | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  const [promptModal, setPromptModal] = useState(false);
  const [tokenModal, setTokenModal] = useState(false);
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);
  const [promptName, setPromptName] = useState("");
  const [promptText, setPromptText] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const connectedRef = useRef(false);
  const skipNextRef = useRef(false);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const saveToFirebase = useCallback(
    (r: Repo[], s: Site[], p: Prompt[], l: Link[], t: string, th: "light" | "dark") => {
      if (!connectedRef.current) return;
      skipNextRef.current = true;
      save({ repos: r, sites: s, prompts: p, links: l, ghToken: t, theme: th });
    },
    []
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPromptModal(false);
        setTokenModal(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  function handleUnlock() {
    if (!password) return;
    if (!isConfigured()) {
      setLockError("Firebase not configured — edit app/firebase.ts");
      return;
    }
    connect(password, (data) => {
      if (skipNextRef.current) {
        skipNextRef.current = false;
        return;
      }
      setRepos(data.repos);
      setSites(data.sites);
      setPrompts(data.prompts);
      setLinks(data.links);
      setGhToken(data.ghToken);
      setTheme(data.theme);
    });
    connectedRef.current = true;
    setLocked(false);
  }

  function handleLockKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      if (!password) {
        setLockError("Enter a password");
        setShaking(true);
        setTimeout(() => setShaking(false), 400);
        return;
      }
      handleUnlock();
    }
  }

  function getLinkedSite(repoId: string) {
    return links.find((l) => l.repoId === repoId)?.siteId ?? null;
  }
  function getLinkedRepo(siteId: string) {
    return links.find((l) => l.siteId === siteId)?.repoId ?? null;
  }

  function persist(r: Repo[], s: Site[], p: Prompt[], l: Link[], t?: string, th?: "light" | "dark") {
    saveToFirebase(r, s, p, l, t ?? ghToken, th ?? theme);
  }

  function addRepo(url: string) {
    url = url.trim();
    if (!url) return;
    if (!url.startsWith("http")) url = "https://" + url;
    const repo: Repo = { id: uid(), url, name: extractName(url), domain: extractDomain(url) };
    const nr = [...repos, repo];
    setRepos(nr);
    persist(nr, sites, prompts, links);
    if (ghToken) fetchActionStatus(repo, ghToken);
  }

  function removeRepo(id: string) {
    const nr = repos.filter((r) => r.id !== id);
    const nl = links.filter((l) => l.repoId !== id);
    setRepos(nr);
    setLinks(nl);
    persist(nr, sites, prompts, nl);
  }

  function bumpRepo(id: string) {
    const idx = repos.findIndex((r) => r.id === id);
    const nr = [...repos];
    if (idx > 0) {
      const [item] = nr.splice(idx, 1);
      nr.unshift(item);
    }
    const siteId = getLinkedSite(id);
    let ns = sites;
    if (siteId) {
      ns = [...sites];
      const si = ns.findIndex((s) => s.id === siteId);
      if (si > 0) {
        const [site] = ns.splice(si, 1);
        ns.unshift(site);
      }
    }
    setRepos(nr);
    setSites(ns);
    persist(nr, ns, prompts, links);
  }

  function addSite(url: string) {
    url = url.trim();
    if (!url) return;
    if (!url.startsWith("http")) url = "https://" + url;
    const site: Site = { id: uid(), url, name: extractName(url), domain: extractDomain(url) };
    const ns = [...sites, site];
    setSites(ns);
    persist(repos, ns, prompts, links);
  }

  function removeSite(id: string) {
    const ns = sites.filter((s) => s.id !== id);
    const nl = links.filter((l) => l.siteId !== id);
    setSites(ns);
    setLinks(nl);
    persist(repos, ns, prompts, nl);
  }

  function bumpSite(id: string) {
    const idx = sites.findIndex((s) => s.id === id);
    const ns = [...sites];
    if (idx > 0) {
      const [item] = ns.splice(idx, 1);
      ns.unshift(item);
    }
    const repoId = getLinkedRepo(id);
    let nr = repos;
    if (repoId) {
      nr = [...repos];
      const ri = nr.findIndex((r) => r.id === repoId);
      if (ri > 0) {
        const [repo] = nr.splice(ri, 1);
        nr.unshift(repo);
      }
    }
    setRepos(nr);
    setSites(ns);
    persist(nr, ns, prompts, links);
  }

  function removePrompt(id: string) {
    const np = prompts.filter((p) => p.id !== id);
    setPrompts(np);
    persist(repos, sites, np, links);
  }

  function openNewPrompt() {
    setEditingPromptId(null);
    setPromptName("");
    setPromptText("");
    setPromptModal(true);
  }

  function editPrompt(id: string) {
    const p = prompts.find((x) => x.id === id);
    if (!p) return;
    setEditingPromptId(id);
    setPromptName(p.name);
    setPromptText(p.text);
    setPromptModal(true);
  }

  function savePrompt() {
    const name = promptName.trim();
    const text = promptText.trim();
    if (!name || !text) return;
    let np: Prompt[];
    if (editingPromptId) {
      np = prompts.map((p) => (p.id === editingPromptId ? { ...p, name, text } : p));
    } else {
      np = [...prompts, { id: uid(), name, text }];
    }
    setPrompts(np);
    persist(repos, sites, np, links);
    setPromptModal(false);
  }

  function copyPrompt(id: string) {
    const p = prompts.find((x) => x.id === id);
    if (!p) return;
    navigator.clipboard.writeText(p.text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1200);
  }

  function startLink(type: "repo" | "site", id: string) {
    const key = (type + "Id") as "repoId" | "siteId";
    const existing = links.find((l) => l[key] === id);
    if (existing) {
      const nl = links.filter((l) => l !== existing);
      setLinks(nl);
      setLinkingMode(null);
      persist(repos, sites, prompts, nl);
      return;
    }
    if (linkingMode && linkingMode.type !== type) {
      const link = {} as any;
      link[linkingMode.type + "Id"] = linkingMode.id;
      link[type + "Id"] = id;
      const nl = [...links.filter((l) => l.repoId !== link.repoId && l.siteId !== link.siteId), link as Link];
      setLinks(nl);
      setLinkingMode(null);
      persist(repos, sites, prompts, nl);
    } else {
      setLinkingMode({ type, id });
    }
  }

  function highlightLinked(type: "repo" | "site", id: string) {
    setHighlightedId(type === "repo" ? getLinkedSite(id) : getLinkedRepo(id));
  }

  async function fetchActionStatus(repo: Repo, token: string) {
    const ghRepo = extractGhRepo(repo.url);
    if (!ghRepo || !token) {
      setActionStatuses((prev) => ({ ...prev, [repo.id]: { status: "none", label: "Not a GitHub repo" } }));
      return;
    }
    try {
      const res = await fetch(`https://api.github.com/repos/${ghRepo}/actions/runs?per_page=1`, {
        headers: { Authorization: `token ${token}`, Accept: "application/vnd.github.v3+json" },
      });
      if (res.status === 404) {
        setActionStatuses((prev) => ({ ...prev, [repo.id]: { status: "neutral", label: "No actions configured" } }));
        return;
      }
      if (!res.ok) {
        setActionStatuses((prev) => ({ ...prev, [repo.id]: { status: "neutral", label: `API error ${res.status}` } }));
        return;
      }
      const data = await res.json();
      if (!data.workflow_runs?.length) {
        setActionStatuses((prev) => ({ ...prev, [repo.id]: { status: "neutral", label: "No workflow runs" } }));
        return;
      }
      const run = data.workflow_runs[0];
      let st: ActionStatus;
      if (["in_progress", "queued", "waiting"].includes(run.status)) {
        st = { status: "pending", label: `${run.name}: ${run.status}` };
      } else if (run.conclusion === "success") {
        st = { status: "success", label: `${run.name}: passed` };
      } else if (run.conclusion === "failure") {
        st = { status: "failure", label: `${run.name}: failed` };
      } else {
        st = { status: "neutral", label: `${run.name}: ${run.conclusion || run.status}` };
      }
      setActionStatuses((prev) => ({ ...prev, [repo.id]: st }));
    } catch {
      setActionStatuses((prev) => ({ ...prev, [repo.id]: { status: "neutral", label: "Network error" } }));
    }
  }

  function refreshAllStatuses(token?: string) {
    const t = token ?? ghToken;
    if (!t) return;
    repos.forEach((r) => fetchActionStatus(r, t));
  }

  function openTokenModalFn() {
    setTokenInput(ghToken ? "••••••••••••••••" : "");
    setTokenModal(true);
  }

  function saveToken() {
    const val = tokenInput.trim();
    if (!val || val.startsWith("••")) { setTokenModal(false); return; }
    setGhToken(val);
    persist(repos, sites, prompts, links, val);
    setTokenModal(false);
    refreshAllStatuses(val);
  }

  function disconnectGitHub() {
    setGhToken("");
    setActionStatuses({});
    persist(repos, sites, prompts, links, "");
    setTokenModal(false);
  }

  function toggleTheme() {
    const t = theme === "dark" ? "light" : "dark";
    setTheme(t);
    persist(repos, sites, prompts, links, undefined, t);
  }

  function exportData() {
    const data = { repos, sites, prompts, links, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "devtools-backup.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function importData(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target!.result as string);
        const nr = data.repos || repos;
        const ns = data.sites || sites;
        const np = data.prompts || prompts;
        const nl = data.links || links;
        setRepos(nr); setSites(ns); setPrompts(np); setLinks(nl);
        persist(nr, ns, np, nl);
        refreshAllStatuses();
      } catch { alert("Invalid backup file."); }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  useEffect(() => {
    if (!locked && ghToken && repos.length) refreshAllStatuses();
  }, [locked]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Lock Screen ---
  if (locked) {
    return (
      <div className="lock-screen">
        <div className="lock-title">devtools</div>
        <input
          type="password"
          className={`lock-input ${shaking ? "shake" : ""}`}
          placeholder="Password"
          autoFocus
          value={password}
          onChange={(e) => { setPassword(e.target.value); setLockError(""); }}
          onKeyDown={handleLockKeyDown}
        />
        <div className="lock-error">{lockError}</div>
      </div>
    );
  }

  // --- Main App ---
  const importRef = document.createElement("input"); // just for typing
  return (
    <>
      <div className="topbar">
        <div className="logo">devtools</div>
        <div className="sep" />
        <div className="tagline">repos · sites · prompts</div>
        <div className="topbar-right">
          <span className={`gh-status ${ghToken ? "connected" : ""}`}>
            {ghToken ? "connected" : ""}
          </span>
          <button className="topbar-btn" onClick={openTokenModalFn}>
            {ghToken ? "GitHub" : "Connect GitHub"}
          </button>
          <button className="topbar-btn" onClick={exportData}>Export</button>
          <ImportButton onImport={importData} />
          <button className="theme-toggle" onClick={toggleTheme}>
            {theme === "dark" ? "\u263E" : "\u2600"}
          </button>
        </div>
      </div>

      <div className="layout">
        {/* Repos */}
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">Repos</span>
            <span className="panel-count">{repos.length}</span>
          </div>
          <div className="panel-body">
            {!repos.length ? (
              <div className="empty">Paste a repo URL below<br />to get started</div>
            ) : repos.map((r) => {
              const st = actionStatuses[r.id];
              const linked = getLinkedSite(r.id);
              const isLinking = linkingMode?.type === "site";
              const linkLabel = linked ? "⇄" : isLinking ? "← link" : "⇄";
              return (
                <a key={r.id} href={r.url} target="_blank" rel="noopener noreferrer"
                  className={`item ${highlightedId === r.id ? "linked-highlight" : ""}`}
                  onClick={(e) => { e.preventDefault(); bumpRepo(r.id); window.open(r.url, "_blank"); }}
                  onMouseEnter={() => highlightLinked("repo", r.id)}
                  onMouseLeave={() => setHighlightedId(null)}>
                  <FaviconImg domain={r.domain} type="repo" name={r.name} />
                  <div className="item-info">
                    <div className="item-name">{r.name}{linked && <span className="link-indicator"> ⇄</span>}</div>
                    <div className="item-url">{r.domain}</div>
                  </div>
                  {st && <div className={`status-dot ${st.status}`} title={st.label} />}
                  <div className="item-actions">
                    <button className="item-btn" title={linked ? "Unlink" : "Link to site"}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); startLink("repo", r.id); }}>{linkLabel}</button>
                    <button className="item-btn" title="Remove"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeRepo(r.id); }}>✕</button>
                  </div>
                </a>
              );
            })}
          </div>
          <AddBar placeholder="Paste repo URL and press Enter" onSubmit={addRepo} />
        </div>

        {/* Sites */}
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">Sites</span>
            <span className="panel-count">{sites.length}</span>
          </div>
          <div className="panel-body">
            {!sites.length ? (
              <div className="empty">Paste a site URL below<br />to get started</div>
            ) : sites.map((s) => {
              const linked = getLinkedRepo(s.id);
              const isLinking = linkingMode?.type === "repo";
              const linkLabel = linked ? "⇄" : isLinking ? "← link" : "⇄";
              return (
                <a key={s.id} href={s.url} target="_blank" rel="noopener noreferrer"
                  className={`item ${highlightedId === s.id ? "linked-highlight" : ""}`}
                  onClick={(e) => { e.preventDefault(); bumpSite(s.id); window.open(s.url, "_blank"); }}
                  onMouseEnter={() => highlightLinked("site", s.id)}
                  onMouseLeave={() => setHighlightedId(null)}>
                  <FaviconImg domain={s.domain} type="site" name={s.name} />
                  <div className="item-info">
                    <div className="item-name">{s.name}{linked && <span className="link-indicator"> ⇄</span>}</div>
                    <div className="item-url">{s.domain}</div>
                  </div>
                  <div className="item-actions">
                    <button className="item-btn" title={linked ? "Unlink" : "Link to repo"}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); startLink("site", s.id); }}>{linkLabel}</button>
                    <button className="item-btn" title="Remove"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeSite(s.id); }}>✕</button>
                  </div>
                </a>
              );
            })}
          </div>
          <AddBar placeholder="Paste site URL and press Enter" onSubmit={addSite} />
        </div>

        {/* Prompts */}
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">Prompts</span>
            <span className="panel-count">{prompts.length}</span>
          </div>
          <div className="panel-body">
            {!prompts.length ? (
              <div className="empty">Add prompts to build<br />your quick-copy library</div>
            ) : prompts.map((p) => (
              <div key={p.id} className="prompt-item" onClick={() => copyPrompt(p.id)}>
                <div className="prompt-top">
                  <span className="prompt-name">
                    {copiedId === p.id ? <span className="copy-toast">Copied!</span> : p.name}
                  </span>
                  <div className="prompt-actions">
                    <button className="item-btn" title="Edit" onClick={(e) => { e.stopPropagation(); editPrompt(p.id); }}>✎</button>
                    <button className="item-btn" title="Remove" onClick={(e) => { e.stopPropagation(); removePrompt(p.id); }}>✕</button>
                  </div>
                </div>
                <div className="prompt-preview">{p.text}</div>
              </div>
            ))}
          </div>
          <div className="add-bar">
            <button className="topbar-btn" style={{ width: "100%" }} onClick={openNewPrompt}>+ New Prompt</button>
          </div>
        </div>
      </div>

      {/* Prompt Modal */}
      <div className={`modal-overlay ${promptModal ? "active" : ""}`}
        onClick={(e) => e.target === e.currentTarget && setPromptModal(false)}>
        <div className="modal">
          <div className="modal-header">
            <span className="modal-title">{editingPromptId ? "Edit Prompt" : "New Prompt"}</span>
            <button className="modal-close" onClick={() => setPromptModal(false)}>&times;</button>
          </div>
          <div className="modal-body">
            <label className="modal-label">Name</label>
            <input className="modal-input" placeholder="e.g. Code Review" value={promptName}
              onChange={(e) => setPromptName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && savePrompt()} />
            <label className="modal-label">Prompt Text</label>
            <textarea className="modal-textarea" placeholder="Enter your prompt template..."
              value={promptText} onChange={(e) => setPromptText(e.target.value)} />
          </div>
          <div className="modal-footer">
            <button className="btn" onClick={() => setPromptModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={savePrompt}>Save</button>
          </div>
        </div>
      </div>

      {/* Token Modal */}
      <div className={`modal-overlay ${tokenModal ? "active" : ""}`}
        onClick={(e) => e.target === e.currentTarget && setTokenModal(false)}>
        <div className="modal">
          <div className="modal-header">
            <span className="modal-title">GitHub Connection</span>
            <button className="modal-close" onClick={() => setTokenModal(false)}>&times;</button>
          </div>
          <div className="modal-body">
            <label className="modal-label">Personal Access Token</label>
            <input className="modal-input" type="password" placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px" }}
              value={tokenInput} onChange={(e) => setTokenInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveToken()} />
            <p style={{ fontSize: "10px", color: "var(--text-dim)", lineHeight: "1.7", marginTop: "-6px" }}>
              Create a token at GitHub → Settings → Developer settings → Personal access tokens.<br />
              Needs <code style={{ background: "var(--bg)", padding: "1px 4px", borderRadius: "3px" }}>repo</code> scope
              to read workflow runs. Stored in Firebase only.
            </p>
          </div>
          <div className="modal-footer">
            {ghToken && <button className="btn btn-danger" style={{ marginRight: "auto" }} onClick={disconnectGitHub}>Disconnect</button>}
            <button className="btn" onClick={() => setTokenModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={saveToken}>Connect</button>
          </div>
        </div>
      </div>
    </>
  );
}

function faviconUrl(domain: string): string | null {
  if (domain === "github.com" || domain.endsWith(".github.io")) return "https://github.githubassets.com/favicons/favicon.svg";
  if (domain === "gitlab.com" || domain.endsWith(".gitlab.io")) return "https://gitlab.com/assets/favicon-72a2cad5025aa931d6ea56c3201d1f18e68a8571571ccfa3e91c7cee0547e3b3.png";
  if (domain === "bitbucket.org") return "https://wac-cdn.atlassian.com/assets/img/favicons/bitbucket/favicon.png";
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
}

function FaviconImg({ domain, type, name }: { domain: string; type: "repo" | "site"; name: string }) {
  const [failed, setFailed] = useState(false);
  const src = faviconUrl(domain);
  if (failed || !src) return <div className={`item-icon ${type}`}>{initials(name)}</div>;
  return (
    <img src={src} width={32} height={32}
      style={{ borderRadius: "var(--radius-sm)", flexShrink: 0 }} onError={() => setFailed(true)} alt="" />
  );
}

function AddBar({ placeholder, onSubmit }: { placeholder: string; onSubmit: (val: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <div className="add-bar">
      <input className="add-input" placeholder={placeholder} value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { onSubmit(value); setValue(""); } }} />
    </div>
  );
}

function ImportButton({ onImport }: { onImport: (e: React.ChangeEvent<HTMLInputElement>) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button className="topbar-btn" onClick={() => ref.current?.click()}>Import</button>
      <input ref={ref} type="file" accept=".json" style={{ display: "none" }} onChange={onImport} />
    </>
  );
}
