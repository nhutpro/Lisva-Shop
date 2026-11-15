import { describe, expect, it } from "vitest";
import { getEnv, getTelegramConfig } from "./env";

describe("getEnv", () => {
  it("uses a local default for the site URL", () => {
    expect(getEnv({}).NEXT_PUBLIC_SITE_URL).toBe("http://localhost:3000");
    expect(getEnv({ NEXT_PUBLIC_SITE_URL: "" }).NEXT_PUBLIC_SITE_URL).toBe("http://localhost:3000");
  });

  it("rejects a malformed site URL instead of ignoring it", () => {
    expect(() => getEnv({ NEXT_PUBLIC_SITE_URL: "not a url" })).toThrow();
  });
});

describe("getTelegramConfig", () => {
  it("is null when nothing, only one value, or empty values are set", () => {
    expect(getTelegramConfig({})).toBeNull();
    expect(getTelegramConfig({ TELEGRAM_BOT_TOKEN: "", TELEGRAM_CHAT_ID: "" })).toBeNull();
    expect(getTelegramConfig({ TELEGRAM_BOT_TOKEN: "123:abc" })).toBeNull();
    expect(getTelegramConfig({ TELEGRAM_CHAT_ID: "42" })).toBeNull();
  });

  it("returns the token and chat id when both are set", () => {
    expect(getTelegramConfig({ TELEGRAM_BOT_TOKEN: " 123:abc ", TELEGRAM_CHAT_ID: "42" })).toEqual({
      token: "123:abc",
      chatId: "42",
    });
  });

  it("accepts an alternative API address (for tests against a fake server) without a trailing slash", () => {
    expect(
      getTelegramConfig({ TELEGRAM_BOT_TOKEN: "t", TELEGRAM_CHAT_ID: "1", TELEGRAM_API_BASE_URL: "http://127.0.0.1:8777/" }),
    ).toEqual({ token: "t", chatId: "1", apiBase: "http://127.0.0.1:8777" });
    expect(() => getTelegramConfig({ TELEGRAM_BOT_TOKEN: "t", TELEGRAM_CHAT_ID: "1", TELEGRAM_API_BASE_URL: "nope" })).toThrow();
  });
});
