import { useState, useRef, useCallback, useEffect } from "react";
import {
  connect,
  save,
  isConfigured,
  type DevtoolsData,
  type Repo,
  type Site,
  type Prompt,
  type Db,
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

const COPY_EMOJIS = ["🎉","🚀","✨","🔥","⚡","💫","🌟","🎯","💡","🦄","🍀","🎸","🌈","💎","🧠","👾","🐙","🦊","🍕","🎲"];

export default function Home() {
  const [locked, setLocked] = useState(true);
  const [password, setPassword] = useState("");
  const [lockError, setLockError] = useState("");
  const [shaking, setShaking] = useState(false);

  const [repos, setRepos] = useState<Repo[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [dbs, setDbs] = useState<Db[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [ghToken, setGhToken] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">("light");

  const [actionStatuses, setActionStatuses] = useState<Record<string, ActionStatus>>({});
  const [linkingMode, setLinkingMode] = useState<{ type: "repo" | "site" | "db"; id: string } | null>(null);
  const [highlightedIds, setHighlightedIds] = useState<string[]>([]);

  const [promptModal, setPromptModal] = useState(false);
  const [tokenModal, setTokenModal] = useState(false);
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);
  const [promptName, setPromptName] = useState("");
  const [promptText, setPromptText] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copyCounts, setCopyCounts] = useState<Record<string, number>>({});
  const [copyEmojis, setCopyEmojis] = useState<Record<string, string>>({});
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const connectedRef = useRef(false);
  const skipNextRef = useRef(false);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const saveToFirebase = useCallback(
    (r: Repo[], s: Site[], p: Prompt[], d: Db[], l: Link[], t: string, th: "light" | "dark") => {
      if (!connectedRef.current) return;
      skipNextRef.current = true;
      save({ repos: r, sites: s, prompts: p, dbs: d, links: l, ghToken: t, theme: th });
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
      setDbs(data.dbs);
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

  const linkKeyMap = { repo: "repoId", site: "siteId", db: "dbId" } as const;

  function getLinkedIds(type: "repo" | "site" | "db", id: string) {
    const key = linkKeyMap[type];
    const result: string[] = [];
    for (const l of links) {
      if (l[key] !== id) continue;
      if (l.repoId && l.repoId !== id) result.push(l.repoId);
      if (l.siteId && l.siteId !== id) result.push(l.siteId);
      if (l.dbId && l.dbId !== id) result.push(l.dbId);
    }
    return result;
  }

  function isLinked(type: "repo" | "site" | "db", id: string) {
    const key = linkKeyMap[type];
    return links.some((l) => l[key] === id);
  }

  // Keep backwards-compat helpers used in bump functions
  function getLinkedSite(repoId: string) {
    return links.find((l) => l.repoId === repoId)?.siteId ?? null;
  }
  function getLinkedRepo(siteId: string) {
    return links.find((l) => l.siteId === siteId)?.repoId ?? null;
  }

  function persist(r: Repo[], s: Site[], p: Prompt[], d: Db[], l: Link[], t?: string, th?: "light" | "dark") {
    saveToFirebase(r, s, p, d, l, t ?? ghToken, th ?? theme);
  }

  function addRepo(url: string) {
    url = url.trim();
    if (!url) return;
    if (!url.startsWith("http")) url = "https://" + url;
    const repo: Repo = { id: uid(), url, name: extractName(url), domain: extractDomain(url) };
    const nr = [...repos, repo];
    setRepos(nr);
    persist(nr, sites, prompts, dbs, links);
    if (ghToken) fetchActionStatus(repo, ghToken);
  }

  function removeRepo(id: string) {
    const nr = repos.filter((r) => r.id !== id);
    const nl = links.filter((l) => l.repoId !== id);
    setRepos(nr);
    setLinks(nl);
    persist(nr, sites, prompts, dbs, nl);
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
    persist(nr, ns, prompts, dbs, links);
  }

  function addSite(url: string) {
    url = url.trim();
    if (!url) return;
    if (!url.startsWith("http")) url = "https://" + url;
    const site: Site = { id: uid(), url, name: extractName(url), domain: extractDomain(url) };
    const ns = [...sites, site];
    setSites(ns);
    persist(repos, ns, prompts, dbs, links);
  }

  function removeSite(id: string) {
    const ns = sites.filter((s) => s.id !== id);
    const nl = links.filter((l) => l.siteId !== id);
    setSites(ns);
    setLinks(nl);
    persist(repos, ns, prompts, dbs, nl);
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
    persist(nr, ns, prompts, dbs, links);
  }

  function removePrompt(id: string) {
    const np = prompts.filter((p) => p.id !== id);
    setPrompts(np);
    persist(repos, sites, np, dbs, links);
  }

  function addDb(url: string) {
    url = url.trim();
    if (!url) return;
    if (!url.startsWith("http")) url = "https://" + url;
    const db: Db = { id: uid(), url, name: extractName(url), domain: extractDomain(url) };
    const nd = [...dbs, db];
    setDbs(nd);
    persist(repos, sites, prompts, nd, links);
  }

  function removeDb(id: string) {
    const nd = dbs.filter((d) => d.id !== id);
    const nl = links.filter((l) => l.dbId !== id);
    setDbs(nd);
    setLinks(nl);
    persist(repos, sites, prompts, nd, nl);
  }

  function startRename(id: string, currentName: string) {
    setRenamingId(id);
    setRenameValue(currentName);
  }

  function commitRename(type: "repo" | "site" | "db") {
    if (!renamingId) return;
    const name = renameValue.trim();
    if (!name) { setRenamingId(null); return; }
    if (type === "repo") {
      const nr = repos.map((r) => r.id === renamingId ? { ...r, name } : r);
      setRepos(nr);
      persist(nr, sites, prompts, dbs, links);
    } else if (type === "site") {
      const ns = sites.map((s) => s.id === renamingId ? { ...s, name } : s);
      setSites(ns);
      persist(repos, ns, prompts, dbs, links);
    } else {
      const nd = dbs.map((d) => d.id === renamingId ? { ...d, name } : d);
      setDbs(nd);
      persist(repos, sites, prompts, nd, links);
    }
    setRenamingId(null);
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
    persist(repos, sites, np, dbs, links);
    setPromptModal(false);
  }

  function copyPrompt(id: string) {
    const p = prompts.find((x) => x.id === id);
    if (!p) return;
    navigator.clipboard.writeText(p.text);
    setCopiedId(id);
    setCopyCounts((prev) => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
    setCopyEmojis((prev) => ({ ...prev, [id]: COPY_EMOJIS[Math.floor(Math.random() * COPY_EMOJIS.length)] }));
    setTimeout(() => setCopiedId(null), 1200);
  }

  function startLink(type: "repo" | "site" | "db", id: string) {
    const key = linkKeyMap[type];
    // If already linked, clicking unlinks all connections for this item
    if (isLinked(type, id) && !linkingMode) {
      const nl = links.filter((l) => l[key] !== id);
      setLinks(nl);
      persist(repos, sites, prompts, dbs, nl);
      return;
    }
    // If we're in linking mode and clicking a different type, create the link
    if (linkingMode && linkingMode.type !== type) {
      const link: Link = {};
      link[linkKeyMap[linkingMode.type]] = linkingMode.id;
      link[key] = id;
      // Remove any existing link between these same two slots
      const k1 = linkKeyMap[linkingMode.type];
      const k2 = key;
      const nl = [...links.filter((l) => !(l[k1] === linkingMode.id && l[k2] === id)), link];
      setLinks(nl);
      setLinkingMode(null);
      persist(repos, sites, prompts, dbs, nl);
    } else if (linkingMode && linkingMode.type === type && linkingMode.id === id) {
      // Cancel linking mode by clicking the same item
      setLinkingMode(null);
    } else {
      setLinkingMode({ type, id });
    }
  }

  function highlightLinked(type: "repo" | "site" | "db", id: string) {
    setHighlightedIds(getLinkedIds(type, id));
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
    persist(repos, sites, prompts, dbs, links, val);
    setTokenModal(false);
    refreshAllStatuses(val);
  }

  function disconnectGitHub() {
    setGhToken("");
    setActionStatuses({});
    persist(repos, sites, prompts, dbs, links, "");
    setTokenModal(false);
  }

  function toggleTheme() {
    const t = theme === "dark" ? "light" : "dark";
    setTheme(t);
    persist(repos, sites, prompts, dbs, links, undefined, t);
  }

  function exportData() {
    const data = { repos, sites, prompts, dbs, links, exportedAt: new Date().toISOString() };
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
        const nd = data.dbs || dbs;
        const nl = data.links || links;
        setRepos(nr); setSites(ns); setPrompts(np); setDbs(nd); setLinks(nl);
        persist(nr, ns, np, nd, nl);
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
        <div className="tagline">repos · sites · databases · prompts</div>
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
              const hasLinks = isLinked("repo", r.id);
              const canLink = linkingMode && linkingMode.type !== "repo";
              const linkLabel = hasLinks ? "⇄" : canLink ? "← link" : "⇄";
              return (
                <a key={r.id} href={r.url} target="_blank" rel="noopener noreferrer"
                  className={`item ${highlightedIds.includes(r.id) ? "linked-highlight" : ""}`}
                  onClick={(e) => { e.preventDefault(); bumpRepo(r.id); window.open(r.url, "_blank"); }}
                  onMouseEnter={() => highlightLinked("repo", r.id)}
                  onMouseLeave={() => setHighlightedIds([])}>
                  <FaviconImg domain={r.domain} type="repo" name={r.name} />
                  <div className="item-info">
                    {renamingId === r.id ? (
                      <input className="rename-input" autoFocus value={renameValue}
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") commitRename("repo"); if (e.key === "Escape") setRenamingId(null); }}
                        onBlur={() => commitRename("repo")} />
                    ) : (
                      <div className="item-name">
                        {r.name}{hasLinks && <span className="link-indicator"> ⇄</span>}
                      </div>
                    )}
                    <div className="item-url">{r.domain}</div>
                  </div>
                  {st && <div className={`status-dot ${st.status}`} title={st.label} />}
                  <div className="item-actions">
                    <button className="item-btn rename-btn" title="Rename"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); startRename(r.id, r.name); }}>✎</button>
                    <button className="item-btn" title={hasLinks ? "Unlink" : "Link"}
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
              const hasLinks = isLinked("site", s.id);
              const canLink = linkingMode && linkingMode.type !== "site";
              const linkLabel = hasLinks ? "⇄" : canLink ? "← link" : "⇄";
              return (
                <a key={s.id} href={s.url} target="_blank" rel="noopener noreferrer"
                  className={`item ${highlightedIds.includes(s.id) ? "linked-highlight" : ""}`}
                  onClick={(e) => { e.preventDefault(); bumpSite(s.id); window.open(s.url, "_blank"); }}
                  onMouseEnter={() => highlightLinked("site", s.id)}
                  onMouseLeave={() => setHighlightedIds([])}>
                  <FaviconImg domain={s.domain} type="site" name={s.name} />
                  <div className="item-info">
                    {renamingId === s.id ? (
                      <input className="rename-input" autoFocus value={renameValue}
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") commitRename("site"); if (e.key === "Escape") setRenamingId(null); }}
                        onBlur={() => commitRename("site")} />
                    ) : (
                      <div className="item-name">
                        {s.name}{hasLinks && <span className="link-indicator"> ⇄</span>}
                      </div>
                    )}
                    <div className="item-url">{s.domain}</div>
                  </div>
                  <div className="item-actions">
                    <button className="item-btn rename-btn" title="Rename"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); startRename(s.id, s.name); }}>✎</button>
                    <button className="item-btn" title={hasLinks ? "Unlink" : "Link"}
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

        {/* Databases */}
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">Databases</span>
            <span className="panel-count">{dbs.length}</span>
          </div>
          <div className="panel-body">
            {!dbs.length ? (
              <div className="empty">Paste a database URL below<br />to get started</div>
            ) : dbs.map((d) => {
              const hasLinks = isLinked("db", d.id);
              const canLink = linkingMode && linkingMode.type !== "db";
              const linkLabel = hasLinks ? "⇄" : canLink ? "← link" : "⇄";
              return (
                <a key={d.id} href={d.url} target="_blank" rel="noopener noreferrer"
                  className={`item ${highlightedIds.includes(d.id) ? "linked-highlight" : ""}`}
                  onClick={(e) => { e.preventDefault(); window.open(d.url, "_blank"); }}
                  onMouseEnter={() => highlightLinked("db", d.id)}
                  onMouseLeave={() => setHighlightedIds([])}>
                  <FaviconImg domain={d.domain} type="site" name={d.name} />
                  <div className="item-info">
                    {renamingId === d.id ? (
                      <input className="rename-input" autoFocus value={renameValue}
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") commitRename("db"); if (e.key === "Escape") setRenamingId(null); }}
                        onBlur={() => commitRename("db")} />
                    ) : (
                      <div className="item-name">
                        {d.name}{hasLinks && <span className="link-indicator"> ⇄</span>}
                      </div>
                    )}
                    <div className="item-url">{d.domain}</div>
                  </div>
                  <div className="item-actions">
                    <button className="item-btn rename-btn" title="Rename"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); startRename(d.id, d.name); }}>✎</button>
                    <button className="item-btn" title={hasLinks ? "Unlink" : "Link"}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); startLink("db", d.id); }}>{linkLabel}</button>
                    <button className="item-btn" title="Remove"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeDb(d.id); }}>✕</button>
                  </div>
                </a>
              );
            })}
          </div>
          <AddBar placeholder="Paste database URL and press Enter" onSubmit={addDb} />
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
            ) : [...prompts].sort((a, b) => (copyCounts[b.id] || 0) - (copyCounts[a.id] || 0)).map((p) => (
              <div key={p.id} className="prompt-item" onClick={() => copyPrompt(p.id)}>
                <div className="prompt-top">
                  <span className="prompt-name">
                    {copiedId === p.id ? <span className="copy-toast">Copied!</span> : p.name}
                  </span>
                  <div className="prompt-actions">
                    {copyCounts[p.id] > 0 && <span className="copy-counter">{copyEmojis[p.id]} {copyCounts[p.id]}</span>}
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
