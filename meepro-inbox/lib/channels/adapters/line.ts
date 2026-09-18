import type { ChannelAdapter, NormalizedMessage } from '../types';
import { verifyLineSignature } from '@/lib/security/webhook-verifier';

export class LineAdapter implements ChannelAdapter {
  channel = 'line' as const;

  /**
   * LINE doesn't use GET hub.challenge, but sends a test webhook event or ping.
   * Returns 'OK' to satisfy any challenge probes.
   */
  verifyWebhookChallenge(_searchParams: URLSearchParams, _verifyToken: string): string | null {
    return 'OK';
  }

  /**
   * Verifies x-line-signature header using LINE Channel Secret (HMAC-SHA256 Base64).
   */
  async verifySignature(rawBody: string, signatureHeader: string | null, secret: string): Promise<boolean> {
    return verifyLineSignature(rawBody, signatureHeader, secret);
  }

  /**
   * Normalizes LINE Messaging API webhook payload to NormalizedMessage array.
   */
  async parseInboundWebhook(rawPayload: any): Promise<NormalizedMessage[]> {
    const messages: NormalizedMessage[] = [];
    if (!rawPayload || !Array.isArray(rawPayload.events)) {
      return messages;
    }

    const destination = rawPayload.destination || 'line-bot';

    for (const event of rawPayload.events) {
      // Only process inbound messages from users (ignore unfollow, postback, etc.)
      if (event.type !== 'message' || !event.message) continue;

      const messageType = event.message.type;
      const externalId =
        event.webhookEventId ||
        event.message.id ||
        `line-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const senderId = event.source?.userId || '';
      const timestamp = event.timestamp
        ? new Date(event.timestamp).toISOString()
        : new Date().toISOString();

      let body = '';
      const attachments: any[] = [];

      if (messageType === 'text') {
        body = event.message.text || '';
      } else if (messageType === 'image') {
        body = '[รูปภาพ/Image]';
        attachments.push({
          id: `att-line-${event.message.id}`,
          type: 'image',
          url: event.message.contentProvider?.originalContentUrl || '',
          name: 'line_image.jpg',
        });
      } else if (messageType === 'sticker') {
        body = `[สติกเกอร์ LINE ${event.message.packageId ? `pkg:${event.message.packageId}` : ''}]`;
      } else {
        body = `[ข้อความประเภท: ${messageType}]`;
      }

      messages.push({
        channel: 'line',
        externalId,
        sender: {
          id: senderId,
          name: `LINE User (${senderId ? senderId.slice(-4) : 'User'})`,
          handle: senderId ? `@${senderId.slice(-6)}` : '@line.user',
        },
        recipient: {
          id: destination,
        },
        body,
        direction: 'in',
        attachments,
        timestamp,
        rawPayload: event,
      });
    }

    return messages;
  }

  /**
   * Formats outbound message payload for LINE Push Message API.
   * Target endpoint: https://api.line.me/v2/bot/message/push
   */
  formatOutboundPayload(params: { recipientId: string; text: string; attachments?: any[] }): any {
    const messages: any[] = [];

    if (params.text) {
      messages.push({
        type: 'text',
        text: params.text,
      });
    }

    if (params.attachments && params.attachments.length > 0) {
      for (const att of params.attachments) {
        if (att.type === 'image' && att.url) {
          messages.push({
            type: 'image',
            originalContentUrl: att.url,
            previewImageUrl: att.url,
          });
        }
      }
    }

    return {
      to: params.recipientId,
      messages,
    };
  }

  /**
   * Dispatches outbound message to LINE Messaging API.
   */
  async sendOutboundMessage(
    credentials: { accessToken: string },
    payload: any
  ): Promise<{ externalId: string; status: 'delivered' | 'sent' | 'failed' }> {
    if (!credentials.accessToken || credentials.accessToken.startsWith('demo_')) {
      // Demo / simulated mode
      return {
        externalId: `mid.demo.line.${Date.now()}`,
        status: 'delivered',
      };
    }

    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${credentials.accessToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`LINE Push API failed: ${JSON.stringify(err)}`);
    }

    return {
      externalId: `mid.line.${Date.now()}`,
      status: 'delivered',
    };
  }
}
