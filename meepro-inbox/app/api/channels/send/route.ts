import { db, identity, result, logAudit, DEFAULT_ORG_ID } from '@/lib/inbox-server';
import { getChannelAdapter } from '@/lib/channels';
import { isWithinReopenWindow } from '@/lib/ticket-lifecycle';
import { z } from 'zod';

const sendSchema = z.object({
  conversation_id: z.string().min(1).max(100),
  body: z.string().trim().min(1).max(4000),
  attachments: z
    .array(
      z.object({
        id: z.string(),
        type: z.enum(['image', 'video', 'file']),
        url: z.string(),
        name: z.string(),
      })
    )
    .optional(),
  bypass_24h_window: z.boolean().optional(),
});

export async function POST(req: Request) {
  const owner = identity(req);
  if (!owner) return result({ error: 'Sign in to send messages.' }, 401);

  try {
    const parsed = sendSchema.safeParse(await req.json());
    if (!parsed.success) {
      return result({ error: 'Invalid message payload', details: parsed.error.issues }, 400);
    }

    const { conversation_id, body, attachments = [], bypass_24h_window = false } = parsed.data;
    const d = db();

    // 1. Fetch conversation details
    const conv = await d
      .prepare('SELECT id, channel, handle, status, customer_id, updated_at FROM conversations WHERE owner = ? AND id = ?')
      .bind(owner, conversation_id)
      .first();

    if (!conv) {
      return result({ error: 'Conversation not found' }, 404);
    }

    const channel = (conv as any).channel;
    const adapter = getChannelAdapter(channel);
    if (!adapter) {
      return result({ error: `No adapter available for channel: ${channel}` }, 400);
    }

    // 2. Enforce 24-Hour Messaging Policy
    // Platforms (Meta Messenger & Instagram) strictly enforce a 24-hour reply window from the customer's last message.
    if (!bypass_24h_window) {
      const lastInbound = await d
        .prepare(
          `SELECT created_at FROM messages 
           WHERE owner = ? AND conversation_id = ? AND direction = 'in'
           ORDER BY created_at DESC LIMIT 1`
        )
        .bind(owner, conversation_id)
        .first();

      if (lastInbound && (lastInbound as any).created_at) {
        const lastInboundTime = (lastInbound as any).created_at;
        const withinWindow = isWithinReopenWindow(lastInboundTime, 24);
        if (!withinWindow) {
          return result(
            {
              error: '24-Hour Policy Window Expired',
              code: 'POLICY_WINDOW_EXPIRED',
              details:
                'Platform policy requires customer to initiate contact within the last 24 hours before sending standard replies.',
            },
            403
          );
        }
      }
    }

    // 3. Look up recipient external ID from customer_identities
    const identityRow = await d
      .prepare(
        'SELECT external_id FROM customer_identities WHERE org_id = ? AND channel = ? AND customer_id = ?'
      )
      .bind(DEFAULT_ORG_ID, channel, (conv as any).customer_id)
      .first();

    const recipientExternalId = (identityRow as any)?.external_id || (conv as any).handle;

    // 4. Format Outbound Payload via Adapter
    const outboundPayload = adapter.formatOutboundPayload({
      recipientId: recipientExternalId,
      text: body,
      attachments,
    });

    // 5. Look up channel credentials
    const conn = await d
      .prepare('SELECT credentials_encrypted, account_id FROM channel_connections WHERE channel = ? AND org_id = ?')
      .bind(channel, DEFAULT_ORG_ID)
      .first();

    const credentials = {
      accessToken: (conn as any)?.credentials_encrypted || 'demo_token',
      pageId: (conn as any)?.account_id,
      shopId: (conn as any)?.account_id,
    };

    // 6. Send via adapter (live API or demo simulation)
    const sendResult = adapter.sendOutboundMessage
      ? await adapter.sendOutboundMessage(credentials, outboundPayload)
      : { externalId: `mid.out.${Date.now()}`, status: 'delivered' as const };

    // 7. Persist Outbound Message in D1
    const messageId = `msg-out-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    await d.batch([
      d
        .prepare(
          `INSERT INTO messages (
            owner, id, conversation_id, body, direction, attachments, external_id, delivery_status, created_at
          ) VALUES (?, ?, ?, ?, 'out', ?, ?, ?, ?)`
        )
        .bind(
          owner,
          messageId,
          conversation_id,
          body,
          JSON.stringify(attachments),
          sendResult.externalId,
          sendResult.status,
          now
        ),
      d.prepare('UPDATE conversations SET updated_at = ? WHERE owner = ? AND id = ?').bind(now, owner, conversation_id),
    ]);

    await logAudit(DEFAULT_ORG_ID, owner, 'sent_outbound_channel_message', 'message', messageId, {
      conversation_id,
      channel,
      external_id: sendResult.externalId,
      delivery_status: sendResult.status,
    });

    return result({
      ok: true,
      message_id: messageId,
      external_id: sendResult.externalId,
      delivery_status: sendResult.status,
    });
  } catch (err: any) {
    console.error('Outbound send error:', err);
    return result({ error: err.message || 'Failed to dispatch outbound message' }, 500);
  }
}
