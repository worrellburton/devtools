import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  getDatabase,
  ref,
  set,
  onValue,
  type Database,
  type DatabaseReference,
} from "firebase/database";

// ---- PASTE YOUR FIREBASE CONFIG HERE ----
const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  databaseURL: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
};

let app: FirebaseApp | null = null;
let db: Database | null = null;

function isConfigured(): boolean {
  return !!firebaseConfig.databaseURL;
}

function ensureInit() {
  if (!isConfigured()) return;
  if (!app) {
    app = initializeApp(firebaseConfig);
    db = getDatabase(app);
  }
}

/** Simple hash of the password to use as the Firebase path key */
function hashKey(password: string): string {
  let h = 0;
  for (let i = 0; i < password.length; i++) {
    h = ((h << 5) - h + password.charCodeAt(i)) | 0;
  }
  return "u" + Math.abs(h).toString(36);
}

export type DevtoolsData = {
  repos: Repo[];
  sites: Site[];
  prompts: Prompt[];
  links: Link[];
  ghToken: string;
  theme: "light" | "dark";
  updatedAt?: number;
};

export type Repo = {
  id: string;
  url: string;
  name: string;
  domain: string;
};

export type Site = {
  id: string;
  url: string;
  name: string;
  domain: string;
};

export type Prompt = {
  id: string;
  name: string;
  text: string;
};

export type Link = {
  repoId: string;
  siteId: string;
};

const defaultData: DevtoolsData = {
  repos: [],
  sites: [],
  prompts: [],
  links: [],
  ghToken: "",
  theme: "light",
};

let currentRef: DatabaseReference | null = null;
let unsubscribe: (() => void) | null = null;

/** Connect to Firebase using the password as the data key. Returns initial data via callback. */
export function connect(
  password: string,
  onData: (data: DevtoolsData) => void
): void {
  ensureInit();
  if (!db) return;

  // Disconnect previous listener
  if (unsubscribe) unsubscribe();

  const key = hashKey(password);
  currentRef = ref(db, `devtools/${key}`);

  const unsub = onValue(currentRef, (snapshot) => {
    const val = snapshot.val();
    onData(val ? { ...defaultData, ...val } : { ...defaultData });
  });

  unsubscribe = () => unsub();
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

/** Push data to Firebase (debounced) */
export function save(data: DevtoolsData): void {
  if (!currentRef) return;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    set(currentRef!, { ...data, updatedAt: Date.now() }).catch(() => {});
  }, 800);
}

/** Force-push immediately (e.g. on first connect) */
export function saveNow(data: DevtoolsData): void {
  if (!currentRef) return;
  set(currentRef, { ...data, updatedAt: Date.now() }).catch(() => {});
}

export { isConfigured };
