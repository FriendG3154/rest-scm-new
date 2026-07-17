import "server-only";

import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";
import { env } from "~/env";

const SESSION_COOKIE = "rest-scm-session";
const TOKEN_MAX_AGE = 30 * 60; // 30 分钟（秒）
const REFRESH_TOKEN_MAX_AGE = 60 * 60; // 1 小时（秒）
const shouldUseSecureCookie = env.SESSION_COOKIE_SECURE
  ? env.SESSION_COOKIE_SECURE === "true"
  : process.env.NODE_ENV === "production";

/** JWT 载荷类型 */
export interface SessionPayload extends JWTPayload {
  userId: string;
  name: string;
  role: string;
  profile: string[];
}

/** Session 结构，存储在 cookie 中（JSON） */
interface SessionData {
  token: string;
  refreshToken: string;
}

const secret = new TextEncoder().encode(env.JWT_SECRET);

/**
 * 签发 JWT
 * @param payload - 用户信息载荷
 * @param expiresInSeconds - 过期时间（秒）
 */
async function signToken(
  payload: Omit<SessionPayload, "iat" | "exp">,
  expiresInSeconds: number,
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${expiresInSeconds}s`)
    .sign(secret);
}

/**
 * 验证 JWT，返回载荷或 null
 * @param token - JWT 字符串
 */
async function verifyToken(
  token: string,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

/**
 * 创建 session 并写入 httpOnly cookie
 * 同时签发 token（30min）和 refreshToken（1h）
 * @param payload - 用户信息
 */
export async function createSession(
  payload: Pick<SessionPayload, "userId" | "name" | "role" | "profile">,
): Promise<void> {
  const token = await signToken(payload, TOKEN_MAX_AGE);
  const refreshToken = await signToken(payload, REFRESH_TOKEN_MAX_AGE);

  const sessionData: SessionData = { token, refreshToken };
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, JSON.stringify(sessionData), {
    httpOnly: true,
    secure: shouldUseSecureCookie,
    sameSite: "lax",
    path: "/",
    maxAge: REFRESH_TOKEN_MAX_AGE,
  });
}

/**
 * 验证当前 session
 * - token 有效 → 直接返回用户信息
 * - token 过期但 refreshToken 有效 → 刷新 token 并写入新 session，返回用户信息
 * - 均无效 → 返回 null
 */
export async function verifySession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  if (!raw) return null;

  let sessionData: SessionData;
  try {
    sessionData = JSON.parse(raw) as SessionData;
  } catch {
    return null;
  }

  // 1. 尝试验证 token
  const tokenPayload = await verifyToken(sessionData.token);
  if (tokenPayload) {
    return tokenPayload;
  }

  // 2. token 过期，尝试用 refreshToken 刷新
  const refreshPayload = await verifyToken(sessionData.refreshToken);
  if (!refreshPayload) {
    // refreshToken 也过期，清除 session
    cookieStore.delete(SESSION_COOKIE);
    return null;
  }

  // 3. refreshToken 有效，签发新 token + refreshToken 并更新 cookie
  const newPayload = {
    userId: refreshPayload.userId,
    name: refreshPayload.name,
    role: refreshPayload.role,
    profile: refreshPayload.profile,
  };
  const newToken = await signToken(newPayload, TOKEN_MAX_AGE);
  const newRefreshToken = await signToken(newPayload, REFRESH_TOKEN_MAX_AGE);

  const newSessionData: SessionData = {
    token: newToken,
    refreshToken: newRefreshToken,
  };
  cookieStore.set(SESSION_COOKIE, JSON.stringify(newSessionData), {
    httpOnly: true,
    secure: shouldUseSecureCookie,
    sameSite: "lax",
    path: "/",
    maxAge: REFRESH_TOKEN_MAX_AGE,
  });

  return { ...newPayload } as SessionPayload;
}

/**
 * 签发 token 对（供小程序等移动端使用，不写入 cookie，直接返回）
 * @param payload - 用户信息
 * @returns token 和 refreshToken
 */
export async function signTokenPair(
  payload: Pick<SessionPayload, "userId" | "name" | "role" | "profile">,
): Promise<{ token: string; refreshToken: string }> {
  const token = await signToken(payload, TOKEN_MAX_AGE);
  const refreshToken = await signToken(payload, REFRESH_TOKEN_MAX_AGE);
  return { token, refreshToken };
}

/**
 * 从 token 字符串验证并返回载荷（供移动端 Authorization header 使用）
 * @param token - JWT 字符串
 * @returns 用户载荷或 null
 */
export async function verifyTokenString(
  token: string,
): Promise<SessionPayload | null> {
  return verifyToken(token);
}

/**
 * 销毁 session（退出登录）
 */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
