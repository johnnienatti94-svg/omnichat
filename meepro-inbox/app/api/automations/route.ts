import { db, identity, result, logAudit, DEFAULT_ORG_ID } from '@/lib/inbox-server';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { routeInboundConversation } from '@/lib/routing-engine';
import { processInboundAutomations } from '@/lib/automations-engine';
import { defaultKeywordRules, type Channel, type AutomationsConfig } from '@/lib/inbox-data';
import { z } from 'zod';

const updateSchema = z.object({
  welcome_greeting_enabled: z.boolean(),
  welcome_greeting_text: z.string().trim().max(1000),
  off_hours_enabled: z.boolean(),
  off_hours_text: z.string().trim().max(1000),
  off_hours_schedule: z.object({
    start: z.string().regex(/^\d{2}:\d{2}$/),
    end: z.string().regex(/^\d{2}:\d{2}$/),
    days: z.array(z.number().min(0).max(6)),
  }),
  closing_message_enabled: z.boolean(),
  closing_message_text: z.string().trim().max(1000),
  routing_mode: z.enum(['round_robin', 'manual']),
  previous_agent_affinity: z.boolean(),
  keyword_rules: z.array(
    z.object({
      id: z.string(),
      name: z.string().trim().min(1).max(100),
      keywords: z.array(z.string().trim().min(1)),
      action_type: z.enum(['tag', 'reply', 'both']),
      tag: z.string().trim().max(60),
      priority: z.enum(['urgent', 'high', 'normal', 'low']).optional(),
      reply_text: z.string().trim().max(1000).optional(),
      enabled: z.boolean().optional(),
    })
  ),
});

const simulateSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  channel: z.enum(['facebook', 'instagram', 'tiktok']),
  test_time: z.string().optional(), // ISO string e.g. "2026-09-18T22:00:00Z"
  customer_id: z.string().optional(),
  is_first_message: z.boolean().optional(),
});

export async function GET(req: Request) {
  const owner = identity(req);
  if (!owner) return result({ error: 'Sign in to access settings.' }, 401);

  try {
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdmin();
      const { data: row } = await supabase
        .from('automations')
        .select('*')
        .eq('id', `config-${DEFAULT_ORG_ID}`)
        .maybeSingle();

      if (!row || !row.action) {
        const defaultConfig: AutomationsConfig = {
          org_id: DEFAULT_ORG_ID,
          welcome_greeting_enabled: true,
          welcome_greeting_text: 'สวัสดีครับ ยินดีต้อนรับสู่ MeePro Mobile & Accessories มีอะไรให้แอดมินช่วยดูแลแจ้งได้เลยครับ 😊',
          off_hours_enabled: true,
          off_hours_text: 'ขณะนี้อยู่นอกเวลาทำการ (เวลาทำการ 09:00 - 18:00 น.) แอดมินได้รับข้อความแล้วและจะรีบติดต่อกลับในเวลาทำการครับ 🙏',
          off_hours_schedule: { start: '09:00', end: '18:00', days: [1, 2, 3, 4, 5, 6] },
          closing_message_enabled: false,
          closing_message_text: 'ขอบคุณที่ติดต่อ MeePro ครับ หากมีข้อสงสัยเพิ่มเติมสามารถทักแชทได้ตลอดเวลาครับ ✨',
          routing_mode: 'round_robin',
          previous_agent_affinity: true,
          keyword_rules: defaultKeywordRules,
          updated_at: new Date().toISOString(),
        };
        return result({ config: defaultConfig });
      }

      const action = typeof row.action === 'string' ? JSON.parse(row.action) : row.action;
      return result({ config: { org_id: DEFAULT_ORG_ID, ...action, updated_at: row.updated_at } });
    }

    const d = db();
    const row = await d.prepare('SELECT * FROM automations WHERE org_id = ?').bind(DEFAULT_ORG_ID).first();

    if (!row) {
      const defaultConfig: AutomationsConfig = {
        org_id: DEFAULT_ORG_ID,
        welcome_greeting_enabled: true,
        welcome_greeting_text: 'สวัสดีครับ ยินดีต้อนรับสู่ MeePro Mobile & Accessories มีอะไรให้แอดมินช่วยดูแลแจ้งได้เลยครับ 😊',
        off_hours_enabled: true,
        off_hours_text: 'ขณะนี้อยู่นอกเวลาทำการ (เวลาทำการ 09:00 - 18:00 น.) แอดมินได้รับข้อความแล้วและจะรีบติดต่อกลับในเวลาทำการครับ 🙏',
        off_hours_schedule: { start: '09:00', end: '18:00', days: [1, 2, 3, 4, 5, 6] },
        closing_message_enabled: false,
        closing_message_text: 'ขอบคุณที่ติดต่อ MeePro ครับ หากมีข้อสงสัยเพิ่มเติมสามารถทักแชทได้ตลอดเวลาครับ ✨',
        routing_mode: 'round_robin',
        previous_agent_affinity: true,
        keyword_rules: defaultKeywordRules,
        updated_at: new Date().toISOString(),
      };
      return result({ config: defaultConfig });
    }

    const config: AutomationsConfig = {
      org_id: String(row.org_id),
      welcome_greeting_enabled: Boolean(row.welcome_greeting_enabled),
      welcome_greeting_text: String(row.welcome_greeting_text),
      off_hours_enabled: Boolean(row.off_hours_enabled),
      off_hours_text: String(row.off_hours_text),
      off_hours_schedule: typeof row.off_hours_schedule === 'string' ? JSON.parse(row.off_hours_schedule) : row.off_hours_schedule,
      closing_message_enabled: Boolean(row.closing_message_enabled),
      closing_message_text: String(row.closing_message_text),
      routing_mode: row.routing_mode as 'round_robin' | 'manual',
      previous_agent_affinity: Boolean(row.previous_agent_affinity),
      keyword_rules: typeof row.keyword_rules === 'string' ? JSON.parse(row.keyword_rules) : row.keyword_rules,
      updated_at: String(row.updated_at),
    };

    return result({ config });
  } catch (err: any) {
    return result({ error: err.message || 'Failed to retrieve automations config' }, 500);
  }
}

export async function PUT(req: Request) {
  const owner = identity(req);
  if (!owner) return result({ error: 'Sign in to modify automations.' }, 401);

  try {
    const parsed = updateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return result({ error: 'Invalid automations data', details: parsed.error.issues }, 400);
    }

    const data = parsed.data;
    const now = new Date().toISOString();

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdmin();
      await supabase.from('automations').upsert(
        {
          id: `config-${DEFAULT_ORG_ID}`,
          org_id: DEFAULT_ORG_ID,
          name: 'Master Automations Config',
          trigger_type: 'system_config',
          condition: {},
          action: data,
          is_active: true,
          updated_at: now,
        },
        { onConflict: 'id' }
      );

      await logAudit(DEFAULT_ORG_ID, owner, 'updated_automations_config', 'automations', DEFAULT_ORG_ID, {
        routing_mode: data.routing_mode,
        keyword_rules_count: data.keyword_rules.length,
        welcome_greeting: data.welcome_greeting_enabled,
        off_hours: data.off_hours_enabled,
      });

      return result({ ok: true, updated_at: now });
    }

    const d = db();
    await d
      .prepare(
        `INSERT INTO automations (
          org_id, welcome_greeting_enabled, welcome_greeting_text,
          off_hours_enabled, off_hours_text, off_hours_schedule,
          closing_message_enabled, closing_message_text,
          routing_mode, previous_agent_affinity, keyword_rules, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(org_id) DO UPDATE SET
          welcome_greeting_enabled = excluded.welcome_greeting_enabled,
          welcome_greeting_text = excluded.welcome_greeting_text,
          off_hours_enabled = excluded.off_hours_enabled,
          off_hours_text = excluded.off_hours_text,
          off_hours_schedule = excluded.off_hours_schedule,
          closing_message_enabled = excluded.closing_message_enabled,
          closing_message_text = excluded.closing_message_text,
          routing_mode = excluded.routing_mode,
          previous_agent_affinity = excluded.previous_agent_affinity,
          keyword_rules = excluded.keyword_rules,
          updated_at = excluded.updated_at`
      )
      .bind(
        DEFAULT_ORG_ID,
        data.welcome_greeting_enabled ? 1 : 0,
        data.welcome_greeting_text,
        data.off_hours_enabled ? 1 : 0,
        data.off_hours_text,
        JSON.stringify(data.off_hours_schedule),
        data.closing_message_enabled ? 1 : 0,
        data.closing_message_text,
        data.routing_mode,
        data.previous_agent_affinity ? 1 : 0,
        JSON.stringify(data.keyword_rules),
        now
      )
      .run();

    await logAudit(DEFAULT_ORG_ID, owner, 'updated_automations_config', 'automations', DEFAULT_ORG_ID, {
      routing_mode: data.routing_mode,
      keyword_rules_count: data.keyword_rules.length,
      welcome_greeting: data.welcome_greeting_enabled,
      off_hours: data.off_hours_enabled,
    });

    return result({ ok: true, updated_at: now });
  } catch (err: any) {
    return result({ error: err.message || 'Failed to save automations' }, 500);
  }
}

export async function POST(req: Request) {
  const owner = identity(req);
  if (!owner) return result({ error: 'Sign in to test automations.' }, 401);

  try {
    const parsed = simulateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return result({ error: 'Invalid simulation payload', details: parsed.error.issues }, 400);
    }

    const { message, channel, test_time, customer_id, is_first_message } = parsed.data;
    const testDate = test_time ? new Date(test_time) : new Date();
    let d: any = null;
    try {
      d = db();
    } catch {}

    // 1. Dry-run Routing Engine
    const routingResult = await routeInboundConversation({
      orgId: DEFAULT_ORG_ID,
      channel: channel as Channel,
      customerId: customer_id,
      d1: d,
      now: testDate,
    });

    // 2. Dry-run Automations Engine
    const automationResult = await processInboundAutomations({
      orgId: DEFAULT_ORG_ID,
      owner,
      conversationId: 'simulated-conv',
      messageBody: message,
      customerName: 'คุณทดสอบ',
      channel: channel as Channel,
      isFirstMessage: Boolean(is_first_message),
      d1: d,
      dryRun: true,
      now: testDate,
    });

    return result({
      simulation: {
        tested_message: message,
        tested_channel: channel,
        tested_time: testDate.toISOString(),
        routing: routingResult,
        automation: automationResult,
      },
    });
  } catch (err: any) {
    return result({ error: err.message || 'Simulation error' }, 500);
  }
}
