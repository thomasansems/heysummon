import type { ChannelAdapter, ChannelType } from "./types";
import { telegramAdapter } from "./telegram";
import { whatsappAdapter } from "./whatsapp";

export { CHANNEL_TYPES } from "./types";
export type { ChannelAdapter, ChannelType, HelpRequestEvent, FormattedMessage } from "./types";

const adapters: Record<string, ChannelAdapter> = {
  telegram: telegramAdapter,
  whatsapp: whatsappAdapter,
};

/**
 * Get the adapter for a given channel type.
 * Returns undefined for channel types that don't have an adapter yet
 * (signal, discord, email — coming soon).
 */
export function getAdapter(type: ChannelType | string): ChannelAdapter | undefined {
  return adapters[type];
}

/** List all channel types that have a working adapter. */
export function getSupportedTypes(): ChannelType[] {
  return Object.keys(adapters) as ChannelType[];
}
