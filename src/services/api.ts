import {
  Character,
  LocationItem,
  CostEstimate,
  CreditAccount,
  GenerationJob,
  Project,
  ProviderInfo,
  AdminStats,
  MediaType,
  AspectRatio,
  ProviderId
} from '../types';
import {
  checkAndSyncCharacters,
  saveCharacterToFirestore,
  deleteCharacterFromFirestore,
  getLocalStorageCharacters,
  saveCharactersToLocalStorage,
  DEFAULT_SAMPLE_CHARACTERS,
  getActiveUid
} from './characterService';
import {
  checkAndSyncLocations,
  saveLocationToFirestore,
  deleteLocationFromFirestore,
  getLocalStorageLocations,
  saveLocationsToLocalStorage,
  DEFAULT_SAMPLE_LOCATIONS,
  uploadLocationReferenceImage,
  normalizeLocationPersistence
} from './locationService';
import { auth, getApiKey } from './auth';

/**
 * Resolves the user's saved Gemini key (Firestore / local cache). Returns '' when none,
 * in which case the server falls back to its own GEMINI_API_KEY. Never logged.
 */
async function resolveUserGeminiKey(explicit?: string): Promise<string> {
  if (explicit && explicit.trim()) return explicit.trim();
  try {
    return (await getApiKey('gemini')) || '';
  } catch {
    return '';
  }
}

/** Reads a JSON error body and builds a readable Error (Thai + English from the server). */
/** Throws a clear error when an /api call returned HTML (e.g. index.html: the API server is not running in this preview) */
function assertJsonResponse(res: Response, endpoint: string): void {
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const err = new Error(`เซิร์ฟเวอร์ API ไม่ตอบกลับเป็น JSON (ได้ ${contentType || 'ไม่ระบุชนิด'} / HTTP ${res.status}) จาก ${endpoint} — เซิร์ฟเวอร์ (server.ts) อาจไม่ได้ทำงานในหน้าพรีวิวนี้ ลองเลือก "โหมดออฟไลน์" / API server returned non-JSON (${contentType || 'unknown'}, HTTP ${res.status}) from ${endpoint}: the API server is probably not running in this preview. Try offline mode.`);
    (err as any).code = 'API_NOT_JSON';
    (err as any).status = res.status;
    throw err;
  }
}

async function readApiError(res: Response, fallback: string): Promise<Error> {
  let message = '';
  let code = '';
  try {
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = await res.json();
      message = body?.message || '';
      code = body?.code || '';
    } else {
      message = `${fallback}: เกิดข้อผิดพลาดจากเซิร์ฟเวอร์ (HTTP ${res.status})`;
    }
  } catch {
    // non-JSON body
  }
  const err = new Error(message || `${fallback} (HTTP ${res.status})`);
  (err as any).code = code;
  (err as any).status = res.status;
  return err;
}

export interface GenerateRequestPayload {
  type: MediaType;
  provider: ProviderId;
  model: string;
  prompt: string;
  negativePrompt?: string;
  aspectRatio: AspectRatio;
  resolution?: string;
  referenceImages?: string[];
  characterId?: string;
  characterName?: string;
  projectId?: string;
  sceneId?: string;
  sceneNumber?: number;
  durationSeconds?: number;
  seed?: number;
  consistencyStrength?: number;
}

function isTokenUnexpired(token: string): boolean {
  if (!token) return false;
  if (token.startsWith('sala.')) {
    const parts = token.split('.');
    if (parts.length !== 5) return false;
    const exp = Number(parts[2]);
    return Number.isFinite(exp) && exp > Math.floor(Date.now() / 1000);
  }
  const parts = token.split('.');
  if (parts.length === 3) {
    try {
      const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(atob(b64));
      if (typeof payload.exp === 'number') {
        return payload.exp > Math.floor(Date.now() / 1000);
      }
    } catch {
      return false;
    }
  }
  return false;
}

export function getAuthToken(): string {
  if (typeof window === 'undefined') return '';
  const idToken = (localStorage.getItem('sala_auth_id_token') || '').trim();
  const authToken = (localStorage.getItem('sala_auth_token') || '').trim();

  // Prefer valid, unexpired token
  if (idToken && isTokenUnexpired(idToken)) return idToken;
  if (authToken && isTokenUnexpired(authToken)) return authToken;

  // Fallback to non-empty if neither could be validated
  return idToken || authToken || '';
}

export async function getFreshAuthToken(): Promise<string> {
  if (typeof window === 'undefined') return '';
  if (auth.currentUser) {
    try {
      const refreshed = await auth.currentUser.getIdToken(false);
      if (refreshed) {
        localStorage.setItem('sala_auth_id_token', refreshed);
        localStorage.setItem('sala_auth_token', refreshed);
        return refreshed;
      }
    } catch {}
  }
  return getAuthToken();
}

export function getAuthHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
  const token = getAuthToken();
  const headers: Record<string, string> = { ...extraHeaders };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export const api = {
  async getProviders(): Promise<{ providers: ProviderInfo[]; serverEnvKeys: any }> {
    const res = await fetch('/api/providers', { headers: getAuthHeaders() });
    const data = await res.json();
    return data;
  },

  async estimateCost(payload: Partial<GenerateRequestPayload> & { type: MediaType; provider: ProviderId }): Promise<CostEstimate> {
    const res = await fetch('/api/estimate-cost', {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    return data.estimate;
  },

  async startGeneration(payload: GenerateRequestPayload): Promise<{ jobId: string; job: GenerationJob; remainingCredits: number }> {
    await getFreshAuthToken();
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'ไม่สามารถเริ่มการสร้างได้');
    }
    return data;
  },

  async getJob(id: string): Promise<GenerationJob> {
    const res = await fetch(`/api/jobs/${id}`, { headers: getAuthHeaders() });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'ไม่พบงาน');
    }
    return data.job;
  },

  async getAllJobs(): Promise<GenerationJob[]> {
    const res = await fetch('/api/jobs', { headers: getAuthHeaders() });
    const data = await res.json();
    return data.jobs || [];
  },

  async getCharacters(): Promise<Character[]> {
    const currentUid = getActiveUid();
    if (!currentUid) {
      return [];
    }

    try {
      const syncResult = await checkAndSyncCharacters(currentUid);
      if (syncResult.characters) {
        return syncResult.characters.filter(c => c.userId === currentUid);
      }
    } catch (e) {
      console.warn('Firestore sync character error, falling back to server/local:', e);
    }

    try {
      const res = await fetch('/api/characters', { headers: getAuthHeaders() });
      const data = await res.json();
      if (data.characters) {
        return data.characters.filter((c: Character) => c.userId === currentUid);
      }
    } catch (e) {
      console.warn('Server characters fetch error:', e);
    }

    const local = getLocalStorageCharacters(currentUid);
    return local.filter(c => c.userId === currentUid);
  },

  async createCharacter(character: Partial<Character>): Promise<Character> {
    const currentUid = getActiveUid() || character.userId || (auth.currentUser?.uid) || 'guest_user';
    const charPayload: Partial<Character> = {
      ...character,
      userId: currentUid
    };

    let createdChar: Character | null = null;
    try {
      const freshToken = await getFreshAuthToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (freshToken) {
        headers['Authorization'] = `Bearer ${freshToken}`;
      } else {
        const storedToken = getAuthToken();
        if (storedToken) headers['Authorization'] = `Bearer ${storedToken}`;
      }

      const res = await fetch('/api/characters', {
        method: 'POST',
        headers,
        body: JSON.stringify(charPayload)
      });
      const data = await res.json();
      if (res.ok && data.success && data.character) {
        createdChar = { ...data.character, userId: currentUid || data.character.userId };
      }
    } catch (e) {
      console.warn('Could not save character to server API, fallback to direct Firestore:', e);
    }

    if (!createdChar) {
      createdChar = {
        id: character.id || `char_${Date.now()}`,
        userId: currentUid,
        name: character.name || 'ตัวละครใหม่',
        gender: character.gender || 'ไม่ระบุ',
        age: character.age || 'ไม่ระบุ',
        description: character.description || '',
        triggerTag: character.triggerTag || `(${character.name?.replace(/\s+/g, '_').toLowerCase()}:1.2)`,
        avatarUrl: character.avatarUrl || character.referenceImageUrl || character.referenceImages?.[0] || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
        referenceImages: character.referenceImages || [],
        referenceImageId: character.referenceImageId || character.referenceMetadata?.referenceImageId || `ref_${Date.now()}`,
        referenceImageUrl: character.referenceImageUrl || character.visualProfile?.referenceImageUrl || character.avatarUrl || '',
        imageHash: character.imageHash || character.currentReferenceImageHash || '',
        outfitDescription: character.outfitDescription || '',
        consistencyStrength: character.consistencyStrength || 0.85,
        structuredFeatures: character.structuredFeatures,
        analysisConfidence: character.analysisConfidence,
        isVerifiedByUser: character.isVerifiedByUser ?? true,
        identity: character.identity || {
          id: character.id || `char_${Date.now()}`,
          name: character.name || 'ตัวละครใหม่'
        },
        characterIdentity: character.characterIdentity || character.identity || {
          id: character.id || `char_${Date.now()}`,
          name: character.name || 'ตัวละครใหม่'
        },
        referenceMetadata: character.referenceMetadata,
        visualProfile: character.visualProfile,
        storyProfile: character.storyProfile,
        fieldSources: character.fieldSources,
        imageAnalysisStatus: character.imageAnalysisStatus,
        lockStatus: character.lockStatus,
        currentReferenceImageHash: character.currentReferenceImageHash,
        visualProfileImageHash: character.visualProfileImageHash,
        createdAt: new Date().toISOString()
      };
    } else {
      createdChar.userId = currentUid;
    }

    // บันทึกลง Firestore ถาวร โดยอัด UID
    try {
      await saveCharacterToFirestore(createdChar, currentUid);
    } catch (err) {
      console.warn('Failed to save to Firestore directly:', err);
    }

    // แคชลง LocalStorage สำรองของ UID นี้
    if (currentUid) {
      const currentLocal = getLocalStorageCharacters(currentUid);
      const updatedLocal = [createdChar, ...currentLocal.filter(c => c.id !== createdChar!.id)];
      saveCharactersToLocalStorage(updatedLocal, currentUid);
    }

    return createdChar;
  },

  async deleteCharacter(id: string): Promise<void> {
    const currentUid = getActiveUid();
    try {
      await fetch(`/api/characters/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
    } catch (e) {
      console.warn('Server delete error:', e);
    }

    // ลบออกจาก Firestore
    try {
      await deleteCharacterFromFirestore(id, currentUid || undefined);
    } catch (e) {
      console.warn('Firestore delete error:', e);
    }

    // ลบออกจาก LocalStorage ของ user นี้
    if (currentUid) {
      const currentLocal = getLocalStorageCharacters(currentUid);
      saveCharactersToLocalStorage(currentLocal.filter(c => c.id !== id), currentUid);
    }
  },

  // ==========================================
  // LOCATION LOCK & LOCATION API METHODS
  // ==========================================
  async getLocations(): Promise<LocationItem[]> {
    const currentUid = getActiveUid() || 'guest_user';

    try {
      if (currentUid !== 'guest_user') {
        await checkAndSyncLocations(currentUid);
      }
      const local = getLocalStorageLocations(currentUid);
      if (local && local.length > 0) {
        return local;
      }
    } catch (e) {
      console.warn('Firestore sync location error, falling back to server/local:', e);
    }

    try {
      const res = await fetch('/api/locations', { headers: getAuthHeaders() });
      const data = await res.json();
      if (data.locations && data.locations.length > 0) {
        const filtered = data.locations.filter((l: LocationItem) => !l.userId || l.userId === currentUid);
        if (filtered.length > 0) {
          saveLocationsToLocalStorage(filtered, currentUid);
          return filtered;
        }
      }
    } catch (e) {
      console.warn('Server locations fetch error:', e);
    }

    const local = getLocalStorageLocations(currentUid);
    if (local && local.length > 0) {
      return local;
    }

    // Default sample locations with lockStatus: 'LOCKED' seeded into localStorage
    const seeded = DEFAULT_SAMPLE_LOCATIONS.map(l => ({
      ...l,
      lockStatus: 'LOCKED' as const,
      userId: currentUid
    }));
    saveLocationsToLocalStorage(seeded, currentUid);
    return seeded;
  },

  async createLocation(location: Partial<LocationItem>): Promise<LocationItem> {
    const currentUid = getActiveUid() || location.userId || (auth.currentUser?.uid) || 'guest_user';
    const locPayload: Partial<LocationItem> = {
      ...location,
      userId: currentUid
    };

    let createdLoc: LocationItem | null = null;
    try {
      const freshToken = await getFreshAuthToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (freshToken) {
        headers['Authorization'] = `Bearer ${freshToken}`;
      } else {
        const storedToken = getAuthToken();
        if (storedToken) headers['Authorization'] = `Bearer ${storedToken}`;
      }

      const res = await fetch('/api/locations', {
        method: 'POST',
        headers,
        body: JSON.stringify(locPayload)
      });
      const data = await res.json();
      if (res.ok && data.success && data.location) {
        createdLoc = { ...data.location, userId: currentUid || data.location.userId };
      }
    } catch (e) {
      console.warn('Could not save location to server API, fallback to direct Firestore:', e);
    }

    if (!createdLoc) {
      createdLoc = normalizeLocationPersistence({
        ...location,
        userId: currentUid
      });
    } else {
      createdLoc.userId = currentUid;
    }

    // บันทึกลง Firestore ถาวร
    try {
      await saveLocationToFirestore(createdLoc, currentUid);
    } catch (err) {
      console.warn('Failed to save location to Firestore directly:', err);
    }

    // แคชลง LocalStorage สำรองของ UID นี้
    if (currentUid) {
      const currentLocal = getLocalStorageLocations(currentUid);
      const updatedLocal = [createdLoc, ...currentLocal.filter(l => l.id !== createdLoc!.id)];
      saveLocationsToLocalStorage(updatedLocal, currentUid);
    }

    return createdLoc;
  },

  async deleteLocation(id: string): Promise<void> {
    const currentUid = getActiveUid();
    try {
      await fetch(`/api/locations/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
    } catch (e) {
      console.warn('Server delete location error:', e);
    }

    // ลบออกจาก Firestore
    try {
      await deleteLocationFromFirestore(id, currentUid || undefined);
    } catch (e) {
      console.warn('Firestore delete location error:', e);
    }

    // ลบออกจาก LocalStorage
    if (currentUid) {
      const currentLocal = getLocalStorageLocations(currentUid);
      saveLocationsToLocalStorage(currentLocal.filter(l => l.id !== id), currentUid);
    }
  },

  async uploadLocationReferenceImage(imageData: string, customId?: string, imageHash?: string): Promise<{
    referenceImageId: string;
    referenceImageUrl: string;
    imageHash: string;
  }> {
    return uploadLocationReferenceImage(imageData, customId, imageHash);
  },

  async analyzeLocationImage(
    imageOrImages: string | string[],
    options?: { token?: string; apiKey?: string; forceReanalyze?: boolean }
  ): Promise<any> {
    const imagesList = Array.isArray(imageOrImages)
      ? imageOrImages.filter(img => typeof img === 'string' && img.trim().length > 0)
      : [imageOrImages].filter(img => typeof img === 'string' && img.trim().length > 0);

    if (imagesList.length === 0) {
      throw new Error('กรุณาระบุรูปภาพอ้างอิงสถานที่สำหรับการวิเคราะห์');
    }

    const primaryImage = imagesList[0];
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = options?.token || getAuthToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch('/api/location/analyze-image', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        image: primaryImage,
        images: imagesList,
        apiKey: (await resolveUserGeminiKey(options?.apiKey)) || undefined,
        forceReanalyze: options?.forceReanalyze ?? false
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'วิเคราะห์สถานที่ล้มเหลว');
    }

    // Full envelope { success, source, cached, fallback?, data } so the UI can label the source
    return await res.json();
  },

  async getProjects(): Promise<Project[]> {
    const res = await fetch('/api/projects', { headers: getAuthHeaders() });
    const data = await res.json();
    return data.projects || [];
  },

  async createProject(project: Partial<Project>): Promise<Project> {
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(project)
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'ไม่สามารถสร้างโปรเจ็กต์ได้');
    }
    return data.project;
  },

  async updateProject(id: string, updates: Partial<Project>): Promise<Project> {
    const res = await fetch(`/api/projects/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(updates)
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'ไม่สามารถอัปเดตโปรเจ็กต์ได้');
    }
    return data.project;
  },

  async deleteProject(id: string): Promise<void> {
    const res = await fetch(`/api/projects/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'ไม่สามารถลบโปรเจ็กต์ได้');
    }
  },

  async getCredits(): Promise<CreditAccount> {
    const headers = getAuthHeaders();
    try {
      const res = await fetch('/api/credits', { headers });
      const data = await res.json();
      if (data && data.account) {
        return data.account;
      }
    } catch (err) {
      console.warn('Failed to fetch credits from server, returning default account:', err);
    }
    return {
      userId: 'user_sala_001',
      userName: 'ผู้ใช้ศาลาเอไอ (Demo Member)',
      userRole: 'user',
      remainingCredits: 100,
      totalUsedCredits: 0,
      dailyUsedCredits: 0,
      dailyLimit: 150,
      monthlyUsedCredits: 0,
      monthlyLimit: 1000,
      perGenerationLimit: 40,
      copyPromptFee: 10,
      serviceFeeType: 'fixed',
      serviceFeeValue: 0,
      transactions: []
    };
  },

  async topupCredits(amount: number): Promise<CreditAccount> {
    const res = await fetch('/api/credits/topup', {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ amount })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'ไม่สามารถเติมเครดิตได้');
    }
    return data.account;
  },

  async getAdminStats(): Promise<AdminStats> {
    const res = await fetch('/api/admin/stats', { headers: getAuthHeaders() });
    const data = await res.json();
    return data.stats;
  },

  async adminGrantCredits(userId: string, amount: number): Promise<number> {
    const res = await fetch('/api/admin/grant-credits', {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ userId, amount })
    });
    const data = await res.json();
    return data.remainingCredits;
  },

  async adminResetLimits(): Promise<void> {
    const res = await fetch('/api/admin/reset-limits', {
      method: 'POST',
      headers: getAuthHeaders()
    });
    await res.json();
  },

  async generateMultiClipDirectorPrompts(payload: {
    scriptText: string;
    clipDurationSeconds: number;
    clipCount: number;
    continuityLock: import('../types').MasterContinuityLock;
    dialogues: import('../types').DialogueLockEntry[];
    audioDirectives: import('../types').AudioDirectives;
    offline?: boolean;
    apiKey?: string;
    /** Library characters / locations used for the LOCKED CONTINUITY CONTEXT (only lock-relevant fields are sent) */
    characters?: Array<Partial<import('../types').Character>>;
    locations?: Array<{ id?: string; name: string; description?: string }>;
  }): Promise<{
    success: boolean;
    clips: import('../types').DirectedClipItem[];
    source: 'gemini-ai' | 'deterministic';
    offline?: boolean;
    validation?: { isValid: boolean; errors: string[]; warnings: string[] };
    /** Density auto-split report (offline builder): requested vs final clip count */
    autoSplit?: { requestedClipCount: number; finalClipCount: number; autoSplitApplied: boolean; splitScenes: Array<{ sourceSceneNumber: number; parts: number; clipNumbers: number[]; reason: string }> };
  }> {
    await getFreshAuthToken();
    const apiKey = payload.offline ? '' : await resolveUserGeminiKey(payload.apiKey);
    const res = await fetch('/api/director/generate-multi-clip-prompts', {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ ...payload, apiKey: apiKey || undefined })
    });
    assertJsonResponse(res, '/api/director/generate-multi-clip-prompts');
    if (!res.ok) {
      throw await readApiError(res, 'ไม่สามารถสร้างชุด Multi-Clip Prompts ได้ / Multi-clip generation failed');
    }
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.message || 'ไม่สามารถสร้างชุด Multi-Clip Prompts ได้ / Multi-clip generation failed');
    }
    return data;
  },

  async regenerateSingleClipPrompt(payload: {
    clipNumber: number;
    totalClips: number;
    durationSeconds: number;
    sceneSummary: string;
    previousClipEndAction: string;
    nextClipStartAction: string;
    continuityLock: import('../types').MasterContinuityLock;
    dialogues: import('../types').DialogueLockEntry[];
    audioDirectives: import('../types').AudioDirectives;
  }): Promise<{ success: boolean; clip: import('../types').DirectedClipItem }> {
    await getFreshAuthToken();
    const res = await fetch('/api/director/regenerate-single-clip', {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'ไม่สามารถสร้างคลิปใหม่ได้');
    }
    return data;
  },

  // Auth & Profile
  async register(payload: { firstName: string; lastName: string; username: string; email: string; password: string }) {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'สมัครสมาชิกไม่สำเร็จ');
    if (data.token) {
      localStorage.setItem('sala_auth_token', data.token);
      localStorage.setItem('sala_auth_id_token', data.token);
    }
    return data;
  },

  async login(payload: { usernameOrEmail: string; password: string }) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'เข้าสู่ระบบไม่สำเร็จ');
    if (data.token) {
      localStorage.setItem('sala_auth_token', data.token);
      localStorage.setItem('sala_auth_id_token', data.token);
    }
    return data;
  },

  async logout() {
    const token = getAuthToken();
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    localStorage.removeItem('sala_auth_token');
    localStorage.removeItem('sala_auth_id_token');
  },

  async getMe() {
    await getFreshAuthToken();
    const token = getAuthToken();
    const res = await fetch('/api/auth/me', {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    const data = await res.json();
    return data;
  },

  async verifyEmail(email: string, otpCode: string) {
    const res = await fetch('/api/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otpCode })
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'รหัสยืนยันไม่ถูกต้อง');
    return data;
  },

  async resendOtp(email: string) {
    const res = await fetch('/api/auth/resend-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    return await res.json();
  },

  async forgotPassword(email: string) {
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'ไม่พบอีเมล');
    return data;
  },

  async resetPassword(payload: { email: string; code: string; newPassword: string }) {
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'รีเซ็ตรหัสผ่านไม่สำเร็จ');
    return data;
  },

  // Admin Management
  async getAdminUsers() {
    const res = await fetch('/api/admin/users', { headers: getAuthHeaders() });
    const data = await res.json();
    return data.users || [];
  },

  async adminCreateUser(payload: any) {
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'สร้างผู้ใช้ไม่สำเร็จ');
    return data;
  },

  async adminAdjustCredits(payload: { userId: string; amount: number; reason: string }) {
    const res = await fetch('/api/admin/adjust-credits', {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'ปรับเครดิตไม่สำเร็จ');
    return data;
  },

  async adminToggleUserStatus(userId: string) {
    const res = await fetch('/api/admin/toggle-user-status', {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ userId })
    });
    return await res.json();
  },

  async getPricingConfig() {
    const res = await fetch('/api/admin/pricing-config', { headers: getAuthHeaders() });
    const data = await res.json();
    return data.config;
  },

  async updatePricingConfig(payload: any) {
    const res = await fetch('/api/admin/pricing-config', {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    return await res.json();
  },

  async getRedeemCodes() {
    const res = await fetch('/api/admin/redeem-codes', { headers: getAuthHeaders() });
    const data = await res.json();
    return data.codes || [];
  },

  async createRedeemCode(payload: any) {
    const res = await fetch('/api/admin/redeem-codes', {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'สร้างโค้ดไม่สำเร็จ');
    return data;
  },

  async deleteRedeemCode(id: string) {
    const res = await fetch(`/api/admin/redeem-codes/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    return await res.json();
  },

  async redeemCode(code: string) {
    const res = await fetch('/api/redeem-code', {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ code })
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'โค้ดไม่ถูกต้องหรือหมดอายุ');
    return data;
  },

  // Continuity Checker
  async checkContinuity(payload: {
    scriptText: string;
    clips: import('../types').DirectedClipItem[];
    continuityLock: import('../types').MasterContinuityLock;
    dialogues: import('../types').DialogueLockEntry[];
  }): Promise<import('../types').ContinuityCheckReport> {
    const res = await fetch('/api/director/continuity-check', {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      throw await readApiError(res, 'ตรวจความต่อเนื่องไม่สำเร็จ / Continuity check failed');
    }
    const data = await res.json().catch(() => null);
    if (!data || !data.report) {
      throw new Error('ตรวจความต่อเนื่องไม่สำเร็จ: เซิร์ฟเวอร์ไม่ส่งรายงานกลับมา / Continuity check failed: no report returned');
    }
    return data.report;
  },

  // Emergency Stop
  async emergencyStop(jobIds: string[]) {
    const res = await fetch('/api/director/emergency-stop', {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ jobIds })
    });
    const data = await res.json();
    return data;
  },

  // Lip Sync Workflow
  async generateLipSyncWorkflow(payload: {
    characterImageUrl: string;
    characterName: string;
    scriptText: string;
    audioFileName?: string;
    provider?: string;
    emotion?: string;
  }) {
    const res = await fetch('/api/lipsync/generate-workflow', {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    return data;
  },

  // Video to Script
  async analyzeVideoToScript(payload: { videoUrl?: string; videoName?: string; sampleId?: string }) {
    const res = await fetch('/api/video-to-script/analyze', {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    return data.result as import('../types').VideoToScriptResult;
  },

  // Script Editor / Character Replace
  async replaceCharactersInScript(payload: {
    scriptText: string;
    dialogues: import('../types').DialogueLockEntry[];
    oldName: string;
    newName: string;
    characterLibraryId?: string;
  }) {
    const res = await fetch('/api/script/replace-characters', {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'ไม่สามารถแทนที่ตัวละครได้');
    return data;
  },

  // AI Social Post Assistant
  async generateSocialPosts(payload: { scriptText: string; characterName?: string; tone?: string }) {
    const res = await fetch('/api/social/generate-posts', {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    return data.recommendations as import('../types').SocialPostRecommendation[];
  },

  // Project Templates & Versioning
  async getProjectTemplates(): Promise<import('../types').ProjectTemplate[]> {
    const res = await fetch('/api/project-templates', { headers: getAuthHeaders() });
    const data = await res.json();
    return data.templates || [];
  },

  async saveProjectTemplate(payload: any): Promise<import('../types').ProjectTemplate> {
    const res = await fetch('/api/project-templates', {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    return data.template;
  },

  async createProjectVersion(projectId: string, note?: string) {
    const res = await fetch(`/api/projects/${projectId}/version`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note })
    });
    const data = await res.json();
    return data.version;
  },

  async restoreProjectVersion(projectId: string, versionId: string) {
    const res = await fetch(`/api/projects/${projectId}/restore-version`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ versionId })
    });
    const data = await res.json();
    return data.project;
  },

  // Story Continuation / Progressive Scene Generator
  async continueStory(payload: import('../types').StoryContinuationPayload): Promise<import('../types').StoryContinuationResponse> {
    // 1. Direct offline handling if user explicitly requests offline mode
    if (payload.offline) {
      const { generateEpisodeLocally } = await import('./storyEpisodeEngine');
      const localResult = generateEpisodeLocally({
        originalStory: payload.originalStory,
        currentScriptText: payload.currentScriptText,
        episodeNumber: payload.episodeNumber,
        targetSceneCount: payload.targetSceneCount,
        existingScenes: payload.existingScenes,
        lastSceneState: payload.lastSceneState,
        characters: payload.characters,
        continuityLock: payload.continuityLock,
        clipDurationSeconds: payload.clipDurationSeconds || 10
      });
      return {
        success: true,
        source: 'offline-narrative-engine',
        offline: true,
        ...localResult
      };
    }

    // 2. Call server API
    try {
      const apiKey = await resolveUserGeminiKey(payload.apiKey);
      const res = await fetch('/api/story/continue', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ ...payload, apiKey: apiKey || undefined })
      });

      const text = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch {
        // Not valid JSON (e.g. Vite SPA HTML fallback or proxy message)
      }

      if (res.ok && data && typeof data === 'object') {
        return data;
      }

      if (!res.ok) {
        if (data && data.message) {
          const err = new Error(data.message);
          (err as any).code = data.code;
          (err as any).status = res.status;
          throw err;
        }
        throw new Error(`ต่อบทไม่สำเร็จ (HTTP ${res.status}): ${text.slice(0, 150)}`);
      }

      // If res.ok (HTTP 200) but body was not JSON (e.g. index.html)
      console.warn('Backend returned non-JSON for /api/story/continue. Activating local story engine fallback.');
      const { generateEpisodeLocally } = await import('./storyEpisodeEngine');
      const localResult = generateEpisodeLocally({
        originalStory: payload.originalStory,
        currentScriptText: payload.currentScriptText,
        episodeNumber: payload.episodeNumber,
        targetSceneCount: payload.targetSceneCount,
        existingScenes: payload.existingScenes,
        lastSceneState: payload.lastSceneState,
        characters: payload.characters,
        continuityLock: payload.continuityLock,
        clipDurationSeconds: payload.clipDurationSeconds || 10
      });
      return {
        success: true,
        source: 'offline-narrative-engine',
        offline: true,
        fallbackNotice: 'เซิร์ฟเวอร์ตอบกลับไม่ใช่ JSON ระบบจึงสลับใช้เอนจินเขียนบทออฟไลน์ให้อัตโนมัติ',
        ...localResult
      };
    } catch (err: any) {
      if (err?.code && String(err.code).startsWith('GEMINI_')) {
        throw err;
      }
      console.warn('continueStory encountered error, attempting offline generation fallback:', err?.message || err);
      try {
        const { generateEpisodeLocally } = await import('./storyEpisodeEngine');
        const localResult = generateEpisodeLocally({
          originalStory: payload.originalStory,
          currentScriptText: payload.currentScriptText,
          episodeNumber: payload.episodeNumber,
          targetSceneCount: payload.targetSceneCount,
          existingScenes: payload.existingScenes,
          lastSceneState: payload.lastSceneState,
          characters: payload.characters,
          continuityLock: payload.continuityLock,
          clipDurationSeconds: payload.clipDurationSeconds || 10
        });
        return {
          success: true,
          source: 'offline-narrative-engine',
          offline: true,
          fallbackNotice: `การเชื่อมต่อเซิร์ฟเวอร์ขัดข้อง (${err?.message || 'Network error'}) ระบบจึงสลับใช้เอนจินออฟไลน์แทน`,
          ...localResult
        };
      } catch {
        throw err;
      }
    }
  }
};
