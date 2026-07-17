import { z } from "zod";
import { createTRPCRouter, restaurantProcedure, restaurantPermissionProcedure, assertRestaurantAccess,permissionProcedure } from "~/server/api/trpc";
import { PERMISSIONS } from "~/server/auth/profile";

/**
 * 餐厅路由
 * 提供餐厅的增删改查功能
 * 非 admin 用户仅可访问自身关联的餐厅
 */
export const restaurantRouter = createTRPCRouter({
  /** 获取餐厅列表，支持搜索和分页，非 admin 仅返回关联餐厅 */
  list: restaurantProcedure
    .input(
      z.object({
        keyword: z.string().optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(10),
      }),
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {};
      if (input.keyword) {
        where.OR = [
          { name: { contains: input.keyword, mode: "insensitive" as const } },
          { contact_person: { contains: input.keyword, mode: "insensitive" as const } },
        ];
      }
      if (ctx.restaurantIds !== null) {
        where.id = { in: ctx.restaurantIds };
      }
      const [items, total] = await Promise.all([
        ctx.db.restaurant.findMany({
          where,
          orderBy: { created_at: "desc" },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        ctx.db.restaurant.count({ where }),
      ]);
      return { items, total };
    }),

  /** 获取全部餐厅（用于下拉选择），非 admin 仅返回关联餐厅 */
  all: restaurantProcedure.query(async ({ ctx }) => {
    const where = ctx.restaurantIds !== null ? { id: { in: ctx.restaurantIds } } : {};
    return ctx.db.restaurant.findMany({ where, orderBy: { name: "asc" } });
  }),

  /** 根据 ID 获取单个餐厅，校验餐厅归属 */
  getById: restaurantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      assertRestaurantAccess(ctx.restaurantIds, input.id);
      return ctx.db.restaurant.findUniqueOrThrow({ where: { id: input.id } });
    }),

  /** 创建餐厅 */
  create: permissionProcedure(PERMISSIONS.RESTAURANTS_CREATE)
    .input(
      z.object({
        name: z.string().min(1, "餐厅名称不能为空"),
        contact_person: z.string().min(1, "负责人不能为空"),
        contact_phone: z.string().min(1, "联系电话不能为空"),
        address: z.string().min(1, "地址不能为空"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.restaurant.create({ data: { ...input, created_by: ctx.session.userId, updated_by: ctx.session.userId } });
    }),

  /** 更新餐厅，校验餐厅归属 */
  update: restaurantPermissionProcedure(PERMISSIONS.RESTAURANTS_UPDATE)
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1, "餐厅名称不能为空"),
        contact_person: z.string().min(1, "负责人不能为空"),
        contact_phone: z.string().min(1, "联系电话不能为空"),
        address: z.string().min(1, "地址不能为空"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertRestaurantAccess(ctx.restaurantIds, input.id);
      const { id, ...data } = input;
      const result = await ctx.db.restaurant.update({ where: { id }, data: { ...data, updated_by: ctx.session.userId } });
      return result;
    }),

  /** 删除餐厅，校验餐厅归属 */
  delete: restaurantPermissionProcedure(PERMISSIONS.RESTAURANTS_DELETE)
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      assertRestaurantAccess(ctx.restaurantIds, input.id);
      return ctx.db.restaurant.delete({ where: { id: input.id } });
    }),
});
