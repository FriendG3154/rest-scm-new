/**
 * YOU PROBABLY DON'T NEED TO EDIT THIS FILE, UNLESS:
 * 1. You want to modify request context (see Part 1).
 * 2. You want to create a new middleware or type of procedure (see Part 3).
 *
 * TL;DR - This is where all the tRPC server stuff is created and plugged in. The pieces you will
 * need to use are documented accordingly near the end.
 */
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";

import { db } from "~/server/db";
import { verifySession, verifyTokenString, type SessionPayload } from "~/server/auth/session";
import { hasPermission, type Permission } from "~/server/auth/profile";
import { writeAuditLog, extractClientInfo } from "~/server/audit-log";

/**
 * 1. CONTEXT
 *
 * This section defines the "contexts" that are available in the backend API.
 *
 * These allow you to access things when processing a request, like the database, the session, etc.
 *
 * This helper generates the "internals" for a tRPC context. The API handler and RSC clients each
 * wrap this and provides the required context.
 *
 * @see https://trpc.io/docs/server/context
 */
export const createTRPCContext = async (opts: { headers: Headers }) => {
  // 1. 先尝试从 cookie 验证 session（管理端）
  let session = await verifySession();

  // 2. 如果 cookie 无 session，尝试从 Authorization header 验证（小程序端）
  if (!session) {
    const authHeader = opts.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      session = await verifyTokenString(token);
    }
  }
  return {
    db,
    session,
    ...opts,
  };
};

/**
 * 2. INITIALIZATION
 *
 * This is where the tRPC API is initialized, connecting the context and transformer. We also parse
 * ZodErrors so that you get typesafety on the frontend if your procedure fails due to validation
 * errors on the backend.
 */
const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

/**
 * Create a server-side caller.
 *
 * @see https://trpc.io/docs/server/server-side-calls
 */
export const createCallerFactory = t.createCallerFactory;

/**
 * 3. ROUTER & PROCEDURE (THE IMPORTANT BIT)
 *
 * These are the pieces you use to build your tRPC API. You should import these a lot in the
 * "/src/server/api/routers" directory.
 */

/**
 * This is how you create new routers and sub-routers in your tRPC API.
 *
 * @see https://trpc.io/docs/router
 */
export const createTRPCRouter = t.router;

/**
 * Middleware for timing procedure execution and adding an artificial delay in development.
 *
 * You can remove this if you don't like it, but it can help catch unwanted waterfalls by simulating
 * network latency that would occur in production but not in local development.
 */
const timingMiddleware = t.middleware(async ({ next, path }) => {
  const start = Date.now();

  // if (t._config.isDev) {
  //   // artificial delay in dev
  //   const waitMs = Math.floor(Math.random() * 400) + 100;
  //   await new Promise((resolve) => setTimeout(resolve, waitMs));
  // }

  const result = await next();

  const end = Date.now();
  console.log(`[TRPC] ${path} took ${end - start}ms to execute`);

  return result;
});

/**
 * 审计日志中间件
 * 自动记录所有 mutation 操作的审计日志
 * 从 tRPC path 中解析模块名和操作类型
 */
const auditLogMiddleware = t.middleware(async ({ next, path, type, ctx }) => {
  const result = await next();

  // 仅记录 mutation 操作（不记录 query）
  if (type !== "mutation") {
    return result;
  }

  // 跳过日志查询自身和 refreshToken
  if (path === "auditLog.list" || path === "auth.refreshToken" || path === "auth.me") {
    return result;
  }

  // 解析 path 得到 module 和 action，如 "auth.login" → module="auth", action="login"
  const [module, action] = path.split(".");
  const session = ctx.session as SessionPayload | null | undefined;
  const { ip, user_agent } = extractClientInfo(ctx.headers);

  // 异步写入日志，不阻塞响应
  void writeAuditLog({
    user_id: session?.userId ?? null,
    user_name: session?.name ?? null,
    action: action ?? path,
    module: module ?? "unknown",
    result: result.ok ? "success" : "fail",
    ip,
    user_agent,
  });

  return result;
});

/**
 * Public (unauthenticated) procedure
 *
 * This is the base piece you use to build new queries and mutations on your tRPC API. It does not
 * guarantee that a user querying is authorized, but you can still access user session data if they
 * are logged in.
 */
export const publicProcedure = t.procedure.use(timingMiddleware).use(auditLogMiddleware);

/**
 * 鉴权中间件
 * 检查 session 是否有效，无效则抛出 UNAUTHORIZED
 */
const authMiddleware = t.middleware(async ({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "请先登录",
    });
  }
  return next({
    ctx: {
      session: ctx.session,
    },
  });
});

/**
 * 需要登录的 procedure
 * 在 ctx 中保证 session 存在且类型为 SessionPayload
 */
export const protectedProcedure = t.procedure
  .use(timingMiddleware)
  .use(auditLogMiddleware)
  .use(authMiddleware);

/**
 * 需要特定权限的 procedure 工厂函数
 * @param permission - 所需权限标识
 * @returns 带权限校验的 procedure
 */
export function permissionProcedure(permission: Permission) {
  return protectedProcedure.use(async ({ ctx, next }) => {
    if (!hasPermission(ctx.session.role, permission)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "无操作权限",
      });
    }
    return next({ ctx });
  });
}

/**
 * 餐厅归属校验中间件
 * 加载当前用户关联的餐厅 ID 列表到上下文
 * admin 角色跳过校验，拥有全部餐厅权限
 */
const restaurantMemberMiddleware = t.middleware(async ({ ctx, next }) => {
  const session = ctx.session as SessionPayload;

  // if (session.role === "admin") {
  //   return next({
  //     ctx: {
  //       restaurantIds: null as string[] | null,
  //     },
  //   });
  // }

  const memberships = await ctx.db.memberRestaurant.findMany({
    where: { member_id: session.userId },
    select: { restaurant_id: true },
  });

  const restaurantIds = memberships.map((m) => m.restaurant_id);

  if (restaurantIds.length === 0) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "您未关联任何餐厅，请重新登录",
    });
  }

  return next({
    ctx: {
      restaurantIds: restaurantIds as string[] | null,
    },
  });
});

/**
 * 需要餐厅归属校验的 procedure
 * ctx 中增加 restaurantIds:
 * - null: admin 角色，拥有全部餐厅权限
 * - string[]: 用户关联的餐厅 ID 列表
 */
export const restaurantProcedure = protectedProcedure.use(restaurantMemberMiddleware);

/**
 * 同时需要餐厅归属校验和特定权限的 procedure 工厂函数
 * @param permission - 所需权限标识
 * @returns 带权限及餐厅归属校验的 procedure
 */
export function restaurantPermissionProcedure(permission: Permission) {
  return restaurantProcedure.use(async ({ ctx, next }) => {
    if (!hasPermission(ctx.session.role, permission)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "无操作权限",
      });
    }
    return next({ ctx });
  });
}

/**
 * 校验用户是否有权访问指定餐厅
 * @param restaurantIds - 用户关联的餐厅 ID 列表，null 表示 admin 拥有全部权限
 * @param targetId - 目标餐厅 ID
 * @throws TRPCError UNAUTHORIZED - 用户不属于该餐厅
 */
export function assertRestaurantAccess(
  restaurantIds: string[] | null,
  targetId: string,
) {
  if (restaurantIds !== null && !restaurantIds.includes(targetId)) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "您不属于该餐厅，请重新登录",
    });
  }
}
