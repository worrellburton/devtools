export interface Repo {
  id: string;
  url: string;
  name: string;
  domain: string;
}

export interface Site {
  id: string;
  url: string;
  name: string;
  domain: string;
}

export interface Prompt {
  id: string;
  name: string;
  text: string;
}

export interface Link {
  repoId: string;
  siteId: string;
}

export interface ActionStatus {
  status: 'success' | 'failure' | 'pending' | 'neutral' | 'error' | 'none';
  label: string;
}

export interface LangInfo {
  name: string;
  pct: number;
}
