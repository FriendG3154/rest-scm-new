import { authRouter } from "~/server/api/routers/auth";
import { categoryRouter } from "~/server/api/routers/category";
import { ingredientRouter } from "~/server/api/routers/ingredient";
import { memberRouter } from "~/server/api/routers/member";
import { orderRouter } from "~/server/api/routers/order";
import { restaurantRouter } from "~/server/api/routers/restaurant";
import { supplierRouter } from "~/server/api/routers/supplier";
import { unitRouter } from "~/server/api/routers/unit";
import { auditLogRouter } from "~/server/api/routers/audit-log";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

/**
 * 主路由
 * 注册所有子路由
 */
export const appRouter = createTRPCRouter({
  auth: authRouter,
  category: categoryRouter,
  ingredient: ingredientRouter,
  member: memberRouter,
  order: orderRouter,
  restaurant: restaurantRouter,
  supplier: supplierRouter,
  unit: unitRouter,
  auditLog: auditLogRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
