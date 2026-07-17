import { z } from "zod";
import { createTRPCRouter, protectedProcedure, permissionProcedure } from "~/server/api/trpc";
import { PERMISSIONS } from "~/server/auth/profile";

/**
 * 计量单位路由
 * 提供单位的增删改查功能
 */
export const unitRouter = createTRPCRouter({
  /** 获取单位列表，支持关键字搜索和分页 */
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
        ctx.db.unit.findMany({
          where,
          orderBy: { created_at: "desc" },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        ctx.db.unit.count({ where }),
      ]);
      return { items, total };
    }),

  /** 获取全部单位（用于下拉选择） */
  all: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.unit.findMany({ orderBy: { name: "asc" } });
  }),
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.unit.findUnique({ where: { id: input.id } });
    }),

  /** 创建单位 */
  create: permissionProcedure(PERMISSIONS.UNITS_CREATE)
    .input(
      z.object({
        name: z.string().min(1, "单位名称不能为空"),
        min_value: z.number().nullable().optional(),
        max_value: z.number().nullable().optional(),
        description: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.unit.create({
        data: {
          name: input.name,
          min_value: input.min_value,
          max_value: input.max_value,
          description: input.description,
          created_by: ctx.session.userId,
          updated_by: ctx.session.userId,
        },
      });
    }),

  /** 更新单位 */
  update: permissionProcedure(PERMISSIONS.UNITS_UPDATE)
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1, "单位名称不能为空"),
        min_value: z.number().nullable().optional(),
        max_value: z.number().nullable().optional(),
        description: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const result = await ctx.db.unit.update({ where: { id }, data: { ...data, updated_by: ctx.session.userId } });
      return result;
    }),

  /** 删除单位 */
  delete: permissionProcedure(PERMISSIONS.UNITS_DELETE)
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.unit.delete({ where: { id: input.id } });
    }),
});
