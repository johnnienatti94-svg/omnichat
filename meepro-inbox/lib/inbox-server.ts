import { isSupabaseConfigured } from './supabase/client';
import * as supabaseRepo from './db/supabase-repository';
import {
  demoConversations,
  defaultReplies,
  defaultStaff,
  type Conversation,
  type QuickReply,
  type StaffUser,
  type ChannelConnection,
} from './inbox-data';

export const DEFAULT_ORG_ID = 'org_meepro';

export function identity(req: Request) {
  return req.headers.get('oai-authenticated-user-id');
}

/**
 * Accesses Cloudflare D1 if available in runtime context.
 */
export function db() {
  try {
    const globalContext = globalThis as any;
    if (globalContext.env?.DB) return globalContext.env.DB;
    if (globalContext.process?.env?.DB) return globalContext.process.env.DB;
  } catch {}
  
  if (isSupabaseConfigured()) {
    // When Supabase is configured, legacy direct D1 queries should not be called
    throw new Error('Using Supabase database. Please use repository methods.');
  }

  throw new Error('Workspace storage unavailable. Please configure Supabase or Cloudflare D1.');
}

/**
 * Initializes workspace seed data for an owner.
 */
export async function seed(owner: string) {
  if (isSupabaseConfigured()) {
    return await supabaseRepo.seedWorkspace(owner);
  }

  // Cloudflare D1 Fallback
  const d = db();
  if (await d.prepare('SELECT owner FROM initialized WHERE owner=?').bind(owner).first()) return;

  const now = new Date().toISOString();
  const q: any[] = [];

  // 1. Seed Organization
  q.push(
    d.prepare(
      'INSERT OR IGNORE INTO organizations (id, name, slug, created_at) VALUES (?, ?, ?, ?)'
    ).bind(DEFAULT_ORG_ID, 'MeePro Mobile & Accessories', 'meepro', now)
  );

  // 2. Seed Staff Users
  for (const s of defaultStaff) {
    q.push(
      d.prepare(
        'INSERT OR IGNORE INTO users (id, org_id, name, email, role, channel_access, working_hours, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(
        s.id,
        DEFAULT_ORG_ID,
        s.name,
        s.email,
        s.role,
        JSON.stringify(s.channel_access),
        JSON.stringify(s.working_hours),
        s.created_at
      )
    );
  }

  // 3. Seed Teams
  q.push(
    d.prepare(
      'INSERT OR IGNORE INTO teams (id, org_id, name, leader_id, created_at) VALUES (?, ?, ?, ?, ?)'
    ).bind('team-sales', DEFAULT_ORG_ID, 'Sales Team (ทีมขาย)', 'user-admin', now),
    d.prepare(
      'INSERT OR IGNORE INTO teams (id, org_id, name, leader_id, created_at) VALUES (?, ?, ?, ?, ?)'
    ).bind('team-support', DEFAULT_ORG_ID, 'Customer Support (บริการหลังการขาย)', 'user-sup', now)
  );

  // 4. Seed Channel Connections
  const channels = [
    { id: 'conn-fb', channel: 'facebook', name: 'MeePro Official Facebook Page', acc: 'meepro.official' },
    { id: 'conn-ig', channel: 'instagram', name: 'MeePro Store IG', acc: 'meepro_store' },
    { id: 'conn-tiktok', channel: 'tiktok', name: 'MeePro TikTok Shop TH', acc: 'meepro_tiktok_shop' },
  ];
  for (const ch of channels) {
    q.push(
      d.prepare(
        'INSERT OR IGNORE INTO channel_connections (id, org_id, channel, name, account_id, status, credentials_encrypted, webhook_secret, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(ch.id, DEFAULT_ORG_ID, ch.channel, ch.name, ch.acc, 'demo', '', '', now)
    );
  }

  // 5. Seed Conversations & Messages
  for (const c of demoConversations()) {
    q.push(
      d.prepare(
        `INSERT OR IGNORE INTO conversations (
          owner, id, name, channel, handle, status, assignee, tag, notes,
          priority, issue_type, resolution, sales_amount, sales_successful, closed_at, closed_by, customer_id, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        owner,
        c.id,
        c.name,
        c.channel,
        c.handle,
        c.status,
        c.assignee,
        c.tag,
        c.notes,
        c.priority || 'normal',
        c.issue_type || '',
        c.resolution || '',
        c.sales_amount || 0,
        c.sales_successful ? 1 : 0,
        c.status === 'closed' ? c.updated_at : '',
        c.status === 'closed' ? 'user-sup' : '',
        `cust-${c.id}`,
        c.updated_at
      )
    );

    q.push(
      d.prepare(
        'INSERT OR IGNORE INTO customers (id, org_id, name, phone, email, notes, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(`cust-${c.id}`, DEFAULT_ORG_ID, c.name, '', '', c.notes, JSON.stringify([c.tag]), now, now)
    );

    q.push(
      d.prepare(
        'INSERT OR IGNORE INTO customer_identities (id, org_id, customer_id, channel, external_id, handle, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).bind(`ident-${c.id}`, DEFAULT_ORG_ID, `cust-${c.id}`, c.channel, `ext-${c.handle}`, c.handle, now)
    );

    for (const m of c.messages) {
      q.push(
        d.prepare(
          'INSERT OR IGNORE INTO messages (owner, id, conversation_id, body, direction, attachments, external_id, delivery_status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(
          owner,
          m.id,
          m.conversation_id,
          m.body,
          m.direction,
          JSON.stringify(m.attachments || []),
          m.external_id || '',
          m.delivery_status || 'delivered',
          m.created_at
        )
      );
    }
  }

  // 6. Seed Saved Replies
  for (const r of defaultReplies) {
    q.push(
      d.prepare('INSERT OR IGNORE INTO replies (owner, id, title, body) VALUES (?, ?, ?, ?)').bind(
        owner,
        r.id,
        r.title,
        r.body
      )
    );
  }

  // 7. Initial Audit Log
  q.push(
    d.prepare(
      'INSERT OR IGNORE INTO audit_logs (id, org_id, user_id, action, target_type, target_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      `audit-init-${owner}`,
      DEFAULT_ORG_ID,
      owner,
      'workspace_initialized',
      'organization',
      DEFAULT_ORG_ID,
      JSON.stringify({ owner, initialized_at: now }),
      now
    )
  );

  q.push(d.prepare('INSERT OR IGNORE INTO initialized (owner) VALUES (?)').bind(owner));
  await d.batch(q);
}

/**
 * Loads all workspace resources for a given owner.
 */
export async function getWorkspace(owner: string) {
  if (isSupabaseConfigured()) {
    return await supabaseRepo.getWorkspaceData(owner);
  }

  // Cloudflare D1 Fallback
  const d = db();
  const [c, m, r, s, u, t, conn] = await Promise.all([
    d
      .prepare(
        `SELECT id, name, channel, handle, status, assignee, tag, notes,
                priority, issue_type, resolution, sales_amount, sales_successful,
                closed_at, closed_by, customer_id, updated_at
         FROM conversations
         WHERE owner = ?
         ORDER BY updated_at DESC`
      )
      .bind(owner)
      .all(),
    d
      .prepare(
        `SELECT id, conversation_id, body, direction, attachments, external_id, delivery_status, created_at
         FROM messages
         WHERE owner = ?
         ORDER BY created_at, id`
      )
      .bind(owner)
      .all(),
    d.prepare('SELECT id, title, body FROM replies WHERE owner = ? ORDER BY title').bind(owner).all(),
    d.prepare('SELECT channel, account, url FROM channel_setup WHERE owner = ?').bind(owner).all(),
    d
      .prepare('SELECT id, org_id, name, email, role, channel_access, working_hours, created_at FROM users WHERE org_id = ?')
      .bind(DEFAULT_ORG_ID)
      .all(),
    d.prepare('SELECT id, org_id, name, leader_id, created_at FROM teams WHERE org_id = ?').bind(DEFAULT_ORG_ID).all(),
    d
      .prepare('SELECT id, org_id, channel, name, account_id, status, created_at FROM channel_connections WHERE org_id = ?')
      .bind(DEFAULT_ORG_ID)
      .all(),
  ]);

  const conversations = c.results.map((conv: any) => ({
    ...conv,
    sales_successful: Boolean(conv.sales_successful),
    messages: m.results
      .filter((msg: any) => msg.conversation_id === conv.id)
      .map((msg: any) => {
        let attachments = [];
        try {
          attachments = typeof msg.attachments === 'string' ? JSON.parse(msg.attachments) : msg.attachments || [];
        } catch {
          attachments = [];
        }
        return {
          ...msg,
          attachments,
        };
      }),
  }));

  const users = u.results.map((user: any) => {
    let channel_access = 'all';
    let working_hours = { enabled: false, start: '09:00', end: '18:00', days: [1, 2, 3, 4, 5] };
    try {
      channel_access = JSON.parse(user.channel_access);
    } catch {}
    try {
      working_hours = JSON.parse(user.working_hours);
    } catch {}
    return {
      ...user,
      channel_access,
      working_hours,
    };
  });

  const connections = conn.results.map((con: any) => ({
    ...con,
    access_token: '',
    app_secret: '',
  }));

  return {
    conversations,
    replies: r.results,
    setup: s.results,
    users,
    teams: t.results,
    connections,
  };
}

/**
 * Records an immutable audit event.
 */
export async function logAudit(
  orgId: string,
  userId: string,
  action: string,
  targetType: string,
  targetId: string,
  details: Record<string, unknown>
) {
  if (isSupabaseConfigured()) {
    return await supabaseRepo.logAudit(orgId, userId, action, targetType, targetId, details);
  }

  try {
    const d = db();
    const id = `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    await d.prepare(
      'INSERT INTO audit_logs (id, org_id, user_id, action, target_type, target_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(id, orgId, userId, action, targetType, targetId, JSON.stringify(details), now).run();
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}

/**
 * Executes an action against the database.
 */
export async function executeAction(owner: string, actionData: any) {
  if (isSupabaseConfigured()) {
    return await supabaseRepo.executeAction(owner, actionData);
  }
  return null;
}

export function result(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}
