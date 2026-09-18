import { db, result, logAudit, DEFAULT_ORG_ID } from '@/lib/inbox-server';
import { getChannelAdapter } from '@/lib/channels';
import { routeInboundConversation } from '@/lib/routing-engine';
import { processInboundAutomations } from '@/lib/automations-engine';
import type { Channel } from '@/lib/inbox-data';

const DEFAULT_WEBHOOK_SECRET = 'meepro_webhook_secret_2026';

export async function GET(req: Request, props: { params: Promise<{ channel: string }> }) {
  const params = await props.params;
  const channel = params.channel;
  const adapter = getChannelAdapter(channel);

  if (!adapter) {
    return result({ error: `Unsupported channel: ${channel}` }, 404);
  }

  const url = new URL(req.url);
  const d = db();

  // Look up custom webhook secret from channel_connections if available
  const conn = await d
    .prepare('SELECT webhook_secret FROM channel_connections WHERE channel = ? AND org_id = ?')
    .bind(channel, DEFAULT_ORG_ID)
    .first();

  const secret = (conn as any)?.webhook_secret || DEFAULT_WEBHOOK_SECRET;

  const challenge = adapter.verifyWebhookChallenge(url.searchParams, secret);
  if (challenge) {
    return new Response(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  return result({ error: 'Webhook verification challenge failed' }, 403);
}

export async function POST(req: Request, props: { params: Promise<{ channel: string }> }) {
  const params = await props.params;
  const channel = params.channel as Channel;
  const adapter = getChannelAdapter(channel);

  if (!adapter) {
    return result({ error: `Unsupported channel: ${channel}` }, 404);
  }

  const rawBody = await req.text();
  const d = db();

  // 1. Signature Verification
  const conn = await d
    .prepare('SELECT webhook_secret FROM channel_connections WHERE channel = ? AND org_id = ?')
    .bind(channel, DEFAULT_ORG_ID)
    .first();

  const secret = (conn as any)?.webhook_secret || DEFAULT_WEBHOOK_SECRET;

  const sigHeader =
    req.headers.get('x-hub-signature-256') ||
    req.headers.get('x-tts-signature') ||
    req.headers.get('authorization');

  // Verify signature if header is provided
  if (sigHeader) {
    const isValid = await adapter.verifySignature(rawBody, sigHeader, secret);
    if (!isValid) {
      return result({ error: 'Invalid webhook signature' }, 401);
    }
  }

  try {
    const payload = JSON.parse(rawBody);
    const normalizedMessages = await adapter.parseInboundWebhook(payload);

    if (normalizedMessages.length === 0) {
      return result({ ok: true, processed: 0, notice: 'No customer messages in payload' });
    }

    const processedIds: string[] = [];
    const now = new Date().toISOString();
    const owner = 'owner-org-meepro';

    for (const msg of normalizedMessages) {
      // 2. Idempotency & Deduplication
      if (msg.externalId) {
        const existing = await d
          .prepare('SELECT id FROM messages WHERE external_id = ? LIMIT 1')
          .bind(msg.externalId)
          .first();

        if (existing) {
          // Already ingested, skip duplicate delivery
          continue;
        }
      }

      // 3. Customer Identity Resolution
      let customerId = '';
      const identityRow = await d
        .prepare(
          'SELECT customer_id FROM customer_identities WHERE org_id = ? AND channel = ? AND external_id = ?'
        )
        .bind(DEFAULT_ORG_ID, msg.channel, msg.sender.id)
        .first();

      if (identityRow && (identityRow as any).customer_id) {
        customerId = (identityRow as any).customer_id;
      } else {
        // Create new Customer & Identity
        customerId = `cust-${msg.channel}-${msg.sender.id.slice(-6)}-${Date.now().toString(36)}`;
        const customerName = msg.sender.name || `${msg.channel.toUpperCase()} User`;

        await d.batch([
          d
            .prepare(
              'INSERT OR IGNORE INTO customers (id, org_id, name, phone, email, notes, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
            )
            .bind(customerId, DEFAULT_ORG_ID, customerName, '', '', '', JSON.stringify([]), now, now),
          d
            .prepare(
              'INSERT OR IGNORE INTO customer_identities (id, org_id, customer_id, channel, external_id, handle, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
            )
            .bind(
              `ident-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              DEFAULT_ORG_ID,
              customerId,
              msg.channel,
              msg.sender.id,
              msg.sender.handle || '',
              now
            ),
        ]);
      }

      // 4. Conversation Lookup or Creation
      let conversationId = '';
      const convRow = await d
        .prepare(
          `SELECT id, status, assignee, tag FROM conversations 
           WHERE customer_id = ? AND channel = ?
           ORDER BY updated_at DESC LIMIT 1`
        )
        .bind(customerId, msg.channel)
        .first();

      let isNewConv = false;
      let convAssignee = '';

      if (convRow && (convRow as any).id) {
        conversationId = (convRow as any).id;
        convAssignee = (convRow as any).assignee || '';
      } else {
        isNewConv = true;
        conversationId = `conv-${msg.channel}-${Date.now().toString(36)}`;
        const customerName = msg.sender.name || `${msg.channel.toUpperCase()} Customer`;

        // 5. Intelligent Routing for New Conversation
        const routing = await routeInboundConversation({
          orgId: DEFAULT_ORG_ID,
          channel: msg.channel,
          customerId,
          d1: d,
        });

        convAssignee = routing.assignee || '';

        await d
          .prepare(
            `INSERT INTO conversations (
              owner, id, name, channel, handle, status, assignee, tag, notes,
              priority, issue_type, resolution, sales_amount, sales_successful,
              closed_at, closed_by, customer_id, updated_at
            ) VALUES (?, ?, ?, ?, ?, 'open', ?, '', '', 'normal', '', '', 0, 0, '', '', ?, ?)`
          )
          .bind(
            owner,
            conversationId,
            customerName,
            msg.channel,
            msg.sender.handle || msg.sender.id,
            convAssignee,
            customerId,
            now
          )
          .run();

        if (convAssignee) {
          await logAudit(DEFAULT_ORG_ID, owner, 'conversation_auto_routed', 'conversation', conversationId, {
            assignee: convAssignee,
            reason: routing.reason,
            channel: msg.channel,
          });
        }
      }

      // 6. Ingest Inbound Message
      const messageId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      await d
        .prepare(
          `INSERT INTO messages (
            owner, id, conversation_id, body, direction, attachments, external_id, delivery_status, created_at
          ) VALUES (?, ?, ?, ?, 'in', ?, ?, 'delivered', ?)`
        )
        .bind(owner, messageId, conversationId, msg.body, JSON.stringify(msg.attachments || []), msg.externalId, now)
        .run();

      // Update conversation timestamp
      await d
        .prepare('UPDATE conversations SET updated_at = ?, status = ? WHERE owner = ? AND id = ?')
        .bind(now, 'open', owner, conversationId)
        .run();

      // 7. Trigger Automations Engine (Keywords, welcome greeting, off-hours responder)
      const autoResult = await processInboundAutomations({
        orgId: DEFAULT_ORG_ID,
        owner,
        conversationId,
        messageBody: msg.body,
        customerName: msg.sender.name || 'ลูกค้า',
        channel: msg.channel,
        isFirstMessage: isNewConv,
        d1: d,
      });

      if (autoResult.matchedRule || autoResult.automatedReplies.length > 0) {
        await logAudit(DEFAULT_ORG_ID, owner, 'automations_triggered', 'conversation', conversationId, {
          matched_rule: autoResult.matchedRule?.name,
          applied_tag: autoResult.appliedTag,
          applied_priority: autoResult.appliedPriority,
          replies_count: autoResult.automatedReplies.length,
          channel: msg.channel,
        });
      }

      processedIds.push(messageId);
    }

    return result({
      ok: true,
      processed: processedIds.length,
      message_ids: processedIds,
    });
  } catch (err: any) {
    console.error('Webhook ingestion error:', err);
    return result({ error: err.message || 'Webhook processing failed' }, 500);
  }
}
