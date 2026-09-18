import type { Channel, AutomationsConfig, KeywordRule, CasePriority } from './inbox-data';
import { defaultKeywordRules } from './inbox-data';
import { parseTimeToMinutes } from './routing-engine';

export function isOrgWithinBusinessHours(
  schedule: { start: string; end: string; days: number[] },
  date = new Date()
): boolean {
  if (!schedule) return true;

  const utcOffsetMs = 7 * 60 * 60 * 1000;
  const bkkDate = new Date(date.getTime() + utcOffsetMs);
  const dayOfWeek = bkkDate.getUTCDay();

  if (schedule.days && !schedule.days.includes(dayOfWeek)) {
    return false;
  }

  const hours = bkkDate.getUTCHours();
  const minutes = bkkDate.getUTCMinutes();
  const currentMinutes = hours * 60 + minutes;

  const startMin = parseTimeToMinutes(schedule.start || '09:00');
  const endMin = parseTimeToMinutes(schedule.end || '18:00');

  return currentMinutes >= startMin && currentMinutes <= endMin;
}

export function findMatchingKeywordRule(
  text: string,
  rules: KeywordRule[]
): KeywordRule | null {
  const normalized = text.toLowerCase().trim();
  for (const rule of rules) {
    if (rule.enabled === false) continue;
    for (const kw of rule.keywords) {
      if (normalized.includes(kw.toLowerCase().trim())) {
        return rule;
      }
    }
  }
  return null;
}

export type AutomationActionResult = {
  appliedTag?: string;
  appliedPriority?: CasePriority;
  automatedReplies: {
    type: 'welcome' | 'off_hours' | 'keyword_rule' | 'closing';
    body: string;
  }[];
  matchedRule?: KeywordRule;
};

/**
 * Evaluates inbound message automations:
 * 1. Keyword matching for auto-tagging, priority adjustment, and instant FAQ auto-responses.
 * 2. Welcome greetings for first-time customer messages.
 * 3. Outside-hours automated responders when messages arrive after business hours.
 */
export async function processInboundAutomations(params: {
  orgId: string;
  owner: string;
  conversationId: string;
  messageBody: string;
  customerName?: string;
  channel: Channel;
  isFirstMessage?: boolean;
  d1?: any;
  now?: Date;
  overrideConfig?: Partial<AutomationsConfig>;
  dryRun?: boolean;
}): Promise<AutomationActionResult> {
  const { orgId, owner, conversationId, messageBody, customerName = 'ลูกค้า', d1, now = new Date() } = params;

  // 1. Fetch organization automations configuration
  let config: any = params.overrideConfig;
  if (!config && d1) {
    const row = await d1.prepare('SELECT * FROM automations WHERE org_id = ?').bind(orgId).first();
    if (row) {
      config = {
        ...row,
        welcome_greeting_enabled: Boolean(row.welcome_greeting_enabled),
        off_hours_enabled: Boolean(row.off_hours_enabled),
        closing_message_enabled: Boolean(row.closing_message_enabled),
        previous_agent_affinity: Boolean(row.previous_agent_affinity),
        off_hours_schedule: typeof row.off_hours_schedule === 'string' ? JSON.parse(row.off_hours_schedule) : row.off_hours_schedule,
        keyword_rules: typeof row.keyword_rules === 'string' ? JSON.parse(row.keyword_rules) : row.keyword_rules,
      };
    }
  }

  if (!config) {
    // Fallback defaults
    config = {
      org_id: orgId,
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
  }

  const result: AutomationActionResult = {
    automatedReplies: [],
  };

  const schedule = config.off_hours_schedule || { start: '09:00', end: '18:00', days: [1, 2, 3, 4, 5, 6] };
  const isWithinHours = isOrgWithinBusinessHours(schedule, now);

  // 2. Keyword Auto-Tagging & Rule Matching
  const rules: KeywordRule[] = Array.isArray(config.keyword_rules) && config.keyword_rules.length > 0
    ? config.keyword_rules
    : defaultKeywordRules;

  const matched = findMatchingKeywordRule(messageBody, rules);
  if (matched) {
    result.matchedRule = matched;
    if (matched.tag) {
      result.appliedTag = matched.tag;
    }
    if (matched.priority) {
      result.appliedPriority = matched.priority;
    }
    if ((matched.action_type === 'reply' || matched.action_type === 'both') && matched.reply_text) {
      const replyBody = matched.reply_text.replace('{{customer_name}}', customerName);
      result.automatedReplies.push({
        type: 'keyword_rule',
        body: replyBody,
      });
    }
  }

  // 3. Off-Hours Auto-Responder (Triggered when outside business hours)
  if (!isWithinHours && config.off_hours_enabled && config.off_hours_text) {
    const offHoursMsg = config.off_hours_text.replace('{{customer_name}}', customerName);
    result.automatedReplies.push({
      type: 'off_hours',
      body: offHoursMsg,
    });
  }
  // 4. Welcome Greeting (First-time inbound message, only if within hours or off-hours wasn't sent)
  else if (params.isFirstMessage && config.welcome_greeting_enabled && config.welcome_greeting_text) {
    const welcomeMsg = config.welcome_greeting_text.replace('{{customer_name}}', customerName);
    result.automatedReplies.push({
      type: 'welcome',
      body: welcomeMsg,
    });
  }

  // 5. Execute DB persistence for automated messages and updates if d1 is provided and not in dryRun mode
  if (d1 && !params.dryRun) {
    const nowIso = now.toISOString();
    const batchQueries: any[] = [];

    // Persist automated replies as bot messages
    for (let i = 0; i < result.automatedReplies.length; i++) {
      const reply = result.automatedReplies[i];
      const botMsgId = `bot-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`;
      batchQueries.push(
        d1.prepare(
          `INSERT INTO messages (owner, id, conversation_id, body, direction, attachments, external_id, delivery_status, created_at)
           VALUES (?, ?, ?, ?, 'out', '[]', '', 'automated', ?)`
        ).bind(owner, botMsgId, conversationId, reply.body, nowIso)
      );
    }

    // Persist tag or priority updates to conversation
    const updates: string[] = [];
    const paramsList: any[] = [];
    if (result.appliedTag) {
      updates.push('tag = ?');
      paramsList.push(result.appliedTag);
    }
    if (result.appliedPriority) {
      updates.push('priority = ?');
      paramsList.push(result.appliedPriority);
    }

    if (updates.length > 0) {
      updates.push('updated_at = ?');
      paramsList.push(nowIso);
      paramsList.push(owner);
      paramsList.push(conversationId);

      batchQueries.push(
        d1.prepare(`UPDATE conversations SET ${updates.join(', ')} WHERE owner = ? AND id = ?`).bind(...paramsList)
      );
    }

    if (batchQueries.length > 0) {
      await d1.batch(batchQueries);
    }
  }

  return result;
}
