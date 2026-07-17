import { z } from "zod";
import { createTRPCRouter, protectedProcedure, permissionProcedure } from "~/server/api/trpc";
import { PERMISSIONS } from "~/server/auth/profile";

/**
 * 食材大类路由
 * 提供分类的增删改查功能
 */
export const categoryRouter = createTRPCRouter({
  /** 获取分类列表，支持搜索和分页 */
  list: protectedProcedure
    .input(
      z.object({
        keyword: z.string().optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(10),
      }),
    )
    .query(async ({ ctx, input }) => {
      const where = input.keyword
        ? { name: { contains: input.keyword, mode: "insensitive" as const } }
        : {};
      const [items, total] = await Promise.all([
        ctx.db.category.findMany({
          where,
          orderBy: { sort_order: "asc" },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
          include: { _count: { select: { ingredients: true } } },
        }),
        ctx.db.category.count({ where }),
      ]);
      return { items, total };
    }),

  /** 获取全部分类（用于下拉选择） */
  all: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.category.findMany({ orderBy: { sort_order: "asc" } });
  }),
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.category.findUnique({ where: { id: input.id } });
    }),
  /** 创建分类 */
  create: permissionProcedure(PERMISSIONS.CATEGORIES_CREATE)
    .input(
      z.object({
        name: z.string().min(1, "分类名称不能为空"),
        sort_order: z.number().int().default(0),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.category.create({ data: { ...input, created_by: ctx.session.userId, updated_by: ctx.session.userId } });
    }),

  /** 更新分类 */
  update: permissionProcedure(PERMISSIONS.CATEGORIES_UPDATE)
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1, "分类名称不能为空"),
        sort_order: z.number().int().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const result = await ctx.db.category.update({ where: { id }, data: { ...data, updated_by: ctx.session.userId } });
      return result;
    }),

  /** 删除分类 */
  delete: permissionProcedure(PERMISSIONS.CATEGORIES_DELETE)
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.category.delete({ where: { id: input.id } });
    }),
});
