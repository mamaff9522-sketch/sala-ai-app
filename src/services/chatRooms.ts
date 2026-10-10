import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
  type Unsubscribe
} from 'firebase/firestore';
import { auth, db } from './auth';
import {
  EVERYONE_ROOM_ID,
  EVERYONE_ROOM_TITLE,
  MAX_CHAT_MESSAGE,
  directRoomId,
  memberIdsForRoom,
  type ListedRoom
} from './chatRoomMembers';

export type ChatRoomRecord = ListedRoom;

export interface ChatTextMessage {
  id: string;
  senderId: string;
  text: string;
  createdAt: string | null;
}

function timeOf(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const stamp = value as { toDate?: () => Date };
  if (typeof stamp.toDate !== 'function') return null;
  try {
    return stamp.toDate().toISOString();
  } catch {
    return null;
  }
}

function isPermissionError(err: unknown): boolean {
  const code = String((err as { code?: string })?.code || '');
  const message = err instanceof Error ? err.message : String(err || '');
  return code === 'permission-denied' || /permission|insufficient/i.test(message);
}

/** Creates sala-everyone once. Other signed-in users do not need to be members. */
export async function ensureEveryoneRoom(): Promise<void> {
  const uid = auth.currentUser?.uid || '';
  if (!uid) throw new Error('กรุณาเข้าสู่ระบบ');
  const ref = doc(db, 'chatRooms', EVERYONE_ROOM_ID);
  const payload = {
    name: EVERYONE_ROOM_TITLE,
    memberIds: [uid],
    createdBy: uid,
    kind: 'everyone',
    createdAt: serverTimestamp()
  };
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (snap.exists()) return;
      tx.set(ref, payload);
    });
    return;
  } catch (err) {
    if (!isPermissionError(err)) throw err;
  }
  try {
    await setDoc(ref, payload);
  } catch (err) {
    try {
      const snap = await getDoc(ref);
      if (snap.exists()) return;
    } catch {
      throw err;
    }
    throw err;
  }
}

export async function createDirectRoom(friendName: string, friendUid: string): Promise<string> {
  const uid = auth.currentUser?.uid || '';
  if (!uid) throw new Error('กรุณาเข้าสู่ระบบ');
  const name = String(friendName || '').trim();
  if (!name) throw new Error('ใส่ชื่อเพื่อน');
  const id = directRoomId(uid, friendUid);
  const members = memberIdsForRoom(uid, [friendUid]);
  if (members.length !== 2) throw new Error('ใส่รหัสของผู้ใช้อีกคน');
  const ref = doc(db, 'chatRooms', id);
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) return id;
  } catch (err) {
    if (!isPermissionError(err)) throw err;
  }
  await setDoc(ref, {
    name,
    memberIds: members,
    createdBy: uid,
    kind: 'direct',
    creatorName: auth.currentUser?.displayName || '',
    createdAt: serverTimestamp()
  });
  return id;
}

export async function createGroupRoom(name: string, memberIds: string[]): Promise<string> {
  const uid = auth.currentUser?.uid || '';
  if (!uid) throw new Error('กรุณาเข้าสู่ระบบ');
  const roomName = String(name || '').trim();
  if (!roomName) throw new Error('กรุณาตั้งชื่อกลุ่ม');
  const members = memberIdsForRoom(uid, memberIds);
  if (members.length < 2) throw new Error('ใส่รหัสสมาชิกอย่างน้อย 1 คน');
  const ref = await addDoc(collection(db, 'chatRooms'), {
    name: roomName,
    memberIds: members,
    createdBy: uid,
    kind: 'group',
    creatorName: auth.currentUser?.displayName || '',
    createdAt: serverTimestamp()
  });
  return ref.id;
}

export function listenToRooms(
  uid: string,
  onRooms: (rooms: ChatRoomRecord[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const memberId = String(uid || '').trim();
  if (!memberId) {
    onRooms([]);
    return () => {};
  }
  const roomsQuery = query(collection(db, 'chatRooms'), where('memberIds', 'array-contains', memberId));
  return onSnapshot(
    roomsQuery,
    (snap) => {
      const rooms: ChatRoomRecord[] = snap.docs.map((docSnap) => {
        const data = docSnap.data() as {
          name?: string;
          memberIds?: unknown;
          createdBy?: string;
          kind?: string;
          creatorName?: string;
        };
        return {
          id: docSnap.id,
          name: String(data.name || ''),
          memberIds: Array.isArray(data.memberIds) ? data.memberIds.map((id) => String(id)) : [],
          createdBy: data.createdBy ? String(data.createdBy) : undefined,
          kind: data.kind ? String(data.kind) : undefined,
          creatorName: data.creatorName ? String(data.creatorName) : undefined
        };
      });
      onRooms(rooms);
    },
    (error) => {
      onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  );
}

export function listenToMessages(
  roomId: string,
  onMessages: (messages: ChatTextMessage[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const id = String(roomId || '').trim();
  if (!id) {
    onMessages([]);
    return () => {};
  }
  const messagesQuery = query(
    collection(db, 'chatRooms', id, 'messages'),
    orderBy('createdAt', 'asc')
  );
  return onSnapshot(
    messagesQuery,
    (snap) => {
      const messages: ChatTextMessage[] = snap.docs.map((docSnap) => {
        const data = docSnap.data() as { senderId?: string; text?: string; createdAt?: unknown };
        return {
          id: docSnap.id,
          senderId: String(data.senderId || ''),
          text: typeof data.text === 'string' ? data.text : '',
          createdAt: timeOf(data.createdAt)
        };
      });
      onMessages(messages);
    },
    (error) => {
      onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  );
}

export async function sendText(roomId: string, text: string): Promise<void> {
  const uid = auth.currentUser?.uid || '';
  if (!uid) throw new Error('กรุณาเข้าสู่ระบบ');
  const id = String(roomId || '').trim();
  const body = String(text || '').trim();
  if (!id || !body) return;
  if (body.length > MAX_CHAT_MESSAGE) throw new Error('ข้อความยาวเกิน 4000 ตัวอักษร');
  await addDoc(collection(db, 'chatRooms', id, 'messages'), {
    senderId: uid,
    text: body,
    createdAt: serverTimestamp()
  });
}
