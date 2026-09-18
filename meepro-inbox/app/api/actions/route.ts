import { db, identity, result, logAudit, executeAction, DEFAULT_ORG_ID } from '@/lib/inbox-server';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { isWithinReopenWindow } from '@/lib/ticket-lifecycle';
import { routeInboundConversation } from '@/lib/routing-engine';
import { processInboundAutomations } from '@/lib/automations-engine';
import type { Channel } from '@/lib/inbox-data';
import { z } from 'zod';

const schema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('reply'),
    id: z.string().max(100),
    body: z.string().trim().min(1).max(4000),
    direction: z.enum(['out', 'note', 'in']),
    requestId: z.string().uuid(),
    attachments: z
      .array(
        z.object({
          id: z.string(),
          type: z.enum(['image', 'video', 'file']),
          url: z.string(),
          name: z.string(),
          size: z.number().optional(),
        })
      )
      .optional(),
  }),
  z.object({
    action: z.literal('update'),
    id: z.string().max(100),
    status: z.enum(['open', 'closed']).optional(),
    assignee: z.string().max(60).optional(),
    tag: z.string().max(60).optional(),
    notes: z.string().max(4000).optional(),
    priority: z.enum(['urgent', 'high', 'normal', 'low']).optional(),
    issue_type: z.string().max(100).optional(),
    resolution: z.string().max(100).optional(),
    sales_amount: z.number().min(0).max(10000000).optional(),
    sales_successful: z.boolean().optional(),
  }),
  z.object({
    action: z.literal('resolveWithSales'),
    id: z.string().max(100),
    sales_amount: z.number().min(0).max(10000000),
    sales_successful: z.boolean(),
    resolution: z.string().max(100),
    issue_type: z.string().max(100),
  }),
  z.object({
    action: z.literal('saveReply'),
    id: z.string().max(100),
    title: z.string().trim().min(1).max(80),
    body: z.string().trim().min(1).max(4000),
    shortcut: z.string().max(40).optional(),
    media_url: z.string().url().max(500).optional().or(z.literal('')),
  }),
  z.object({
    action: z.literal('setup'),
    channel: z.enum(['facebook', 'instagram', 'tiktok']),
    account: z.string().trim().min(1).max(100),
    url: z.string().url().max(500),
  }),
]);

export async function POST(req: Request) {
  const owner = identity(req);
  if (!owner) return result({ error: 'Sign in to save changes.' }, 401);

  const origin = req.headers.get('origin');
  if (!origin || new URL(origin).host !== new URL(req.url).host) {
    return result({ error: 'Request not allowed.' }, 403);
  }

  try {
    if (Number(req.headers.get('content-length') || 0) > 32000) {
      return result({ error: 'Request too large' }, 413);
    }

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return result({ error: 'Please check your input.', details: parsed.error.issues }, 400);
    }

    const p = parsed.data;

    if (isSupabaseConfigured()) {
      const actionRes = await executeAction(owner, p);
      return result(actionRes || { success: true });
    }

    const d = db();

    if (p.action === 'reply' || p.action === 'update' || p.action === 'resolveWithSales') {
      const c = await d
        .prepare('SELECT id, status, channel, assignee, tag, name, closed_at, customer_id FROM conversations WHERE owner=? AND id=?')
        .bind(owner, p.id)
        .first();

      if (!c) return result({ error: 'Conversation not found' }, 404);

      if (p.action === 'resolveWithSales') {
        const now = new Date().toISOString();
        await d
          .prepare(
            `UPDATE conversations
             SET status = 'closed',
                 sales_amount = ?,
                 sales_successful = ?,
                 resolution = ?,
                 issue_type = ?,
                 closed_at = ?,
                 closed_by = ?,
                 updated_at = ?
             WHERE owner = ? AND id = ?`
          )
          .bind(
            p.sales_amount,
            p.sales_successful ? 1 : 0,
            p.resolution,
            p.issue_type,
            now,
            owner,
            now,
            owner,
            p.id
          )
          .run();

        await logAudit(DEFAULT_ORG_ID, owner, 'resolved_with_sales_outcome', 'conversation', p.id, {
          sales_amount: p.sales_amount,
          sales_successful: p.sales_successful,
          resolution: p.resolution,
          issue_type: p.issue_type,
          closed_at: now,
        });

        return result({ ok: true });
      }

      if (p.action === 'reply') {
        const now = new Date().toISOString();
        const attachmentsJson = JSON.stringify(p.attachments || []);

        // 24-hour Auto Reopen rule on inbound customer reply
        let shouldAutoReopen = false;
        if ((c as any).status === 'closed') {
          if (p.direction === 'in') {
            // Check 24-hour window
            if (isWithinReopenWindow((c as any).closed_at, 24)) {
              shouldAutoReopen = true;
            } else {
              return result({ error: 'Ticket closed for more than 24 hours. Please start a new conversation.' }, 409);
            }
          } else {
            return result({ error: 'Reopen this conversation before replying.' }, 409);
          }
        }

        // Intelligent Routing for unassigned inbound tickets
        let newAssignee = (c as any).assignee || '';
        if (p.direction === 'in' && (!newAssignee || newAssignee === '')) {
          const routing = await routeInboundConversation({
            orgId: DEFAULT_ORG_ID,
            channel: (c as any).channel as Channel,
            customerId: (c as any).customer_id,
            d1: d,
          });
          if (routing.assignee) {
            newAssignee = routing.assignee;
            await logAudit(DEFAULT_ORG_ID, owner, 'conversation_auto_routed', 'conversation', p.id, {
              assignee: routing.assignee,
              assignee_name: routing.assigneeName,
              reason: routing.reason,
            });
          }
        }

        const batchQueries: any[] = [
          d
            .prepare(
              'INSERT OR IGNORE INTO messages (owner, id, conversation_id, body, direction, attachments, external_id, delivery_status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
            )
            .bind(owner, p.requestId, p.id, p.body, p.direction, attachmentsJson, '', 'delivered', now),
        ];

        if (shouldAutoReopen) {
          batchQueries.push(
            d
              .prepare(
                "UPDATE conversations SET status = 'open', closed_at = '', closed_by = '', assignee = ?, updated_at = ? WHERE owner = ? AND id = ?"
              )
              .bind(newAssignee, now, owner, p.id)
          );
        } else {
          batchQueries.push(
            d.prepare('UPDATE conversations SET assignee = ?, updated_at=? WHERE owner=? AND id=?').bind(newAssignee, now, owner, p.id)
          );
        }

        await d.batch(batchQueries);

        if (shouldAutoReopen) {
          await logAudit(DEFAULT_ORG_ID, owner, 'auto_reopened_on_customer_reply', 'conversation', p.id, {
            message_id: p.requestId,
            reopened_at: now,
          });
        }

        await logAudit(
          DEFAULT_ORG_ID,
          owner,
          p.direction === 'note' ? 'added_internal_note' : 'sent_reply',
          'conversation',
          p.id,
          {
            message_id: p.requestId,
            direction: p.direction,
            preview: p.body.substring(0, 80),
          }
        );

        // Process Inbound Automations (Keyword auto-tagging, auto-responder, greetings)
        if (p.direction === 'in') {
          const msgCountRow = await d
            .prepare('SELECT COUNT(*) as cnt FROM messages WHERE owner = ? AND conversation_id = ?')
            .bind(owner, p.id)
            .first();
          const isFirst = Number((msgCountRow as any)?.cnt || 0) <= 1;

          const autoResult = await processInboundAutomations({
            orgId: DEFAULT_ORG_ID,
            owner,
            conversationId: p.id,
            messageBody: p.body,
            customerName: (c as any).name,
            channel: (c as any).channel as Channel,
            isFirstMessage: isFirst,
            d1: d,
          });

          if (autoResult.matchedRule || autoResult.automatedReplies.length > 0) {
            await logAudit(DEFAULT_ORG_ID, owner, 'automations_triggered', 'conversation', p.id, {
              matched_rule: autoResult.matchedRule?.name,
              applied_tag: autoResult.appliedTag,
              applied_priority: autoResult.appliedPriority,
              replies_count: autoResult.automatedReplies.length,
            });
          }
        }
      } else {
        const updates: { key: string; val: any }[] = [];
        const allowedKeys = [
          'status',
          'assignee',
          'tag',
          'notes',
          'priority',
          'issue_type',
          'resolution',
          'sales_amount',
        ] as const;

        for (const key of allowedKeys) {
          if (p[key] !== undefined) updates.push({ key, val: p[key] });
        }
        if (p.sales_successful !== undefined) {
          updates.push({ key: 'sales_successful', val: p.sales_successful ? 1 : 0 });
        }

        const now = new Date().toISOString();
        if (p.status === 'closed') {
          updates.push({ key: 'closed_at', val: now }, { key: 'closed_by', val: owner });
        } else if (p.status === 'open') {
          updates.push({ key: 'closed_at', val: '' }, { key: 'closed_by', val: '' });
        }

        for (const item of updates) {
          await d.prepare(`UPDATE conversations SET ${item.key}=? WHERE owner=? AND id=?`).bind(item.val, owner, p.id).run();
        }

        await logAudit(DEFAULT_ORG_ID, owner, 'updated_conversation', 'conversation', p.id, {
          updates: Object.fromEntries(updates.map((u) => [u.key, u.val])),
        });
      }
    } else if (p.action === 'saveReply') {
      await d
        .prepare(
          'INSERT INTO replies (owner, id, title, body) VALUES (?, ?, ?, ?) ON CONFLICT(owner, id) DO UPDATE SET title=excluded.title, body=excluded.body'
        )
        .bind(owner, p.id, p.title, p.body)
        .run();

      await logAudit(DEFAULT_ORG_ID, owner, 'saved_reply', 'quick_reply', p.id, {
        title: p.title,
        shortcut: p.shortcut,
      });
    } else {
      const u = new URL(p.url);
      const valid =
        p.channel === 'facebook'
          ? ['facebook.com', 'www.facebook.com']
          : p.channel === 'instagram'
          ? ['instagram.com', 'www.instagram.com']
          : ['tiktok.com', 'www.tiktok.com', 'seller-th.tiktok.com', 'seller.tiktok.com'];

      if (u.protocol !== 'https:' || !valid.includes(u.hostname) || u.username || u.password || u.search) {
        return result({ error: 'Use a public HTTPS profile or shop URL without query parameters.' }, 400);
      }

      await d
        .prepare(
          'INSERT INTO channel_setup (owner, channel, account, url) VALUES (?, ?, ?, ?) ON CONFLICT(owner, channel) DO UPDATE SET account=excluded.account, url=excluded.url'
        )
        .bind(owner, p.channel, p.account, p.url)
        .run();

      await logAudit(DEFAULT_ORG_ID, owner, 'configured_channel', 'channel', p.channel, {
        account: p.account,
        url: p.url,
      });
    }

    return result({ ok: true });
  } catch (e) {
    console.error('workspace save failed', e);
    return result({ error: 'Could not save. Your input has been kept; please retry.' }, 503);
  }
}
