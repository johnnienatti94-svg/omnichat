import type { Channel } from '@/lib/inbox-data';
import type { ChannelAdapter } from './types';
import { FacebookAdapter } from './adapters/facebook';
import { InstagramAdapter } from './adapters/instagram';
import { TikTokShopAdapter } from './adapters/tiktok-shop';
import { LineAdapter } from './adapters/line';

const adapters: Record<Channel, ChannelAdapter> = {
  facebook: new FacebookAdapter(),
  instagram: new InstagramAdapter(),
  tiktok: new TikTokShopAdapter(),
  line: new LineAdapter(),
};

export function getChannelAdapter(channel: string): ChannelAdapter | null {
  if (channel in adapters) {
    return adapters[channel as Channel];
  }
  return null;
}

export * from './types';
export { FacebookAdapter } from './adapters/facebook';
export { InstagramAdapter } from './adapters/instagram';
export { TikTokShopAdapter } from './adapters/tiktok-shop';
export { LineAdapter } from './adapters/line';

