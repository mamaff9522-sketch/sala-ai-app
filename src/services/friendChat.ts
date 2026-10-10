/** Friend and character chat. No network. The same room id is shared by both people. */

export interface TalkPerson {
  id: string;
  name: string;
}

export interface TalkRoom {
  id: string;
  title: string;
  memberIds: string[];
  kind: 'friend' | 'character';
}

export interface TalkMessage {
  id: string;
  roomId: string;
  senderId: string;
  text: string;
}

export function roomIdFor(meId: string, partnerId: string): string {
  const ids = [String(meId || '').trim(), String(partnerId || '').trim()].filter((id) => id.length > 0).sort();
  return `talk-${ids.join('--')}`;
}

export function startTalk(rooms: TalkRoom[], me: TalkPerson, partner: TalkPerson, kind: 'friend' | 'character'): TalkRoom[] {
  const meId = String(me.id || '').trim();
  const partnerId = String(partner.id || '').trim();
  const title = String(partner.name || '').trim();
  if (!meId || !partnerId || meId === partnerId || !title) return rooms;
  const id = roomIdFor(meId, partnerId);
  if (rooms.some((room) => room.id === id)) return rooms;
  return [...rooms, { id, title, memberIds: [meId, partnerId], kind }];
}

export function postTalk(
  messages: TalkMessage[],
  roomId: string,
  senderId: string,
  text: string,
  now: number = Date.now()
): TalkMessage[] {
  const id = String(roomId || '').trim();
  const sender = String(senderId || '').trim();
  const body = String(text || '').trim();
  if (!id || !sender || !body) return messages;
  return [...messages, { id: `m-${now}-${messages.length + 1}`, roomId: id, senderId: sender, text: body }];
}

export function messagesIn(messages: TalkMessage[], roomId: string): TalkMessage[] {
  return messages.filter((message) => message.roomId === roomId);
}
