import type { Channel, MessageAttachment } from '@/lib/inbox-data';

export type NormalizedMessage = {
  channel: Channel;
  externalId: string;
  sender: {
    id: string; // Platform user ID (PSID, IGSID, TikTok buyer open id)
    name?: string;
    handle?: string;
  };
  recipient: {
    id: string; // Page ID, IG Account ID, Shop ID
  };
  body: string;
  direction: 'in' | 'out';
  attachments: MessageAttachment[];
  timestamp: string; // ISO string
  rawPayload?: unknown;
};

export interface ChannelAdapter {
  channel: Channel;
  verifyWebhookChallenge(searchParams: URLSearchParams, verifyToken: string): string | null;
  verifySignature(rawBody: string, signatureHeader: string | null, secret: string): Promise<boolean>;
  parseInboundWebhook(rawPayload: unknown): Promise<NormalizedMessage[]>;
  formatOutboundPayload(params: {
    recipientId: string;
    text: string;
    attachments?: MessageAttachment[];
  }): unknown;
  sendOutboundMessage?(
    credentials: { accessToken: string; pageId?: string; shopId?: string },
    payload: unknown
  ): Promise<{ externalId: string; status: 'delivered' | 'sent' | 'failed' }>;
}
