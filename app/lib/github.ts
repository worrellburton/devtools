import { extractGhRepo } from './helpers';
import type { ActionStatus, LangInfo, Repo } from './types';

function headers(token: string) {
  return { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' };
}

export async function fetchActionStatus(repo: Repo, token: string): Promise<ActionStatus> {
  const ghRepo = extractGhRepo(repo.url);
  if (!ghRepo || !token) {
    return { status: 'none', label: 'Not a GitHub repo' };
  }
  try {
    const res = await fetch(`https://api.github.com/repos/${ghRepo}/actions/runs?per_page=1`, {
      headers: headers(token),
    });
    if (res.status === 404) return { status: 'neutral', label: 'No actions configured' };
    if (res.status === 403) return { status: 'error', label: 'Access denied (403) — Your token lacks permission for this repo. Go to GitHub → Settings → Developer settings → Personal access tokens and add repo scope, or generate a new token with access to this org.' };
    if (res.status === 401) return { status: 'error', label: 'Auth failed (401) — Token is invalid or expired. Go to GitHub → Settings → Developer settings → Personal access tokens to generate a new one.' };
    if (!res.ok) return { status: 'error', label: `API error (${res.status}) — Check your token permissions at GitHub → Settings → Developer settings → Personal access tokens.` };

    const data = await res.json();
    if (!data.workflow_runs || data.workflow_runs.length === 0) {
      return { status: 'neutral', label: 'No workflow runs' };
    }
    const run = data.workflow_runs[0];
    const conclusion = run.conclusion;
    const status = run.status;
    if (status === 'in_progress' || status === 'queued' || status === 'waiting') {
      return { status: 'pending', label: `${run.name}: ${status}` };
    } else if (conclusion === 'success') {
      return { status: 'success', label: `${run.name}: passed` };
    } else if (conclusion === 'failure') {
      return { status: 'failure', label: `${run.name}: failed` };
    } else {
      return { status: 'neutral', label: `${run.name}: ${conclusion || status}` };
    }
  } catch {
    return { status: 'error', label: 'Network error — Could not reach GitHub API. Check your internet connection and try again.' };
  }
}

export async function fetchRepoLanguages(repo: Repo, token: string): Promise<LangInfo[]> {
  const ghRepo = extractGhRepo(repo.url);
  if (!ghRepo || !token) return [];
  try {
    const res = await fetch(`https://api.github.com/repos/${ghRepo}/languages`, {
      headers: headers(token),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const sorted = Object.entries(data).sort((a: any, b: any) => b[1] - a[1]);
    const total = sorted.reduce((s, e: any) => s + e[1], 0);
    return sorted.map(([lang, bytes]: any) => ({
      name: lang,
      pct: Math.round((bytes / total) * 100),
    }));
  } catch {
    return [];
  }
}

export async function fetchMostActiveBranch(ghRepo: string, token: string): Promise<string | null> {
  if (!token) return null;
  try {
    const evRes = await fetch(`https://api.github.com/repos/${ghRepo}/events?per_page=30`, {
      headers: headers(token),
    });
    if (evRes.ok) {
      const events = await evRes.json();
      for (const ev of events) {
        if (ev.type === 'PushEvent' && ev.payload?.ref) {
          return ev.payload.ref.replace('refs/heads/', '');
        }
      }
    }
    const wfRes = await fetch(`https://api.github.com/repos/${ghRepo}/actions/runs?per_page=5`, {
      headers: headers(token),
    });
    if (wfRes.ok) {
      const wfData = await wfRes.json();
      if (wfData.workflow_runs?.length) {
        return wfData.workflow_runs[0].head_branch;
      }
    }
    return null;
  } catch {
    return null;
  }
}
