import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    DATABASE_URL: z.string().url(),
    JWT_SECRET: z.string().min(32),
    AES_KEY: z.string().min(16, "AES_KEY 至少 16 位"),
    FILE_STORAGE_DIR: z.string().min(1).default("/data/uploads"),
    FILE_BASE_URL: z.string().url().optional(),
    SESSION_COOKIE_SECURE: z.enum(["true", "false"]).optional(),
    WX_APPID: z.string().min(1, "微信小程序 APPID 不能为空"),
    WX_SECRET: z.string().min(1, "微信小程序 SECRET 不能为空"),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    NEXT_PUBLIC_AES_KEY: z.string().min(16, "NEXT_PUBLIC_AES_KEY 至少 16 位"),
    NEXT_PUBLIC_FILE_BASE_URL: z.string().url().optional(),
  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_SECRET: process.env.JWT_SECRET,
    AES_KEY: process.env.AES_KEY,
    FILE_STORAGE_DIR: process.env.FILE_STORAGE_DIR,
    FILE_BASE_URL: process.env.FILE_BASE_URL,
    SESSION_COOKIE_SECURE: process.env.SESSION_COOKIE_SECURE,
    WX_APPID: process.env.WX_APPID,
    WX_SECRET: process.env.WX_SECRET,
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_AES_KEY: process.env.NEXT_PUBLIC_AES_KEY,
    NEXT_PUBLIC_FILE_BASE_URL: process.env.NEXT_PUBLIC_FILE_BASE_URL,
  },
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
   * useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  /**
   * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
   * `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});
