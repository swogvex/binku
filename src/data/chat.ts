// Server calls for chat (data layer: screens never call Supabase directly). Every rule lives on
// the server (send_message); the app only shows what the server allows and explains refusals.
import type { TKey } from '@/i18n';
import { supabase } from '@/lib/supabase';

export type ProposalType = 'offer' | 'accept' | 'tracked' | 'shipped' | 'received';
export type Proposal =
  { type: 'offer'; give: string[]; get: string[] } | { type: Exclude<ProposalType, 'offer'> };

export type Message = {
  id: number;
  conversation_id: string;
  sender_id: string | null;
  kind: 'text' | 'card' | 'proposal';
  body: string | null;
  card_id: string | null;
  proposal: Proposal | null;
  created_at: string;
};

/** A row of the inbox, or the header of one conversation (id null = first contact). */
export type Chat = {
  id: string | null;
  other_id: string;
  other_username: string;
  other_country: string;
  other_subdivision: string | null;
  last_message_at: string | null;
  last_kind: Message['kind'] | null;
  last_body: string | null;
  last_card: string | null;
  last_proposal: Proposal | null;
  last_mine: boolean | null;
  unread: number;
  other_read_at: string | null;
  muted: boolean;
  blocked: boolean;
  /** adult ↔ minor: proposals and cards only */
  structured: boolean;
  /** a minor is in the conversation: links and handles are refused too */
  strict: boolean;
  /** type of the latest proposal (Propuesta / Enviado…) */
  stage: ProposalType | null;
  /** latest trade offer, `give` = what its sender gives */
  offer: Extract<Proposal, { type: 'offer' }> | null;
  offer_mine: boolean | null;
};

export type ReportReason =
  'scam' | 'fake' | 'harassment' | 'sexual' | 'personal_data' | 'spam' | 'in_person' | 'other';

export async function fetchChats(): Promise<Chat[]> {
  const { data, error } = await supabase.rpc('get_chats');
  if (error) throw error;
  return (data ?? []) as Chat[];
}

export async function fetchChat(by: { id: string } | { other: string }) {
  const { data, error } = await supabase.rpc(
    'get_chats',
    'id' in by ? { p_conversation: by.id } : { p_other: by.other },
  );
  if (error) throw error;
  return ((data ?? []) as Chat[])[0] ?? null;
}

const PAGE = 50;
/** Newest first; pass the oldest id you have to load earlier ones. */
export async function fetchMessages(conversation: string, before?: number) {
  let q = supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversation)
    .order('id', { ascending: false })
    .limit(PAGE);
  if (before) q = q.lt('id', before);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Message[];
}

export type Outgoing =
  | { kind: 'text'; body: string }
  | { kind: 'card'; card: string }
  | { kind: 'proposal'; proposal: Proposal };

export async function sendMessage(to: { conversation: string } | { user: string }, m: Outgoing) {
  const { data, error } = await supabase.rpc('send_message', {
    p_conversation: 'conversation' in to ? to.conversation : null,
    p_to: 'user' in to ? to.user : null,
    p_kind: m.kind,
    p_body: m.kind === 'text' ? m.body : null,
    p_card: m.kind === 'card' ? m.card : null,
    p_proposal: m.kind === 'proposal' ? m.proposal : null,
  });
  if (error) throw error;
  return data as Message;
}

export async function markRead(conversation: string) {
  const { error } = await supabase.rpc('mark_read', { p_conversation: conversation });
  if (error) throw error;
}

export async function setMuted(conversation: string, muted: boolean) {
  const { error } = await supabase.rpc('set_muted', {
    p_conversation: conversation,
    p_muted: muted,
  });
  if (error) throw error;
}

export async function block(userId: string) {
  const { error } = await supabase.from('blocks').insert({ blocked_id: userId });
  if (error && error.code !== '23505') throw error; // already blocked
}

export async function unblock(userId: string) {
  const { error } = await supabase.from('blocks').delete().eq('blocked_id', userId);
  if (error) throw error;
}

export async function report(
  target: { message: number } | { conversation: string } | { user: string },
  reason: ReportReason,
  details?: string,
) {
  const [type, id] =
    'message' in target
      ? ['message', String(target.message)]
      : 'conversation' in target
        ? ['conversation', target.conversation]
        : ['profile', target.user];
  const { error } = await supabase.rpc('report', {
    p_target_type: type,
    p_target_id: id,
    p_reason: reason,
    p_details: details ?? null,
  });
  if (error) throw error;
}

/** New messages of one conversation while it is open (Realtime checks the read policy). */
export function subscribeMessages(conversation: string, onMessage: (m: Message) => void) {
  const channel = supabase
    .channel(`chat:${conversation}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversation}`,
      },
      (p) => onMessage(p.new as Message),
    )
    .subscribe();
  return () => void supabase.removeChannel(channel);
}

/** Why the server refused a message, as copy for the user. */
export function chatError(e: unknown): TKey {
  const { code, message } = (e ?? {}) as { code?: string; message?: string };
  switch (code) {
    case 'BK010':
      return 'chat.err.blocked';
    case 'BK011':
      return 'chat.err.unavailable';
    case 'BK012':
      return 'chat.err.tooManyChats';
    case 'BK014':
      return 'chat.err.slowDown';
    case 'BK015':
      return 'chat.err.structured';
    case 'BK016':
      return message === 'phone' ||
        message === 'email' ||
        message === 'address' ||
        message === 'link' ||
        message === 'handle'
        ? `chat.err.${message}`
        : 'chat.err.insult';
    case 'BK017':
      return 'chat.err.tooManyReports';
    default:
      return 'chat.err.offline';
  }
}
