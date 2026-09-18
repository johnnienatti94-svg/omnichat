import type { ChannelAdapter, NormalizedMessage } from '../types';
import { verifyMetaSignature } from '@/lib/security/webhook-verifier';

export class FacebookAdapter implements ChannelAdapter {
  channel = 'facebook' as const;

  /**
   * Handles Meta webhook GET challenge verification.
   */
  verifyWebhookChallenge(searchParams: URLSearchParams, verifyToken: string): string | null {
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    if (mode === 'subscribe' && token === verifyToken && challenge) {
      return challenge;
    }
    return null;
  }

  /**
   * Verifies X-Hub-Signature-256 header using Meta App Secret.
   */
  async verifySignature(rawBody: string, signatureHeader: string | null, secret: string): Promise<boolean> {
    return verifyMetaSignature(rawBody, signatureHeader, secret);
  }

  /**
   * Normalizes incoming Facebook Messenger webhook payload to NormalizedMessage array.
   */
  async parseInboundWebhook(rawPayload: any): Promise<NormalizedMessage[]> {
    const messages: NormalizedMessage[] = [];
    if (!rawPayload || rawPayload.object !== 'page' || !Array.isArray(rawPayload.entry)) {
      return messages;
    }

    for (const entry of rawPayload.entry) {
      const pageId = entry.id;
      if (!Array.isArray(entry.messaging)) continue;

      for (const event of entry.messaging) {
        if (!event.message) continue; // Skip delivery receipts, read events, etc.

        const externalId = event.message.mid || `fb-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        const senderId = event.sender?.id || '';
        const body = event.message.text || '';
        const timestamp = event.timestamp ? new Date(event.timestamp).toISOString() : new Date().toISOString();

        const attachments = (event.message.attachments || []).map((att: any, idx: number) => ({
          id: `att-fb-${externalId}-${idx}`,
          type: (att.type === 'video' ? 'video' : att.type === 'file' ? 'file' : 'image') as any,
          url: att.payload?.url || '',
          name: att.payload?.title || `attachment-${idx + 1}`,
        }));

        messages.push({
          channel: 'facebook',
          externalId,
          sender: {
            id: senderId,
            name: `FB User (${senderId.slice(-4)})`,
            handle: `fb.${senderId.slice(-6)}`,
          },
          recipient: {
            id: pageId,
          },
          body,
          direction: 'in',
          attachments,
          timestamp,
          rawPayload: event,
        });
      }
    }

    return messages;
  }

  /**
   * Formats outbound message payload for Meta Graph Send API.
   */
  formatOutboundPayload(params: { recipientId: string; text: string; attachments?: any[] }): any {
    return {
      recipient: { id: params.recipientId },
      messaging_type: 'RESPONSE',
      message: {
        text: params.text,
        ...(params.attachments && params.attachments.length > 0
          ? {
              attachment: {
                type: params.attachments[0].type || 'image',
                payload: { url: params.attachments[0].url, is_reusable: true },
              },
            }
          : {}),
      },
    };
  }

  /**
   * Dispatches message via Graph API (or simulated in local dev mode).
   */
  async sendOutboundMessage(
    credentials: { accessToken: string; pageId?: string },
    payload: any
  ): Promise<{ externalId: string; status: 'delivered' | 'sent' | 'failed' }> {
    if (!credentials.accessToken || credentials.accessToken.startsWith('demo_')) {
      // Demo / simulated send
      return {
        externalId: `mid.demo.fb.${Date.now()}`,
        status: 'delivered',
      };
    }

    const res = await fetch(`https://graph.facebook.com/v21.0/me/messages?access_token=${credentials.accessToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Facebook Send API failed: ${JSON.stringify(err)}`);
    }

    const data: any = await res.json();
    return {
      externalId: data.message_id || `mid.fb.${Date.now()}`,
      status: 'delivered',
    };
  }
}
