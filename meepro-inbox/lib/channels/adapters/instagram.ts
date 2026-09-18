import type { ChannelAdapter, NormalizedMessage } from '../types';
import { verifyMetaSignature } from '@/lib/security/webhook-verifier';

export class InstagramAdapter implements ChannelAdapter {
  channel = 'instagram' as const;

  /**
   * Handles Instagram Meta webhook GET challenge verification.
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
   * Normalizes incoming Instagram Direct webhook payload to NormalizedMessage array.
   */
  async parseInboundWebhook(rawPayload: any): Promise<NormalizedMessage[]> {
    const messages: NormalizedMessage[] = [];
    if (!rawPayload || (rawPayload.object !== 'instagram' && rawPayload.object !== 'page') || !Array.isArray(rawPayload.entry)) {
      return messages;
    }

    for (const entry of rawPayload.entry) {
      const igAccountId = entry.id;
      if (!Array.isArray(entry.messaging)) continue;

      for (const event of entry.messaging) {
        if (!event.message) continue;

        const externalId = event.message.mid || `ig-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        const senderId = event.sender?.id || '';
        const body = event.message.text || '';
        const timestamp = event.timestamp ? new Date(event.timestamp).toISOString() : new Date().toISOString();

        const attachments = (event.message.attachments || []).map((att: any, idx: number) => ({
          id: `att-ig-${externalId}-${idx}`,
          type: (att.type === 'video' ? 'video' : att.type === 'file' ? 'file' : 'image') as any,
          url: att.payload?.url || '',
          name: att.payload?.title || `ig-media-${idx + 1}`,
        }));

        messages.push({
          channel: 'instagram',
          externalId,
          sender: {
            id: senderId,
            name: `IG User (@${senderId.slice(-4)})`,
            handle: `ig.${senderId.slice(-6)}`,
          },
          recipient: {
            id: igAccountId,
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
   * Formats outbound message payload for Instagram Graph Messaging API.
   */
  formatOutboundPayload(params: { recipientId: string; text: string; attachments?: any[] }): any {
    return {
      recipient: { id: params.recipientId },
      message: {
        text: params.text,
        ...(params.attachments && params.attachments.length > 0
          ? {
              attachment: {
                type: params.attachments[0].type || 'image',
                payload: { url: params.attachments[0].url },
              },
            }
          : {}),
      },
    };
  }

  /**
   * Dispatches message via Instagram Graph API (or simulated in local dev mode).
   */
  async sendOutboundMessage(
    credentials: { accessToken: string; pageId?: string },
    payload: any
  ): Promise<{ externalId: string; status: 'delivered' | 'sent' | 'failed' }> {
    if (!credentials.accessToken || credentials.accessToken.startsWith('demo_')) {
      return {
        externalId: `mid.demo.ig.${Date.now()}`,
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
      throw new Error(`Instagram Send API failed: ${JSON.stringify(err)}`);
    }

    const data: any = await res.json();
    return {
      externalId: data.message_id || `mid.ig.${Date.now()}`,
      status: 'delivered',
    };
  }
}
