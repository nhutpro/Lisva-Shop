import { z } from "zod";

// An empty value in .env (for example "TELEGRAM_BOT_TOKEN=") counts as "not set".
const optionalText = z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().min(1).optional());

const envSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.url().default("http://localhost:3000"),
  ),
  TELEGRAM_BOT_TOKEN: optionalText,
  TELEGRAM_CHAT_ID: optionalText,
  /** Only for testing against a fake Telegram server. Leave unset in real use. */
  TELEGRAM_API_BASE_URL: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.url().optional()),
});

export type Env = z.infer<typeof envSchema>;

/** Reads and validates the environment. A malformed value fails loudly instead of being ignored. */
export function getEnv(source: Record<string, string | undefined> = process.env): Env {
  return envSchema.parse(source);
}

export type TelegramConfig = { token: string; chatId: string; apiBase?: string };

/** Telegram settings, or null when the owner has not configured the bot yet. */
export function getTelegramConfig(source: Record<string, string | undefined> = process.env): TelegramConfig | null {
  const env = getEnv(source);
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return null;
  return {
    token: env.TELEGRAM_BOT_TOKEN,
    chatId: env.TELEGRAM_CHAT_ID,
    ...(env.TELEGRAM_API_BASE_URL ? { apiBase: env.TELEGRAM_API_BASE_URL.replace(/\/+$/, "") } : {}),
  };
}
