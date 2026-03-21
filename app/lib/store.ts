import { useState, useCallback, useEffect, useRef } from 'react';
import type { Repo, Site, Prompt, Link, ActionStatus, LangInfo } from './types';
import { uid, extractName, extractDomain, extractGhRepo } from './helpers';
import { fetchActionStatus, fetchRepoLanguages, fetchMostActiveBranch } from './github';
import { SETUP_PROMPT_TEMPLATE, ENABLE_ACTIONS_TEMPLATE } from './prompts';

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function useStore() {
  const [repos, setRepos] = useState<Repo[]>(() => load('dt_repos', []));
  const [sites, setSites] = useState<Site[]>(() => load('dt_sites', []));
  const [prompts, setPrompts] = useState<Prompt[]>(() => load('dt_prompts', []));
  const [links, setLinks] = useState<Link[]>(() => load('dt_links', []));
  const [ghToken, setGhToken] = useState(() => localStorage.getItem('dt_gh_token') || '');
  const [actionStatuses, setActionStatuses] = useState<Record<string, ActionStatus>>({});
  const [repoLanguages, setRepoLanguages] = useState<Record<string, LangInfo[]>>({});
  const [linkingMode, setLinkingMode] = useState<{ type: 'repo' | 'site'; id: string } | null>(null);
  const [theme, setTheme] = useState(() => localStorage.getItem('dt_theme') || 'dark');

  // Persist on change
  useEffect(() => { localStorage.setItem('dt_repos', JSON.stringify(repos)); }, [repos]);
  useEffect(() => { localStorage.setItem('dt_sites', JSON.stringify(sites)); }, [sites]);
  useEffect(() => { localStorage.setItem('dt_prompts', JSON.stringify(prompts)); }, [prompts]);
  useEffect(() => { localStorage.setItem('dt_links', JSON.stringify(links)); }, [links]);

  // Theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('dt_theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(t => t === 'dark' ? 'light' : 'dark');
  }, []);

  // Repos
  const addRepo = useCallback((url: string) => {
    url = url.trim();
    if (!url) return;
    if (!url.startsWith('http')) url = 'https://' + url;
    const repo: Repo = { id: uid(), url, name: extractName(url), domain: extractDomain(url) };
    setRepos(prev => [...prev, repo]);
    if (ghToken) {
      Promise.all([fetchActionStatus(repo, ghToken), fetchRepoLanguages(repo, ghToken)]).then(([status, langs]) => {
        setActionStatuses(prev => ({ ...prev, [repo.id]: status }));
        setRepoLanguages(prev => ({ ...prev, [repo.id]: langs }));
      });
    }
  }, [ghToken]);

  const removeRepo = useCallback((id: string) => {
    setRepos(prev => prev.filter(r => r.id !== id));
    setLinks(prev => prev.filter(l => l.repoId !== id));
  }, []);

  // Sites
  const addSite = useCallback((url: string) => {
    url = url.trim();
    if (!url) return;
    if (!url.startsWith('http')) url = 'https://' + url;
    setSites(prev => [...prev, { id: uid(), url, name: extractName(url), domain: extractDomain(url) }]);
  }, []);

  const removeSite = useCallback((id: string) => {
    setSites(prev => prev.filter(s => s.id !== id));
    setLinks(prev => prev.filter(l => l.siteId !== id));
  }, []);

  const bumpSite = useCallback((id: string) => {
    setSites(prev => {
      const idx = prev.findIndex(s => s.id === id);
      if (idx <= 0) return prev;
      const next = [...prev];
      const [site] = next.splice(idx, 1);
      next.unshift(site);
      return next;
    });
  }, []);

  // Prompts
  const addPrompt = useCallback((name: string, text: string) => {
    setPrompts(prev => [...prev, { id: uid(), name, text }]);
  }, []);

  const updatePrompt = useCallback((id: string, name: string, text: string) => {
    setPrompts(prev => prev.map(p => p.id === id ? { ...p, name, text } : p));
  }, []);

  const removePrompt = useCallback((id: string) => {
    setPrompts(prev => prev.filter(p => p.id !== id));
  }, []);

  // Ensure built-in prompts
  const ensuredRef = useRef(false);
  useEffect(() => {
    if (ensuredRef.current) return;
    ensuredRef.current = true;
    setPrompts(prev => {
      let next = [...prev];
      let changed = false;
      if (!next.find(p => p.name === 'Repo Setup')) {
        next.push({ id: uid(), name: 'Repo Setup', text: SETUP_PROMPT_TEMPLATE });
        changed = true;
      }
      if (!next.find(p => p.name === 'Enable Actions')) {
        next.push({ id: uid(), name: 'Enable Actions', text: ENABLE_ACTIONS_TEMPLATE });
        changed = true;
      }
      return changed ? next : prev;
    });
  }, []);

  // Links
  const getLinkedSite = useCallback((repoId: string) => {
    const l = links.find(x => x.repoId === repoId);
    return l?.siteId ?? null;
  }, [links]);

  const getLinkedRepo = useCallback((siteId: string) => {
    const l = links.find(x => x.siteId === siteId);
    return l?.repoId ?? null;
  }, [links]);

  const startLink = useCallback((type: 'repo' | 'site', id: string) => {
    // If already linked, unlink
    const key = type + 'Id' as 'repoId' | 'siteId';
    const existing = links.find(l => l[key] === id);
    if (existing) {
      setLinks(prev => prev.filter(l => l !== existing));
      setLinkingMode(null);
      return;
    }
    if (linkingMode && linkingMode.type !== type) {
      const link: any = {};
      link[linkingMode.type + 'Id'] = linkingMode.id;
      link[type + 'Id'] = id;
      setLinks(prev => {
        const filtered = prev.filter(l => l.repoId !== link.repoId && l.siteId !== link.siteId);
        return [...filtered, link];
      });
      setLinkingMode(null);
    } else {
      setLinkingMode({ type, id });
    }
  }, [links, linkingMode]);

  // GitHub token
  const saveToken = useCallback((token: string) => {
    setGhToken(token);
    localStorage.setItem('dt_gh_token', token);
  }, []);

  const disconnectGitHub = useCallback(() => {
    setGhToken('');
    localStorage.removeItem('dt_gh_token');
    setActionStatuses({});
    setRepoLanguages({});
  }, []);

  // Refresh all statuses
  const refreshAllStatuses = useCallback(async () => {
    if (!ghToken) return;
    const results = await Promise.all(
      repos.map(async r => {
        const [status, langs] = await Promise.all([
          fetchActionStatus(r, ghToken),
          fetchRepoLanguages(r, ghToken),
        ]);
        return { id: r.id, status, langs };
      })
    );
    const statuses: Record<string, ActionStatus> = {};
    const languages: Record<string, LangInfo[]> = {};
    for (const r of results) {
      statuses[r.id] = r.status;
      languages[r.id] = r.langs;
    }
    setActionStatuses(statuses);
    setRepoLanguages(languages);
  }, [ghToken, repos]);

  // Setup repo prompt
  const setupRepo = useCallback(async (repoId: string) => {
    const repo = repos.find(r => r.id === repoId);
    if (!repo) return;
    const ghRepo = extractGhRepo(repo.url);
    if (!ghRepo || !ghToken) return null;

    const branch = await fetchMostActiveBranch(ghRepo, ghToken);
    const branchName = branch || 'main';
    const prompt = SETUP_PROMPT_TEMPLATE.replace(/\(branch\)/g, branchName);
    await navigator.clipboard.writeText(prompt);
    return branchName;
  }, [repos, ghToken]);

  // Enable actions prompt
  const enableActionsRepo = useCallback(async (repoId: string) => {
    const repo = repos.find(r => r.id === repoId);
    if (!repo) return null;
    const ghRepo = extractGhRepo(repo.url);
    if (!ghRepo || !ghToken) return null;

    const branch = await fetchMostActiveBranch(ghRepo, ghToken);
    const branchName = branch || 'main';
    const prompt = ENABLE_ACTIONS_TEMPLATE
      .replace(/\(repo\)/g, ghRepo)
      .replace(/\(branch\)/g, branchName);
    await navigator.clipboard.writeText(prompt);
    return branchName;
  }, [repos, ghToken]);

  return {
    repos, sites, prompts, links, ghToken, actionStatuses, repoLanguages,
    linkingMode, theme,
    addRepo, removeRepo, addSite, removeSite, bumpSite,
    addPrompt, updatePrompt, removePrompt,
    getLinkedSite, getLinkedRepo, startLink, setLinkingMode,
    saveToken, disconnectGitHub, refreshAllStatuses,
    setupRepo, enableActionsRepo, toggleTheme,
  };
}
