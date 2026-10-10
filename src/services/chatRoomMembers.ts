/** Pure chat-room helpers. No network. */

export const EVERYONE_ROOM_ID = 'sala-everyone';
export const EVERYONE_ROOM_TITLE = 'ห้องรวม';
export const MAX_CHAT_MEMBERS = 50;
export const MAX_CHAT_MESSAGE = 4000;

export interface ListedRoom {
  id: string;
  name: string;
  memberIds: string[];
  createdBy?: string;
  kind?: string;
  creatorName?: string;
}

/** Always includes the signed-in uid. Rejects lists over 50, counting the creator. */
export function memberIdsForRoom(currentUid: string, memberIds: string[]): string[] {
  const uid = String(currentUid || '').trim();
  const raw = Array.isArray(memberIds) ? memberIds : [];
  const ids = [uid, ...raw]
    .map((id) => String(id || '').trim())
    .filter((id) => id.length > 0);
  const unique = [...new Set(ids)];
  if (unique.length > MAX_CHAT_MEMBERS) {
    throw new Error('สมาชิกได้ไม่เกิน 50 คน รวมผู้สร้าง');
  }
  return unique;
}

export function parseMemberIds(raw: string): string[] {
  return [...new Set(
    String(raw || '')
      .split(/[\s,;]+/)
      .map((id) => id.trim())
      .filter((id) => id.length > 0)
  )];
}

export function directRoomId(meId: string, friendId: string): string {
  const a = String(meId || '').trim();
  const b = String(friendId || '').trim();
  if (!a || !b || a === b) throw new Error('ใส่รหัสของผู้ใช้อีกคน');
  if ([a, b].some((id) => id.includes('/') || id === '.' || id === '..')) {
    throw new Error('รหัสผู้ใช้ไม่ถูกต้อง');
  }
  const id = `dm-${[a, b].sort().join('-')}`;
  if (id.length > 128) throw new Error('รหัสผู้ใช้ไม่ถูกต้อง');
  return id;
}

export function roomKind(room: { id: string; kind?: string; memberIds?: string[] }): 'everyone' | 'group' | 'direct' {
  if (room.id === EVERYONE_ROOM_ID || room.kind === 'everyone') return 'everyone';
  if (room.kind === 'group') return 'group';
  if (room.kind === 'direct') return 'direct';
  const count = Array.isArray(room.memberIds) ? room.memberIds.length : 0;
  return count > 2 ? 'group' : 'direct';
}

export function senderLabel(senderId: string, names?: Record<string, string | undefined>): string {
  const id = String(senderId || '').trim();
  const known = names?.[id];
  if (typeof known === 'string' && known.trim()) return known.trim();
  return id || 'ไม่ทราบผู้ส่ง';
}

export function roomTitle(
  room: ListedRoom,
  myUid: string,
  aliases?: Record<string, string | undefined>
): string {
  if (roomKind(room) === 'everyone') return EVERYONE_ROOM_TITLE;
  if (roomKind(room) === 'group') return String(room.name || '').trim() || 'กลุ่ม';
  const me = String(myUid || '').trim();
  const other = (room.memberIds || []).find((id) => id && id !== me) || '';
  const alias = other ? aliases?.[other] : '';
  if (typeof alias === 'string' && alias.trim()) return alias.trim();
  if (room.createdBy && room.createdBy !== me && room.creatorName && room.creatorName.trim()) {
    return room.creatorName.trim();
  }
  if (room.createdBy === me && room.name && room.name.trim()) return room.name.trim();
  return other || 'เพื่อน';
}

function kindRank(room: ListedRoom): number {
  const kind = roomKind(room);
  if (kind === 'everyone') return 0;
  if (kind === 'group') return 1;
  return 2;
}

/** Shared room first, then groups, then 1-on-1 chats. */
export function orderedChatRooms(
  rooms: ListedRoom[],
  myUid = '',
  aliases?: Record<string, string | undefined>
): ListedRoom[] {
  const source = Array.isArray(rooms) ? rooms : [];
  const found = source.find((room) => room.id === EVERYONE_ROOM_ID);
  const everyone: ListedRoom = found
    ? { ...found, name: EVERYONE_ROOM_TITLE, kind: 'everyone' }
    : { id: EVERYONE_ROOM_ID, name: EVERYONE_ROOM_TITLE, memberIds: [], kind: 'everyone' };
  const rest = source.filter((room) => room.id !== EVERYONE_ROOM_ID);
  rest.sort((a, b) => {
    const byKind = kindRank(a) - kindRank(b);
    if (byKind !== 0) return byKind;
    return roomTitle(a, myUid, aliases).localeCompare(roomTitle(b, myUid, aliases), 'th');
  });
  return [everyone, ...rest];
}
