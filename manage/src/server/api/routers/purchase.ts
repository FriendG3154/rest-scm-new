import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";

/**
 * 订单管理路由
 * 提供订单的查看、创建、编辑、审批功能
 */
export const orderRouter = createTRPCRouter({
  /** 获取订单列表 */
  listRequests: publicProcedure
    .input(
      z.object({
        status: z.string().optional(),
        restaurant_id: z.string().uuid().optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(10),
      }),
    )
    .query(async ({ ctx, input }) => {
      const where = {
        ...(input.status ? { status: input.status } : {}),
        ...(input.restaurant_id ? { restaurant_id: input.restaurant_id } : {}),
      };
      const [items, total] = await Promise.all([
        ctx.db.order.findMany({
          where,
          orderBy: { created_at: "desc" },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
          include: {
            restaurant: true,
            items: {
              include: {
                ingredient: { include: { unit: true } },
                supplier: true,
              },
            },
          },
        }),
        ctx.db.order.count({ where }),
      ]);
      return { items, total };
    }),

  /** 获取订单详情 */
  getRequestDetail: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.order.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          restaurant: true,
          items: {
            include: {
              ingredient: { include: { unit: true, category: true } },
              supplier: true,
            },
          },
        },
      });
    }),

  /** 创建订单 */
  createRequest: protectedProcedure
    .input(
      z.object({
        restaurant_id: z.string().uuid(),
        items: z.array(
          z.object({
            ingredient_id: z.string().uuid(),
            quantity: z.number().positive("数量必须大于0"),
            supplier_id: z.string().uuid().nullable().optional(),
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const count = await ctx.db.order.count();
      const request_no = `RQ-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;
      return ctx.db.order.create({
        data: {
          request_no,
          restaurant_id: input.restaurant_id,
          created_by: ctx.session.userId,
          updated_by: ctx.session.userId,
          items: { create: input.items },
        },
        include: {
          restaurant: true,
          items: { include: { ingredient: { include: { unit: true } }, supplier: true } },
        },
      });
    }),

  /** 更新订单明细项数量 */
  updateItem: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        quantity: z.number().positive("数量必须大于0"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.orderItem.update({
        where: { id: input.id },
        data: { quantity: input.quantity },
      });
    }),

  /** 删除订单明细项 */
  deleteItem: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.orderItem.delete({ where: { id: input.id } });
    }),

  /** 审核/批准订单 */
  approve: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.order.update({
        where: { id: input.id },
        data: { status: "approved", updated_by: ctx.session.userId },
      });
    }),

  /** 仪表盘统计 */
  stats: publicProcedure.query(async ({ ctx }) => {
    const [pendingCount, approvedCount] = await Promise.all([
      ctx.db.order.count({ where: { status: "pending" } }),
      ctx.db.order.count({ where: { status: "approved" } }),
    ]);
    return { pendingCount, approvedCount };
  }),
});


