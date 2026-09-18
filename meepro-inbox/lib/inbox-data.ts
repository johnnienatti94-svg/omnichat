export type Channel = 'facebook' | 'instagram' | 'tiktok' | 'line';

export type UserRole = 'admin' | 'supervisor' | 'agent';

export const roleLabels: Record<UserRole, { en: string; th: string }> = {
  admin: { en: 'Administrator', th: 'ผู้ดูแลบัญชี' },
  supervisor: { en: 'Supervisor', th: 'หัวหน้าทีม' },
  agent: { en: 'Agent', th: 'แอดมิน' },
};

export type WorkingHours = {
  enabled: boolean;
  start: string;
  end: string;
  days: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
};

export type StaffUser = {
  id: string;
  org_id: string;
  name: string;
  email: string;
  role: UserRole;
  channel_access: 'all' | Channel[];
  working_hours: WorkingHours;
  created_at: string;
};

export type Team = {
  id: string;
  org_id: string;
  name: string;
  leader_id: string;
  members?: StaffUser[];
  created_at: string;
};

export type ChannelConnection = {
  id: string;
  org_id: string;
  channel: Channel;
  name: string;
  account_id: string;
  status: 'connected' | 'disconnected' | 'demo';
  created_at: string;
};

export type CasePriority = 'urgent' | 'high' | 'normal' | 'low';

export type MessageAttachment = {
  id: string;
  type: 'image' | 'video' | 'file';
  url: string;
  name: string;
  size?: number;
};

export type Message = {
  id: string;
  conversation_id: string;
  body: string;
  direction: 'in' | 'out' | 'note';
  attachments?: MessageAttachment[];
  external_id?: string;
  delivery_status?: 'pending' | 'sent' | 'delivered' | 'failed' | 'read' | 'automated';
  created_at: string;
};

export type Conversation = {
  id: string;
  name: string;
  channel: Channel;
  handle: string;
  status: 'open' | 'closed';
  assignee: string;
  tag: string;
  notes: string;
  priority?: CasePriority;
  issue_type?: string;
  resolution?: string;
  sales_amount?: number;
  sales_successful?: boolean | number;
  closed_at?: string;
  closed_by?: string;
  customer_id?: string;
  updated_at: string;
  messages: Message[];
};

export type QuickReply = {
  id: string;
  title: string;
  body: string;
  shortcut?: string;
  media_url?: string;
};

export type AuditLogEntry = {
  id: string;
  org_id: string;
  user_id: string;
  action: string;
  target_type: string;
  target_id: string;
  details: string;
  created_at: string;
};

export const channelNames: Record<Channel, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok Shop',
  line: 'LINE Official Account',
};

const people = [
  ['Ploy S.', 'facebook', 'ploy.s', 'Product enquiry', 'สวัสดีค่ะ สนใจ iPhone 15 ค่ะ', 'สอบถาม iPhone 15 ค่ะ มีสีชมพูไหมคะ'],
  ['Thanawat K.', 'instagram', 'thanawat.k', 'Installments', 'สนใจผ่อนมือถือครับ', 'ต้องใช้เอกสารอะไรบ้างครับ'],
  ['Nicha P.', 'tiktok', 'nicha.p', 'Accessories', 'มีเคส iPhone 16 ไหมคะ', 'ขอดูสีที่มีหน่อยค่ะ'],
  ['Somsak B.', 'line', '@somsak.b', 'Installments', 'สวัสดีครับ สนใจ iPad Air 6 ผ่อน 0% ไหมครับ', 'ขอรายละเอียดโปรโมชั่นผ่อนผ่าน LINE หน่อยครับ'],
  ['Krit T.', 'facebook', 'krit.t', 'Product enquiry', 'สนใจ iPhone มือสองครับ', 'ขอรายละเอียดสินค้าครับ'],
  ['May R.', 'instagram', 'may.r', 'Store visit', 'สวัสดีค่ะ ขอสอบถามหน่อยค่ะ', 'ร้านเปิดกี่โมงคะ'],
  ['Arthit W.', 'tiktok', 'arthit.w', 'After-sales', 'สอบถามเรื่องการรับประกันครับ', 'ขอบคุณครับ'],
  ['Wipada N.', 'line', '@wipada.n', 'Sales order', 'โอนเงินมัดจำสินค้าแล้วค่ะ แจ้งสลิปใน LINE', 'ขอบคุณแอดมินมากค่ะ จัดส่งวันไหนคะ'],
];

export function demoConversations(): Conversation[] {
  return people.map((p, i) => {
    const id = `demo-${i + 1}`;
    return {
      id,
      name: p[0],
      channel: p[1] as Channel,
      handle: p[2],
      status: i === 5 ? 'closed' : 'open',
      assignee: i === 0 ? 'me' : '',
      tag: p[3],
      notes: '',
      priority: i === 0 ? 'high' : i === 1 ? 'urgent' : 'normal',
      issue_type: p[3],
      resolution: i === 5 ? 'solved' : '',
      sales_amount: i === 5 ? 18900 : 0,
      sales_successful: i === 5 ? 1 : 0,
      updated_at: `2026-09-17T03:${26 - i * 3}:00Z`,
      messages: [
        {
          id: `${id}-1`,
          conversation_id: id,
          body: p[4],
          direction: 'in',
          created_at: '2026-09-17T03:24:00Z',
        },
        {
          id: `${id}-2`,
          conversation_id: id,
          body: 'สวัสดีค่ะ ยินดีต้อนรับสู่ MeePro ค่ะ สอบถามรายละเอียดได้เลยนะคะ 😊',
          direction: 'out',
          created_at: '2026-09-17T03:25:00Z',
        },
        {
          id: `${id}-3`,
          conversation_id: id,
          body: p[5],
          direction: 'in',
          created_at: '2026-09-17T03:26:00Z',
        },
      ],
    };
  });
}

export const defaultReplies: QuickReply[] = [
  { id: 'greeting', title: 'Welcome to MeePro', body: 'สวัสดีค่ะ ยินดีต้อนรับสู่ MeePro ค่ะ สนใจรุ่นไหนสอบถามได้เลยนะคะ 😊', shortcut: '/hello' },
  { id: 'availability', title: 'Check availability', body: 'ขอทราบรุ่น สี และความจุที่สนใจค่ะ แอดมินจะตรวจสอบสินค้าให้ค่ะ', shortcut: '/stock' },
  { id: 'installments', title: 'Installment enquiry', body: 'สนใจผ่อนรุ่นไหนคะ แอดมินจะตรวจสอบเงื่อนไขและรายละเอียดให้ก่อนตัดสินใจค่ะ', shortcut: '/pay' },
  { id: 'thanks', title: 'Thank you', body: 'ขอบคุณที่สนใจ MeePro ค่ะ หากมีคำถามเพิ่มเติมทักมาได้เลยนะคะ', shortcut: '/bye' },
];

export const defaultStaff: Omit<StaffUser, 'org_id'>[] = [
  {
    id: 'user-admin',
    name: 'Somchai (Owner)',
    email: 'admin@meepro.store',
    role: 'admin',
    channel_access: 'all',
    working_hours: { enabled: true, start: '08:30', end: '19:00', days: [1, 2, 3, 4, 5, 6] },
    created_at: '2026-09-17T00:00:00Z',
  },
  {
    id: 'user-sup',
    name: 'Ploy Support Lead',
    email: 'ploy@meepro.store',
    role: 'supervisor',
    channel_access: 'all',
    working_hours: { enabled: true, start: '09:00', end: '18:00', days: [1, 2, 3, 4, 5] },
    created_at: '2026-09-17T00:00:00Z',
  },
  {
    id: 'user-agent-1',
    name: 'Krit Sales Agent',
    email: 'krit@meepro.store',
    role: 'agent',
    channel_access: ['facebook', 'instagram'],
    working_hours: { enabled: true, start: '09:00', end: '18:00', days: [1, 2, 3, 4, 5] },
    created_at: '2026-09-17T00:00:00Z',
  },
  {
    id: 'user-agent-2',
    name: 'Nicha TikTok Agent',
    email: 'nicha@meepro.store',
    role: 'agent',
    channel_access: ['tiktok'],
    working_hours: { enabled: true, start: '10:00', end: '19:00', days: [2, 3, 4, 5, 6] },
    created_at: '2026-09-17T00:00:00Z',
  },
];

export type KeywordRule = {
  id: string;
  name: string;
  keywords: string[];
  action_type: 'tag' | 'reply' | 'both';
  tag: string;
  priority?: CasePriority;
  reply_text?: string;
  enabled?: boolean;
};

export type AutomationsConfig = {
  org_id: string;
  welcome_greeting_enabled: boolean;
  welcome_greeting_text: string;
  off_hours_enabled: boolean;
  off_hours_text: string;
  off_hours_schedule: {
    start: string;
    end: string;
    days: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
  };
  closing_message_enabled: boolean;
  closing_message_text: string;
  routing_mode: 'round_robin' | 'manual';
  previous_agent_affinity: boolean;
  keyword_rules: KeywordRule[];
  updated_at: string;
};

export const defaultKeywordRules: KeywordRule[] = [
  {
    id: 'rule-installments',
    name: 'สอบถามการผ่อนชำระ (0% บัตร/SPayLater)',
    keywords: ['ผ่อน', 'งวด', 'บัตรเครดิต', 'spaylater', 'ดอกเบี้ย'],
    action_type: 'both',
    tag: 'ผ่อนชำระ',
    priority: 'high',
    reply_text: 'MeePro รองรับการผ่อนชำระ 0% สูงสุด 10 เดือนผ่านบัตรเครดิตที่ร่วมรายการ และ SPayLater ครับ ท่านสนใจรุ่นไหนเป็นพิเศษสอบถามได้เลยครับ ✨',
    enabled: true,
  },
  {
    id: 'rule-pricing',
    name: 'สอบถามราคาและโปรโมชั่น',
    keywords: ['ราคา', 'โปรโมชั่น', 'ลด', 'ราคาเท่าไหร่', 'promotion', 'ลดราคา'],
    action_type: 'tag',
    tag: 'สอบถามราคา',
    priority: 'normal',
    reply_text: '',
    enabled: true,
  },
  {
    id: 'rule-location',
    name: 'สอบถามสาขาและหน้าร้าน',
    keywords: ['สาขา', 'หน้าร้าน', 'อยู่ที่ไหน', 'พิกัด', 'location', 'เปิดกี่โมง'],
    action_type: 'both',
    tag: 'หน้าร้าน/พิกัด',
    priority: 'normal',
    reply_text: 'หน้าร้าน MeePro มี 3 สาขา: 1. เซ็นทรัลพระราม 9 ชั้น 4, 2. สยามพารากอน ชั้น 3, 3. เมกาบางนา ชั้น 2 เปิดให้บริการทุกวัน 10:00 - 21:00 น. ยินดีต้อนรับครับ 🏬',
    enabled: true,
  },
  {
    id: 'rule-warranty',
    name: 'แจ้งเคลม / บริการหลังการขาย',
    keywords: ['เคลม', 'เสีย', 'พัง', 'ซ่อม', 'ประกัน', 'เปิดไม่ติด'],
    action_type: 'tag',
    tag: 'บริการหลังการขาย',
    priority: 'urgent',
    reply_text: '',
    enabled: true,
  },
];

