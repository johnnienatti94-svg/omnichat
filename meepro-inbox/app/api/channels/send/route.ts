import { db, identity, result, logAudit, DEFAULT_ORG_ID } from '@/lib/inbox-server';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { getSupabaseAdmin } from '@/lib/supabase/server';
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

    // 1. Fetch conversation details
    let conv: any = null;
    let lastInboundTime: string | null = null;
    let recipientExternalId = '';
    const now = new Date().toISOString();

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdmin();
      const { data: convData } = await supabase
        .from('conversations')
        .select('id, channel, handle, status, customer_id, updated_at')
        .eq('owner', owner)
        .eq('id', conversation_id)
        .maybeSingle();

      if (!convData) {
        return result({ error: 'Conversation not found' }, 404);
      }
      conv = convData;

      if (!bypass_24h_window) {
        const { data: lastInbound } = await supabase
          .from('messages')
          .select('created_at')
          .eq('owner', owner)
          .eq('conversation_id', conversation_id)
          .eq('direction', 'in')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (lastInbound?.created_at) {
          lastInboundTime = lastInbound.created_at;
        }
      }

      if (conv.customer_id) {
        const { data: ident } = await supabase
          .from('customer_identities')
          .select('external_id')
          .eq('org_id', DEFAULT_ORG_ID)
          .eq('channel', conv.channel)
          .eq('customer_id', conv.customer_id)
          .maybeSingle();

        if (ident?.external_id) recipientExternalId = ident.external_id;
      }
    } else {
      const d = db();
      conv = await d
        .prepare('SELECT id, channel, handle, status, customer_id, updated_at FROM conversations WHERE owner = ? AND id = ?')
        .bind(owner, conversation_id)
        .first();

      if (!conv) {
        return result({ error: 'Conversation not found' }, 404);
      }

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
          lastInboundTime = (lastInbound as any).created_at;
        }
      }

      const identityRow = await d
        .prepare(
          'SELECT external_id FROM customer_identities WHERE org_id = ? AND channel = ? AND customer_id = ?'
        )
        .bind(DEFAULT_ORG_ID, conv.channel, (conv as any).customer_id)
        .first();

      if ((identityRow as any)?.external_id) {
        recipientExternalId = (identityRow as any).external_id;
      }
    }

    const channel = conv.channel;
    const adapter = getChannelAdapter(channel);
    if (!adapter) {
      return result({ error: `No adapter available for channel: ${channel}` }, 400);
    }

    // 2. Enforce 24-Hour Policy Window
    if (!bypass_24h_window && lastInboundTime) {
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

    if (!recipientExternalId) {
      recipientExternalId = conv.handle;
    }

    // 3. Format Outbound Payload
    const outboundPayload = adapter.formatOutboundPayload({
      recipientId: recipientExternalId,
      text: body,
      attachments,
    });

    const credentials = {
      accessToken: 'demo_token',
      pageId: 'demo_page',
      shopId: 'demo_shop',
    };

    // 4. Send via adapter
    const sendResult = adapter.sendOutboundMessage
      ? await adapter.sendOutboundMessage(credentials, outboundPayload)
      : { externalId: `mid.out.${Date.now()}`, status: 'delivered' as const };

    // 5. Store Outbound Message
    const messageId = `msg-out-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdmin();
      await supabase.from('messages').insert({
        id: messageId,
        owner,
        conversation_id,
        body,
        direction: 'out',
        attachments,
        external_id: sendResult.externalId || '',
        delivery_status: sendResult.status,
        created_at: now,
      });

      await supabase
        .from('conversations')
        .update({ updated_at: now })
        .eq('owner', owner)
        .eq('id', conversation_id);
    } else {
      const d = db();
      await d
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
          sendResult.externalId || '',
          sendResult.status,
          now
        )
        .run();

      await d
        .prepare('UPDATE conversations SET updated_at = ? WHERE owner = ? AND id = ?')
        .bind(now, owner, conversation_id)
        .run();
    }

    // 6. Log Audit Trail
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
    console.error('Failed to send channel message:', err);
    return result({ error: err.message || 'Failed to send channel message' }, 500);
  }
}
