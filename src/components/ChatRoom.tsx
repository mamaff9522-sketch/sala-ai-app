import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, MessageCircle, Send, UserPlus, Users } from 'lucide-react';
import type { User } from 'firebase/auth';
import {
  EVERYONE_ROOM_ID,
  EVERYONE_ROOM_TITLE,
  orderedChatRooms,
  parseMemberIds,
  roomKind,
  roomTitle,
  senderLabel,
  type ListedRoom
} from '../services/chatRoomMembers';
import {
  createDirectRoom,
  createGroupRoom,
  ensureEveryoneRoom,
  listenToMessages,
  listenToRooms,
  sendText,
  type ChatTextMessage
} from '../services/chatRooms';

interface ChatRoomProps {
  authUser?: User | null;
}

type Panel = 'list' | 'room' | 'friend' | 'group';

const ALIAS_KEY = 'sala-chat-aliases';

function loadAliases(): Record<string, string> {
  try {
    const raw = localStorage.getItem(ALIAS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') return {};
    const names: Record<string, string> = {};
    Object.entries(parsed).forEach(([id, name]) => {
      if (typeof name === 'string' && name.trim() && id.trim()) names[id] = name.trim();
    });
    return names;
  } catch {
    return {};
  }
}

function explainChatError(err: unknown, roomId?: string): string {
  const message = err instanceof Error ? err.message : String(err || '');
  if (/permission|insufficient/i.test(message)) {
    if (roomId === EVERYONE_ROOM_ID) return 'ห้องรวมยังใช้ไม่ได้จนกว่าจะเผยแพร่กฎ Firestore';
    return 'ห้องนี้เปิดได้เฉพาะสมาชิก';
  }
  return message || 'ทำรายการไม่สำเร็จ';
}

function roomSubtitle(room: ListedRoom, myUid: string): string {
  const kind = roomKind(room);
  if (kind === 'everyone') return 'ทุกคนที่เข้าสู่ระบบ';
  if (kind === 'group') return `สมาชิก ${room.memberIds.length} คน`;
  const other = room.memberIds.find((id) => id !== myUid);
  return other || '';
}

export const ChatRoom: React.FC<ChatRoomProps> = ({ authUser }) => {
  const [panel, setPanel] = useState<Panel>('list');
  const [rooms, setRooms] = useState<ListedRoom[]>([]);
  const [aliases, setAliases] = useState<Record<string, string>>(loadAliases);
  const [openId, setOpenId] = useState('');
  const [pendingTitle, setPendingTitle] = useState('');
  const [messages, setMessages] = useState<ChatTextMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [friendName, setFriendName] = useState('');
  const [friendUid, setFriendUid] = useState('');
  const [groupName, setGroupName] = useState('');
  const [groupUids, setGroupUids] = useState('');
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(ALIAS_KEY, JSON.stringify(aliases));
    } catch {
      // Alias names are only a local label. Chat still works without them.
    }
  }, [aliases]);

  useEffect(() => {
    if (!authUser?.uid) return;
    const stop = listenToRooms(authUser.uid, setRooms, (err) => setError(explainChatError(err)));
    return () => stop();
  }, [authUser?.uid]);

  useEffect(() => {
    setMessages([]);
    setDraft('');
  }, [openId]);

  useEffect(() => {
    if (!authUser?.uid || panel !== 'room' || !openId) return;
    let cancelled = false;
    if (openId === EVERYONE_ROOM_ID) {
      ensureEveryoneRoom().catch((err) => {
        if (!cancelled) setError(explainChatError(err, openId));
      });
    }
    const stop = listenToMessages(
      openId,
      (incoming) => {
        if (!cancelled) setMessages(incoming);
      },
      (err) => {
        if (!cancelled) setError(explainChatError(err, openId));
      }
    );
    return () => {
      cancelled = true;
      stop();
    };
  }, [authUser?.uid, panel, openId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, openId]);

  if (!authUser) {
    return (
      <div className="w-full max-w-lg mx-auto px-3 sm:px-6 py-6 pb-32">
        <h1 className="text-xl font-bold text-white mb-4">คุยกับเพื่อน</h1>
        <p className="rounded-3xl border border-slate-800 bg-[#0e1424] p-8 text-center text-sm text-slate-200">กรุณาเข้าสู่ระบบ</p>
      </div>
    );
  }

  const me = authUser.uid;
  const visible = orderedChatRooms(rooms, me, aliases);
  const openRoom = visible.find((room) => room.id === openId);
  const title = openRoom ? roomTitle(openRoom, me, aliases) : pendingTitle || 'แชท';
  const knownNames: Record<string, string> = { ...aliases };
  if (authUser.displayName) knownNames[me] = authUser.displayName;
  if (openRoom?.createdBy && openRoom.creatorName && !knownNames[openRoom.createdBy]) {
    knownNames[openRoom.createdBy] = openRoom.creatorName;
  }

  const openRoomPanel = (room: ListedRoom) => {
    setError('');
    setPendingTitle(roomTitle(room, me, aliases));
    setOpenId(room.id);
    setPanel('room');
  };

  const handleSend = async () => {
    const text = draft.trim();
    if (!openId || !text || busy) return;
    if (text.length > 4000) {
      setError('ข้อความยาวเกิน 4000 ตัวอักษร');
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (openId === EVERYONE_ROOM_ID) await ensureEveryoneRoom();
      await sendText(openId, text);
      setDraft('');
    } catch (err) {
      setError(explainChatError(err, openId));
    } finally {
      setBusy(false);
    }
  };

  const handleAddFriend = async () => {
    const name = friendName.trim();
    const uid = friendUid.trim();
    if (!name || !uid) {
      setError('ใส่ชื่อเพื่อนและรหัสของผู้ใช้อีกคน');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const id = await createDirectRoom(name, uid);
      setAliases((current) => ({ ...current, [uid]: name }));
      setFriendName('');
      setFriendUid('');
      setPendingTitle(name);
      setOpenId(id);
      setPanel('room');
    } catch (err) {
      setError(explainChatError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleCreateGroup = async () => {
    const name = groupName.trim();
    const ids = parseMemberIds(groupUids).filter((id) => id !== me);
    if (!name) {
      setError('กรุณาตั้งชื่อกลุ่ม');
      return;
    }
    if (ids.length === 0) {
      setError('ใส่รหัสสมาชิกอย่างน้อย 1 คน');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const id = await createGroupRoom(name, ids);
      setGroupName('');
      setGroupUids('');
      setPendingTitle(name);
      setOpenId(id);
      setPanel('room');
    } catch (err) {
      setError(explainChatError(err));
    } finally {
      setBusy(false);
    }
  };

  const backButton = (
    <button
      type="button"
      onClick={() => {
        setError('');
        setPanel('list');
      }}
      className="inline-flex items-center gap-1 text-sm text-slate-200"
    >
      <ArrowLeft className="w-4 h-4" />
      กลับ
    </button>
  );

  const everyone = visible.filter((room) => roomKind(room) === 'everyone');
  const groups = visible.filter((room) => roomKind(room) === 'group');
  const friends = visible.filter((room) => roomKind(room) === 'direct');

  const roomButton = (room: ListedRoom, pinned = false) => (
    <button
      key={room.id}
      type="button"
      onClick={() => openRoomPanel(room)}
      className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl border border-slate-800 bg-slate-950/50 text-left"
    >
      <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${pinned ? 'bg-emerald-500/20 text-emerald-200' : roomKind(room) === 'group' ? 'bg-violet-600/20 text-violet-200' : 'bg-cyan-600/20 text-cyan-100'}`}>
        {roomKind(room) === 'group' ? <Users className="w-5 h-5" /> : <MessageCircle className="w-5 h-5" />}
      </div>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white truncate">{roomTitle(room, me, aliases)}</span>
          {pinned && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-200">ปักหมุด</span>}
        </span>
        <span className="block text-xs text-slate-400 truncate">{roomSubtitle(room, me)}</span>
      </span>
    </button>
  );

  return (
    <div className="w-full max-w-lg mx-auto px-3 sm:px-4 py-4 pb-32">
      {panel === 'list' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-300">
              <MessageCircle className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-white">คุยกับเพื่อน</h1>
          </div>
          <p className="text-xs text-slate-400 break-all">รหัสของฉัน: {me}</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => { setError(''); setPanel('friend'); }} className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-2xl text-sm font-semibold bg-violet-600 text-white">
              <UserPlus className="w-4 h-4" />
              เพิ่มเพื่อน
            </button>
            <button type="button" onClick={() => { setError(''); setPanel('group'); }} className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-2xl text-sm font-semibold bg-slate-800 text-white border border-slate-700">
              <Users className="w-4 h-4" />
              สร้างกลุ่ม
            </button>
          </div>
          {error && <p className="text-sm text-rose-300">{error}</p>}
          <div className="space-y-2">
            {everyone.map((room) => roomButton(room, true))}
          </div>
          {groups.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-xs font-bold text-slate-400 px-1">กลุ่ม</h2>
              {groups.map((room) => roomButton(room))}
            </section>
          )}
          {friends.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-xs font-bold text-slate-400 px-1">เพื่อน</h2>
              {friends.map((room) => roomButton(room))}
            </section>
          )}
          {groups.length === 0 && friends.length === 0 && (
            <p className="text-sm text-slate-400 px-1">ยังไม่มีแชทส่วนตัว เพิ่มเพื่อนหรือสร้างกลุ่ม</p>
          )}
        </div>
      )}

      {panel === 'friend' && (
        <div className="space-y-4">
          {backButton}
          <h1 className="text-xl font-bold text-white">เพิ่มเพื่อน</h1>
          <p className="text-xs text-slate-400">ใส่ชื่อและรหัสผู้ใช้ของอีกคน เห็นกันได้แค่สองคน</p>
          <div className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2">
            <p className="text-xs text-slate-400">รหัสของฉัน ส่งให้อีกคนวางในช่องรหัส</p>
            <p className="mt-1 break-all font-mono text-sm text-white">{me}</p>
            <button
              type="button"
              onClick={() => { void navigator.clipboard?.writeText(me); }}
              className="mt-2 text-xs font-semibold text-violet-300"
            >
              คัดลอกรหัสของฉัน
            </button>
          </div>
          <input value={friendName} onChange={(event) => setFriendName(event.target.value)} placeholder="ชื่อเพื่อน" className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-white" />
          <input
            value={friendUid}
            onChange={(event) => setFriendUid(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void handleAddFriend();
            }}
            placeholder="รหัสของผู้ใช้อีกคน"
            className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-white"
          />
          {error && <p className="text-sm text-rose-300">{error}</p>}
          <button type="button" onClick={() => void handleAddFriend()} disabled={busy} className="w-full px-3 py-2.5 rounded-xl text-sm font-semibold bg-violet-600 text-white disabled:opacity-40">
            เพิ่มเพื่อน
          </button>
        </div>
      )}

      {panel === 'group' && (
        <div className="space-y-4">
          {backButton}
          <h1 className="text-xl font-bold text-white">สร้างกลุ่ม</h1>
          <p className="text-xs text-slate-400">ใส่รหัสสมาชิก คนละบรรทัด รวมคุณแล้วไม่เกิน 50 คน เห็นกันได้เฉพาะสมาชิก</p>
          <input value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="ชื่อกลุ่ม" className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-white" />
          <textarea value={groupUids} onChange={(event) => setGroupUids(event.target.value)} placeholder="รหัสสมาชิก" rows={5} className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-white" />
          {error && <p className="text-sm text-rose-300">{error}</p>}
          <button type="button" onClick={() => void handleCreateGroup()} disabled={busy} className="w-full px-3 py-2.5 rounded-xl text-sm font-semibold bg-violet-600 text-white disabled:opacity-40">
            สร้างกลุ่ม
          </button>
        </div>
      )}

      {panel === 'room' && (
        <section className="rounded-3xl border border-slate-800 bg-[#0e1424] p-4 flex flex-col min-h-[70vh]">
          <div className="flex items-center gap-3 mb-3">
            {backButton}
            <div className="min-w-0">
              <h1 className="text-base font-bold text-white truncate">{openId === EVERYONE_ROOM_ID ? EVERYONE_ROOM_TITLE : title}</h1>
              {openRoom && <p className="text-[11px] text-slate-400 truncate">{roomSubtitle(openRoom, me)}</p>}
            </div>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto">
            {messages.length === 0 ? (
              <p className="text-sm text-slate-400">ยังไม่มีข้อความ พิมพ์แล้วกดส่ง</p>
            ) : (
              messages.map((message) => {
                const mine = message.senderId === me;
                const label = senderLabel(message.senderId, knownNames);
                return (
                  <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] ${mine ? 'items-end' : 'items-start'} flex flex-col`}>
                      <p className="text-[11px] text-slate-400 mb-1 break-all">{label}</p>
                      <div className={`rounded-2xl px-3 py-2 text-sm break-words ${mine ? 'bg-violet-600/30 text-white' : 'bg-slate-900 text-slate-100'}`}>
                        {message.text}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={endRef} />
          </div>
          {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
          <div className="mt-3 flex gap-2">
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void handleSend();
                }
              }}
              placeholder="พิมพ์ข้อความ"
              className="flex-1 rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-white"
            />
            <button type="button" onClick={() => void handleSend()} disabled={!openId || busy || !draft.trim()} className="px-3 py-2 rounded-xl text-sm font-semibold bg-cyan-600 text-white disabled:opacity-40 flex items-center gap-1.5">
              <Send className="w-4 h-4" />
              ส่ง
            </button>
          </div>
        </section>
      )}
    </div>
  );
};
