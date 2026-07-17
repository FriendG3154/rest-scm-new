import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE = "rest-scm-session";
const PUBLIC_PATHS = [
  "/api/trpc/auth.login",
  "/api/trpc/auth.logout",
  "/api/trpc/auth.mobileLogin",
  "/api/trpc/auth.wechatLogin",
  "/api/trpc/auth.refreshToken",
  "/api/files",
];

/**
 * Next.js 中间件
 * 拦截非公开路由，校验 session cookie 中 token / refreshToken 的有效性
 * 如果未登录则重定向到 /login
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 放行公开路径和静态资源
  if (
    pathname === "/" ||
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  const raw = request.cookies.get(SESSION_COOKIE)?.value;

  const secret = new TextEncoder().encode(
    process.env.JWT_SECRET ?? "",
  );

  // 小程序端通过 Authorization Bearer token 认证
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const bearerToken = authHeader.slice(7);
    try {
      await jwtVerify(bearerToken, secret);
      return NextResponse.next();
    } catch {
      // Bearer token 无效，继续检查 cookie
    }
  }

  if (!raw) {
    // API 请求返回 401，页面请求重定向
    if (pathname.startsWith("/api/")) {
      return new NextResponse(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    return NextResponse.redirect(new URL("/", request.url));
  }

  let sessionData: { token: string; refreshToken: string };
  try {
    sessionData = JSON.parse(raw) as { token: string; refreshToken: string };
  } catch {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // 验证 token 或 refreshToken 至少一个有效
  try {
    await jwtVerify(sessionData.token, secret);
    return NextResponse.next();
  } catch {
    // token 过期，尝试 refreshToken
  }

  try {
    await jwtVerify(sessionData.refreshToken, secret);
    // refreshToken 有效，放行请求（tRPC context 中的 verifySession 会自动刷新 token）
    return NextResponse.next();
  } catch {
    // 两个 token 都过期
    const response = NextResponse.redirect(new URL("/", request.url));
    response.cookies.delete(SESSION_COOKIE);
    return response;
  }
}

export const config = {
  matcher: [
    // 匹配所有路径，排除静态资源
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
