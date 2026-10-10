import type { DirectedClipItem, MasterContinuityLock } from '../types';

const PROJECTS_KEY = 'sala_saved_projects';
const OPEN_ID_KEY = 'sala_open_project_id';

export interface SavedProjectCharacter {
  id: string;
  name: string;
}

export interface SavedProjectLocation {
  id?: string;
  name: string;
}

export interface SavedProject {
  id: string;
  name: string;
  savedAt: string;
  scriptText: string;
  originalStory: string;
  continuityLock: MasterContinuityLock | null;
  selectedCharacterIds: string[];
  clips: DirectedClipItem[];
  characters: SavedProjectCharacter[];
  locations: SavedProjectLocation[];
}

export interface SaveCurrentProjectInput {
  scriptText: string;
  originalStory: string;
  continuityLock: MasterContinuityLock | null;
  selectedCharacterIds: string[];
  clips: DirectedClipItem[];
  characters?: SavedProjectCharacter[];
  locations?: SavedProjectLocation[];
}

function storage(): Storage | null {
  try {
    const store = (globalThis as { localStorage?: Storage }).localStorage;
    if (!store || typeof store.getItem !== 'function' || typeof store.setItem !== 'function') return null;
    return store;
  } catch {
    return null;
  }
}

function readProjects(): SavedProject[] {
  const store = storage();
  if (!store) return [];
  try {
    const raw = store.getItem(PROJECTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && typeof item.id === 'string') as SavedProject[];
  } catch {
    return [];
  }
}

function writeProjects(projects: SavedProject[]): boolean {
  const store = storage();
  if (!store) return false;
  try {
    store.setItem(PROJECTS_KEY, JSON.stringify(projects));
    return true;
  } catch {
    return false;
  }
}

function newId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    // fall through
  }
  return `proj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function firstLine(text: string): string {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0) || '';
}

function projectName(scriptText: string, originalStory: string): string {
  const line = firstLine(scriptText) || firstLine(originalStory);
  if (!line) {
    const time = new Date().toLocaleString('th-TH', { hour12: false });
    return `โปรเจกต์ ${time}`;
  }
  return line.length > 60 ? line.slice(0, 60).trim() : line;
}

function snapshotCharacters(
  characters: SavedProjectCharacter[] | undefined,
  selectedIds: string[]
): SavedProjectCharacter[] {
  const list = Array.isArray(characters) ? characters : [];
  const out: SavedProjectCharacter[] = [];
  for (const id of selectedIds) {
    const found = list.find((character) => character && character.id === id);
    if (!found) continue;
    out.push({ id: found.id, name: String(found.name || '') });
  }
  return out;
}

function collectLocations(
  lock: MasterContinuityLock | null,
  clips: DirectedClipItem[],
  library: SavedProjectLocation[] | undefined
): SavedProjectLocation[] {
  const items: SavedProjectLocation[] = [];

  const add = (id?: string, name?: string) => {
    const cleanId = String(id || '').trim();
    let cleanName = String(name || '').trim();
    if (!cleanName && cleanId && Array.isArray(library)) {
      const found = library.find((location) => location && location.id === cleanId);
      if (found && found.name) cleanName = String(found.name).trim();
    }
    if (!cleanId && !cleanName) return;

    const existing = items.find((item) =>
      (cleanId && item.id === cleanId) || (cleanName && item.name === cleanName)
    );
    if (existing) {
      if (!existing.id && cleanId) existing.id = cleanId;
      if ((!existing.name || existing.name === existing.id) && cleanName) existing.name = cleanName;
      return;
    }

    const entry: SavedProjectLocation = { name: cleanName || cleanId };
    if (cleanId) entry.id = cleanId;
    items.push(entry);
  };

  if (lock) {
    add(lock.locationId, lock.location);
  }
  for (const clip of clips) {
    if (!clip) continue;
    add(clip.locationId, clip.locationName);
  }
  return items;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function listSavedProjects(): SavedProject[] {
  return readProjects().sort((a, b) => String(b.savedAt || '').localeCompare(String(a.savedAt || '')));
}

export function saveCurrentProject(input: SaveCurrentProjectInput): SavedProject | null {
  const store = storage();
  if (!store) return null;

  const scriptText = String(input?.scriptText ?? '');
  const originalStory = String(input?.originalStory ?? '');
  const clips = Array.isArray(input?.clips) ? input.clips : [];
  if (!scriptText.trim() && !originalStory.trim() && clips.length === 0) return null;

  const selectedCharacterIds = Array.isArray(input?.selectedCharacterIds)
    ? input.selectedCharacterIds.filter((id) => typeof id === 'string')
    : [];

  const projects = readProjects();
  let openId = '';
  try {
    openId = store.getItem(OPEN_ID_KEY) || '';
  } catch {
    openId = '';
  }

  const existingIndex = openId ? projects.findIndex((project) => project.id === openId) : -1;
  const now = new Date().toISOString();
  const record: SavedProject = {
    id: existingIndex >= 0 ? projects[existingIndex].id : newId(),
    name: existingIndex >= 0 ? projects[existingIndex].name : projectName(scriptText, originalStory),
    savedAt: now,
    scriptText,
    originalStory,
    continuityLock: input?.continuityLock ? cloneJson(input.continuityLock) : null,
    selectedCharacterIds: [...selectedCharacterIds],
    clips: cloneJson(clips),
    characters: snapshotCharacters(input?.characters, selectedCharacterIds),
    locations: collectLocations(input?.continuityLock ?? null, clips, input?.locations)
  };

  if (existingIndex >= 0) {
    projects[existingIndex] = record;
  } else {
    projects.push(record);
  }

  if (!writeProjects(projects)) return null;
  try {
    store.setItem(OPEN_ID_KEY, record.id);
  } catch {
    return null;
  }
  return record;
}

export function openSavedProject(id: string): SavedProject | null {
  const store = storage();
  if (!store) return null;
  const project = readProjects().find((item) => item.id === id);
  if (!project) return null;

  try {
    store.setItem('sala_current_director_script', project.scriptText || '');
    store.setItem('sala_story', project.originalStory || '');
    store.setItem('sala_master_continuity_lock', JSON.stringify(project.continuityLock ?? {}));
    store.setItem('sala_selected_character_ids', JSON.stringify(project.selectedCharacterIds || []));
    if (Array.isArray(project.clips) && project.clips.length > 0) {
      store.setItem('sala_director_clips', JSON.stringify(project.clips));
    } else if (typeof store.removeItem === 'function') {
      store.removeItem('sala_director_clips');
    }
    store.setItem(OPEN_ID_KEY, project.id);
  } catch {
    return null;
  }
  return project;
}

export function deleteSavedProject(id: string): boolean {
  const store = storage();
  if (!store) return false;
  const projects = readProjects();
  const next = projects.filter((project) => project.id !== id);
  if (next.length === projects.length) return false;
  if (!writeProjects(next)) return false;
  try {
    if (store.getItem(OPEN_ID_KEY) === id && typeof store.removeItem === 'function') {
      store.removeItem(OPEN_ID_KEY);
    }
  } catch {
    return false;
  }
  return true;
}
