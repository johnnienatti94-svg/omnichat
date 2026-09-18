import { getSupabaseAdmin } from '../supabase/server';
import {
  demoConversations,
  defaultReplies,
  defaultStaff,
  type Conversation,
  type QuickReply,
  type StaffUser,
  type ChannelConnection,
  type Message,
} from '../inbox-data';

export const DEFAULT_ORG_ID = 'org_meepro';

/**
 * Seeds initial workspace data into Supabase if not yet initialized for this owner.
 */
export async function seedWorkspace(owner: string) {
  const supabase = getSupabaseAdmin();

  // Check if owner is already initialized
  const { data: initData } = await supabase
    .from('initialized')
    .select('owner')
    .eq('owner', owner)
    .single();

  if (initData) return;

  const now = new Date().toISOString();

  // 1. Seed Organization
  await supabase.from('organizations').upsert(
    {
      id: DEFAULT_ORG_ID,
      name: 'MeePro Mobile & Accessories',
      slug: 'meepro',
      created_at: now,
    },
    { onConflict: 'id' }
  );

  // 2. Seed Staff Users
  const staffRows = defaultStaff.map((s) => ({
    id: s.id,
    org_id: DEFAULT_ORG_ID,
    name: s.name,
    email: s.email,
    role: s.role,
    channel_access: s.channel_access,
    working_hours: s.working_hours,
    created_at: s.created_at,
  }));
  await supabase.from('users').upsert(staffRows, { onConflict: 'id' });

  // 3. Seed Teams
  await supabase.from('teams').upsert(
    [
      {
        id: 'team-sales',
        org_id: DEFAULT_ORG_ID,
        name: 'Sales Team (ทีมขาย)',
        leader_id: 'user-admin',
        created_at: now,
      },
      {
        id: 'team-support',
        org_id: DEFAULT_ORG_ID,
        name: 'Customer Support (บริการหลังการขาย)',
        leader_id: 'user-sup',
        created_at: now,
      },
    ],
    { onConflict: 'id' }
  );

  // 4. Seed Channel Connections
  await supabase.from('channel_connections').upsert(
    [
      {
        id: 'conn-fb',
        org_id: DEFAULT_ORG_ID,
        channel: 'facebook',
        name: 'MeePro Official Facebook Page',
        account_id: 'meepro.official',
        status: 'active',
        credentials_encrypted: '',
        webhook_secret: '',
        created_at: now,
      },
      {
        id: 'conn-ig',
        org_id: DEFAULT_ORG_ID,
        channel: 'instagram',
        name: 'MeePro Store IG',
        account_id: 'meepro_store',
        status: 'active',
        credentials_encrypted: '',
        webhook_secret: '',
        created_at: now,
      },
      {
        id: 'conn-tiktok',
        org_id: DEFAULT_ORG_ID,
        channel: 'tiktok',
        name: 'MeePro TikTok Shop TH',
        account_id: 'meepro_tiktok_shop',
        status: 'active',
        credentials_encrypted: '',
        webhook_secret: '',
        created_at: now,
      },
    ],
    { onConflict: 'id' }
  );

  // 5. Seed Conversations & Messages
  const conversations = demoConversations();
  const convRows: any[] = [];
  const custRows: any[] = [];
  const identRows: any[] = [];
  const msgRows: any[] = [];

  for (const c of conversations) {
    convRows.push({
      id: c.id,
      owner,
      name: c.name,
      channel: c.channel,
      handle: c.handle,
      status: c.status,
      assignee: c.assignee,
      tag: c.tag,
      notes: c.notes,
      priority: c.priority || 'normal',
      issue_type: c.issue_type || '',
      resolution: c.resolution || '',
      sales_amount: c.sales_amount || 0,
      sales_successful: Boolean(c.sales_successful),
      closed_at: c.status === 'closed' ? c.updated_at : null,
      closed_by: c.status === 'closed' ? 'user-sup' : null,
      customer_id: `cust-${c.id}`,
      updated_at: c.updated_at,
    });

    custRows.push({
      id: `cust-${c.id}`,
      org_id: DEFAULT_ORG_ID,
      name: c.name,
      phone: '',
      email: '',
      notes: c.notes,
      tags: [c.tag],
      created_at: now,
      updated_at: now,
    });

    identRows.push({
      id: `ident-${c.id}`,
      org_id: DEFAULT_ORG_ID,
      customer_id: `cust-${c.id}`,
      channel: c.channel,
      external_id: `ext-${c.handle}`,
      handle: c.handle,
      created_at: now,
    });

    for (const m of c.messages) {
      msgRows.push({
        id: m.id,
        owner,
        conversation_id: m.conversation_id,
        body: m.body,
        direction: m.direction,
        attachments: m.attachments || [],
        external_id: m.external_id || '',
        delivery_status: m.delivery_status || 'delivered',
        created_at: m.created_at,
      });
    }
  }

  await supabase.from('customers').upsert(custRows, { onConflict: 'id' });
  await supabase.from('customer_identities').upsert(identRows, { onConflict: 'channel, external_id' });
  await supabase.from('conversations').upsert(convRows, { onConflict: 'id' });
  await supabase.from('messages').upsert(msgRows, { onConflict: 'id' });

  // 6. Seed Saved Replies
  const replyRows = defaultReplies.map((r) => ({
    id: r.id,
    owner,
    title: r.title,
    body: r.body,
  }));
  await supabase.from('replies').upsert(replyRows, { onConflict: 'id' });

  // 7. Seed Initial Automations
  await supabase.from('automations').upsert(
    [
      {
        id: 'auto-welcome',
        org_id: DEFAULT_ORG_ID,
        name: 'ข้อความต้อนรับลูกค้าใหม่ (Welcome Greeting)',
        trigger_type: 'first_inbound',
        condition: { channel: 'all' },
        action: { send_message: 'สวัสดีค่ะ ร้าน MeePro ยินดีให้บริการค่ะ มีอะไรให้แอดมินช่วยดูแลแจ้งได้เลยนะคะ 🙏' },
        is_active: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: 'auto-offhours',
        org_id: DEFAULT_ORG_ID,
        name: 'ตอบกลับนอกเวลาทำการ (Outside Hours Auto-Responder)',
        trigger_type: 'outside_hours',
        condition: { channel: 'all' },
        action: { send_message: 'ขณะนี้นอกเวลาทำการ (09:00 - 18:00 น.) ข้อความของท่านถูกบันทึกในระบบแล้ว แอดมินจะรีบติดต่อกลับในเวลาทำการค่ะ ✨' },
        is_active: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: 'auto-tag-installments',
        org_id: DEFAULT_ORG_ID,
        name: 'ติดแท็กสนใจผ่อนชำระ (Auto-Tag Installments)',
        trigger_type: 'keyword',
        condition: { keywords: ['ผ่อน', 'ดอกเบี้ย', 'งวด', 'บัตรเครดิต', 'ดาวน์'] },
        action: { apply_tag: 'ผ่อนชำระ', set_priority: 'high' },
        is_active: true,
        created_at: now,
        updated_at: now,
      },
    ],
    { onConflict: 'id' }
  );

  // 8. Initial Audit Log
  await logAudit(
    DEFAULT_ORG_ID,
    owner,
    'workspace_initialized',
    'organization',
    DEFAULT_ORG_ID,
    { owner, provider: 'supabase', initialized_at: now }
  );

  // Mark initialized
  await supabase.from('initialized').upsert({ owner }, { onConflict: 'owner' });
}

/**
 * Loads all workspace resources for a given owner.
 */
export async function getWorkspaceData(owner: string) {
  const supabase = getSupabaseAdmin();

  const [
    convRes,
    msgRes,
    replyRes,
    setupRes,
    userRes,
    teamRes,
    connRes,
  ] = await Promise.all([
    supabase
      .from('conversations')
      .select('*')
      .eq('owner', owner)
      .order('updated_at', { ascending: false }),
    supabase
      .from('messages')
      .select('*')
      .eq('owner', owner)
      .order('created_at', { ascending: true }),
    supabase.from('replies').select('*').eq('owner', owner).order('title', { ascending: true }),
    supabase.from('channel_setup').select('*').eq('owner', owner),
    supabase.from('users').select('*').eq('org_id', DEFAULT_ORG_ID).order('created_at', { ascending: true }),
    supabase.from('teams').select('*').eq('org_id', DEFAULT_ORG_ID).order('created_at', { ascending: true }),
    supabase
      .from('channel_connections')
      .select('id, org_id, channel, name, account_id, status, created_at')
      .eq('org_id', DEFAULT_ORG_ID),
  ]);

  if (convRes.error) throw convRes.error;

  const messagesByConv: Record<string, any[]> = {};
  for (const m of msgRes.data || []) {
    let attachments = [];
    try {
      attachments = typeof m.attachments === 'string' ? JSON.parse(m.attachments) : m.attachments || [];
    } catch {
      attachments = [];
    }
    const cleanMsg = { ...m, attachments };
    if (!messagesByConv[m.conversation_id]) {
      messagesByConv[m.conversation_id] = [];
    }
    messagesByConv[m.conversation_id].push(cleanMsg);
  }

  const conversations = (convRes.data || []).map((c) => ({
    ...c,
    sales_amount: Number(c.sales_amount) || 0,
    sales_successful: Boolean(c.sales_successful),
    messages: messagesByConv[c.id] || [],
  }));

  // Sanitize connections: ensure token/secret fields are not returned
  const connections = (connRes.data || []).map((conn) => ({
    ...conn,
    access_token: '',
    app_secret: '',
  }));

  return {
    conversations,
    replies: replyRes.data || [],
    setup: setupRes.data || [],
    users: userRes.data || [],
    teams: teamRes.data || [],
    connections,
  };
}

/**
 * Executes a ticket action or updates a conversation/reply in Supabase.
 */
export async function executeAction(owner: string, p: any) {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  if (p.action === 'reply') {
    // Check if conversation exists
    const { data: conv } = await supabase
      .from('conversations')
      .select('*')
      .eq('owner', owner)
      .eq('id', p.id)
      .single();

    if (!conv) throw new Error('Conversation not found');

    // Auto-reopen if closed within window
    let newStatus = conv.status;
    let closedAt = conv.closed_at;
    let closedBy = conv.closed_by;

    if (conv.status === 'closed' && p.direction === 'in') {
      newStatus = 'open';
      closedAt = null;
      closedBy = null;
    }

    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const attachments = p.attachments || [];

    // Insert message
    await supabase.from('messages').insert({
      id: messageId,
      conversation_id: p.id,
      owner,
      body: p.body,
      direction: p.direction,
      attachments,
      delivery_status: 'delivered',
      created_at: now,
    });

    // Update conversation
    await supabase
      .from('conversations')
      .update({
        status: newStatus,
        closed_at: closedAt,
        closed_by: closedBy,
        updated_at: now,
      })
      .eq('owner', owner)
      .eq('id', p.id);

    return { success: true, messageId };
  }

  if (p.action === 'update') {
    const updatePayload: Record<string, any> = { updated_at: now };
    if (p.status !== undefined) updatePayload.status = p.status;
    if (p.assignee !== undefined) updatePayload.assignee = p.assignee;
    if (p.tag !== undefined) updatePayload.tag = p.tag;
    if (p.notes !== undefined) updatePayload.notes = p.notes;
    if (p.priority !== undefined) updatePayload.priority = p.priority;
    if (p.issue_type !== undefined) updatePayload.issue_type = p.issue_type;
    if (p.resolution !== undefined) updatePayload.resolution = p.resolution;
    if (p.sales_amount !== undefined) updatePayload.sales_amount = p.sales_amount;
    if (p.sales_successful !== undefined) updatePayload.sales_successful = p.sales_successful;

    if (p.status === 'closed') {
      updatePayload.closed_at = now;
      updatePayload.closed_by = owner;
    } else if (p.status === 'open') {
      updatePayload.closed_at = null;
      updatePayload.closed_by = null;
    }

    const { error } = await supabase
      .from('conversations')
      .update(updatePayload)
      .eq('owner', owner)
      .eq('id', p.id);

    if (error) throw error;
    return { success: true };
  }

  if (p.action === 'resolveWithSales') {
    const { error } = await supabase
      .from('conversations')
      .update({
        status: 'closed',
        sales_amount: p.sales_amount,
        sales_successful: p.sales_successful,
        resolution: p.resolution,
        issue_type: p.issue_type,
        closed_at: now,
        closed_by: owner,
        updated_at: now,
      })
      .eq('owner', owner)
      .eq('id', p.id);

    if (error) throw error;

    await logAudit(
      DEFAULT_ORG_ID,
      owner,
      'resolve_sales_success',
      'conversation',
      p.id,
      {
        sales_amount: p.sales_amount,
        sales_successful: p.sales_successful,
        resolution: p.resolution,
        issue_type: p.issue_type,
      }
    );

    return { success: true };
  }

  if (p.action === 'saveReply') {
    const { error } = await supabase.from('replies').upsert(
      {
        id: p.id,
        owner,
        title: p.title,
        body: p.body,
      },
      { onConflict: 'id' }
    );
    if (error) throw error;
    return { success: true };
  }

  if (p.action === 'setup') {
    const { error } = await supabase.from('channel_setup').upsert(
      {
        channel: p.channel,
        owner,
        account: p.account,
        url: p.url,
      },
      { onConflict: 'channel, owner' }
    );
    if (error) throw error;
    return { success: true };
  }

  throw new Error(`Unknown action: ${p.action}`);
}

/**
 * Records an entry into the immutable audit trail.
 */
export async function logAudit(
  orgId: string,
  userId: string,
  action: string,
  targetType: string,
  targetId: string,
  details: Record<string, unknown>
) {
  try {
    const supabase = getSupabaseAdmin();
    const id = `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    await supabase.from('audit_logs').insert({
      id,
      org_id: orgId,
      user_id: userId,
      action,
      target_type: targetType,
      target_id: targetId,
      details,
      created_at: now,
    });
  } catch (err) {
    console.error('Failed to log audit event to Supabase:', err);
  }
}

/**
 * Retrieves audit logs for an organization.
 */
export async function getAuditLogs(orgId: string, limit = 100) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

/**
 * Retrieves all staff users and teams for an organization.
 */
export async function getTeamsAndUsers(orgId: string) {
  const supabase = getSupabaseAdmin();
  const [usersRes, teamsRes] = await Promise.all([
    supabase.from('users').select('*').eq('org_id', orgId).order('created_at', { ascending: true }),
    supabase.from('teams').select('*').eq('org_id', orgId).order('created_at', { ascending: true }),
  ]);

  if (usersRes.error) throw usersRes.error;
  if (teamsRes.error) throw teamsRes.error;

  return {
    users: usersRes.data || [],
    teams: teamsRes.data || [],
  };
}

/**
 * Updates a staff user in Supabase.
 */
export async function updateUser(userId: string, updates: Partial<StaffUser>) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Creates a new staff user in Supabase.
 */
export async function createUser(user: Omit<StaffUser, 'created_at'>) {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('users')
    .insert({ ...user, created_at: now })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Retrieves all automations for an organization.
 */
export async function getAutomations(orgId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('automations')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Saves or updates an automation rule.
 */
export async function saveAutomation(orgId: string, rule: any) {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const id = rule.id || `auto-${Date.now()}`;

  const { data, error } = await supabase
    .from('automations')
    .upsert(
      {
        id,
        org_id: orgId,
        name: rule.name,
        trigger_type: rule.trigger_type,
        condition: rule.condition || {},
        action: rule.action || {},
        is_active: rule.is_active !== undefined ? rule.is_active : true,
        updated_at: now,
      },
      { onConflict: 'id' }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}
