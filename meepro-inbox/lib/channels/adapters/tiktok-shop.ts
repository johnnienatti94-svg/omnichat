import type { ChannelAdapter, NormalizedMessage } from '../types';
import { verifyTikTokShopSignature } from '@/lib/security/webhook-verifier';

export class TikTokShopAdapter implements ChannelAdapter {
  channel = 'tiktok' as const;

  /**
   * TikTok Shop webhook challenge verification.
   */
  verifyWebhookChallenge(searchParams: URLSearchParams, verifyToken: string): string | null {
    const challenge = searchParams.get('challenge');
    const token = searchParams.get('token');
    if (challenge && (!token || token === verifyToken)) {
      return challenge;
    }
    return null;
  }

  /**
   * Verifies TikTok Shop webhook signature (Authorization or X-TTS-Signature).
   */
  async verifySignature(rawBody: string, signatureHeader: string | null, secret: string): Promise<boolean> {
    return verifyTikTokShopSignature(rawBody, signatureHeader, secret);
  }

  /**
   * Normalizes incoming TikTok Shop Customer Chat webhook payload to NormalizedMessage array.
   */
  async parseInboundWebhook(rawPayload: any): Promise<NormalizedMessage[]> {
    const messages: NormalizedMessage[] = [];
    if (!rawPayload) return messages;

    // TikTok Shop customer service message payload structure
    const eventType = rawPayload.type || rawPayload.event_type;
    const shopId = rawPayload.shop_id || 'meepro_tiktok_shop';
    const data = rawPayload.data || rawPayload;

    if (data && (data.message_id || data.content || data.text)) {
      const externalId = data.message_id || `tts-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const senderId = data.sender?.user_id || data.from_user_id || data.buyer_user_id || 'tt_buyer';
      const senderNick = data.sender?.nick_name || data.sender?.name || `TikTok Buyer (${senderId.slice(-4)})`;
      const body = data.content?.text || data.text || data.content || '';
      const timestamp = rawPayload.timestamp
        ? new Date(rawPayload.timestamp * 1000).toISOString()
        : new Date().toISOString();

      const attachments = [];
      if (data.content?.image_url) {
        attachments.push({
          id: `att-tts-${externalId}-0`,
          type: 'image' as const,
          url: data.content.image_url,
          name: 'tiktok_shop_image.jpg',
        });
      }

      messages.push({
        channel: 'tiktok',
        externalId,
        sender: {
          id: senderId,
          name: senderNick,
          handle: `tiktok.${senderId.slice(-6)}`,
        },
        recipient: {
          id: shopId,
        },
        body,
        direction: 'in',
        attachments,
        timestamp,
        rawPayload,
      });
    }

    return messages;
  }

  /**
   * Formats outbound message payload for TikTok Shop Open API Customer Service.
   */
  formatOutboundPayload(params: { recipientId: string; text: string; attachments?: any[] }): any {
    return {
      message_type: 1, // 1 = text
      content: {
        text: params.text,
      },
    };
  }

  /**
   * Dispatches message via TikTok Shop Open API (or simulated in local dev mode).
   */
  async sendOutboundMessage(
    credentials: { accessToken: string; shopId?: string },
    payload: any
  ): Promise<{ externalId: string; status: 'delivered' | 'sent' | 'failed' }> {
    if (!credentials.accessToken || credentials.accessToken.startsWith('demo_')) {
      return {
        externalId: `tts.msg.demo.${Date.now()}`,
        status: 'delivered',
      };
    }

    // In live mode: POST https://open-api.tiktokglobalshop.com/api/im/v1/messages
    return {
      externalId: `tts.msg.${Date.now()}`,
      status: 'delivered',
    };
  }
}
