import { sqliteTable, text, integer, real, primaryKey, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const organizations = sqliteTable('organizations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  created_at: text('created_at').notNull(),
});

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  org_id: text('org_id').notNull().references(() => organizations.id),
  name: text('name').notNull(),
  email: text('email').notNull(),
  role: text('role').notNull().default('agent'), // 'admin' | 'supervisor' | 'agent'
  channel_access: text('channel_access').notNull().default('all'), // 'all' or JSON array e.g. ["facebook","instagram"]
  working_hours: text('working_hours').notNull().default('{"enabled":false,"start":"09:00","end":"18:00","days":[1,2,3,4,5]}'),
  created_at: text('created_at').notNull(),
}, (t) => [
  index('idx_users_org').on(t.org_id),
  uniqueIndex('idx_users_org_email').on(t.org_id, t.email),
]);

export const teams = sqliteTable('teams', {
  id: text('id').primaryKey(),
  org_id: text('org_id').notNull().references(() => organizations.id),
  name: text('name').notNull(),
  leader_id: text('leader_id').notNull().default(''),
  created_at: text('created_at').notNull(),
}, (t) => [
  index('idx_teams_org').on(t.org_id),
]);

export const teamMembers = sqliteTable('team_members', {
  team_id: text('team_id').notNull().references(() => teams.id),
  user_id: text('user_id').notNull().references(() => users.id),
  role: text('role').notNull().default('member'), // 'lead' | 'member'
  joined_at: text('joined_at').notNull(),
}, (t) => [
  primaryKey({ columns: [t.team_id, t.user_id] }),
]);

export const channelConnections = sqliteTable('channel_connections', {
  id: text('id').primaryKey(),
  org_id: text('org_id').notNull().references(() => organizations.id),
  channel: text('channel').notNull(), // 'facebook' | 'instagram' | 'tiktok' | 'line'
  name: text('name').notNull(),
  account_id: text('account_id').notNull().default(''),
  status: text('status').notNull().default('demo'), // 'connected' | 'disconnected' | 'demo'
  credentials_encrypted: text('credentials_encrypted').notNull().default(''),
  webhook_secret: text('webhook_secret').notNull().default(''),
  created_at: text('created_at').notNull(),
}, (t) => [
  index('idx_channel_conn_org').on(t.org_id),
]);

export const customers = sqliteTable('customers', {
  id: text('id').primaryKey(),
  org_id: text('org_id').notNull().references(() => organizations.id),
  name: text('name').notNull(),
  phone: text('phone').notNull().default(''),
  email: text('email').notNull().default(''),
  notes: text('notes').notNull().default(''),
  tags: text('tags').notNull().default('[]'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
}, (t) => [
  index('idx_customers_org').on(t.org_id),
]);

export const customerIdentities = sqliteTable('customer_identities', {
  id: text('id').primaryKey(),
  org_id: text('org_id').notNull().references(() => organizations.id),
  customer_id: text('customer_id').notNull().references(() => customers.id),
  channel: text('channel').notNull(),
  external_id: text('external_id').notNull(),
  handle: text('handle').notNull().default(''),
  created_at: text('created_at').notNull(),
}, (t) => [
  index('idx_identities_customer').on(t.customer_id),
  uniqueIndex('idx_identities_channel_external').on(t.org_id, t.channel, t.external_id),
]);

export const conversations = sqliteTable('conversations', {
  owner: text('owner').notNull(),
  id: text('id').notNull(),
  name: text('name').notNull(),
  channel: text('channel').notNull(),
  handle: text('handle').notNull(),
  status: text('status').notNull().default('open'),
  assignee: text('assignee').notNull().default(''),
  tag: text('tag').notNull().default(''),
  notes: text('notes').notNull().default(''),
  priority: text('priority').notNull().default('normal'), // 'urgent' | 'high' | 'normal' | 'low'
  issue_type: text('issue_type').notNull().default(''),
  resolution: text('resolution').notNull().default(''),
  sales_amount: real('sales_amount').notNull().default(0),
  sales_successful: integer('sales_successful').notNull().default(0),
  closed_at: text('closed_at').notNull().default(''),
  closed_by: text('closed_by').notNull().default(''),
  customer_id: text('customer_id').notNull().default(''),
  updated_at: text('updated_at').notNull(),
}, (t) => [
  primaryKey({ columns: [t.owner, t.id] }),
  index('idx_conversations_owner_status').on(t.owner, t.status),
]);

export const messages = sqliteTable('messages', {
  owner: text('owner').notNull(),
  id: text('id').notNull(),
  conversation_id: text('conversation_id').notNull(),
  body: text('body').notNull(),
  direction: text('direction').notNull(),
  attachments: text('attachments').notNull().default('[]'),
  external_id: text('external_id').notNull().default(''),
  delivery_status: text('delivery_status').notNull().default('delivered'),
  created_at: text('created_at').notNull(),
}, (t) => [
  primaryKey({ columns: [t.owner, t.id] }),
  index('idx_messages_owner_conversation').on(t.owner, t.conversation_id),
]);

export const replies = sqliteTable('replies', {
  owner: text('owner').notNull(),
  id: text('id').notNull(),
  title: text('title').notNull(),
  body: text('body').notNull(),
}, (t) => [
  primaryKey({ columns: [t.owner, t.id] }),
]);

export const setup = sqliteTable('channel_setup', {
  owner: text('owner').notNull(),
  channel: text('channel').notNull(),
  account: text('account').notNull(),
  url: text('url').notNull(),
}, (t) => [
  primaryKey({ columns: [t.owner, t.channel] }),
]);

export const auditLogs = sqliteTable('audit_logs', {
  id: text('id').primaryKey(),
  org_id: text('org_id').notNull(),
  user_id: text('user_id').notNull(),
  action: text('action').notNull(),
  target_type: text('target_type').notNull(),
  target_id: text('target_id').notNull(),
  details: text('details').notNull().default('{}'),
  created_at: text('created_at').notNull(),
}, (t) => [
  index('idx_audit_logs_org').on(t.org_id),
  index('idx_audit_logs_created').on(t.created_at),
]);

export const automations = sqliteTable('automations', {
  org_id: text('org_id').primaryKey().references(() => organizations.id),
  welcome_greeting_enabled: integer('welcome_greeting_enabled').notNull().default(1),
  welcome_greeting_text: text('welcome_greeting_text').notNull().default('สวัสดีครับ ยินดีต้อนรับสู่ MeePro Mobile & Accessories มีอะไรให้แอดมินช่วยดูแลแจ้งได้เลยครับ 😊'),
  off_hours_enabled: integer('off_hours_enabled').notNull().default(1),
  off_hours_text: text('off_hours_text').notNull().default('ขณะนี้อยู่นอกเวลาทำการ (เวลาทำการ 09:00 - 18:00 น.) แอดมินได้รับข้อความแล้วและจะรีบติดต่อกลับในเวลาทำการครับ 🙏'),
  off_hours_schedule: text('off_hours_schedule').notNull().default('{"start":"09:00","end":"18:00","days":[1,2,3,4,5,6]}'),
  closing_message_enabled: integer('closing_message_enabled').notNull().default(0),
  closing_message_text: text('closing_message_text').notNull().default('ขอบคุณที่ติดต่อ MeePro ครับ หากมีข้อสงสัยเพิ่มเติมสามารถทักแชทได้ตลอดเวลาครับ ✨'),
  routing_mode: text('routing_mode').notNull().default('round_robin'), // 'round_robin' | 'manual'
  previous_agent_affinity: integer('previous_agent_affinity').notNull().default(1),
  keyword_rules: text('keyword_rules').notNull().default('[]'),
  updated_at: text('updated_at').notNull(),
});

export const initialized = sqliteTable('initialized', {
  owner: text('owner').primaryKey(),
});

