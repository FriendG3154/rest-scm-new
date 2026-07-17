import { z } from "zod";
import { createTRPCRouter, protectedProcedure, permissionProcedure } from "~/server/api/trpc";
import { PERMISSIONS } from "~/server/auth/profile";

/**
 * 供应商路由
 * 提供供应商的增删改查功能
 */
export const supplierRouter = createTRPCRouter({
  /** 获取供应商列表，支持搜索和分页 */
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
        ? {
            OR: [
              { company_name: { contains: input.keyword, mode: "insensitive" as const } },
              { contact_name: { contains: input.keyword, mode: "insensitive" as const } },
            ],
          }
        : {};
      const [items, total] = await Promise.all([
        ctx.db.supplier.findMany({
          where,
          orderBy: { created_at: "desc" },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        ctx.db.supplier.count({ where }),
      ]);
      return { items, total };
    }),

  /** 获取全部供应商（用于下拉选择） */
  all: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.supplier.findMany({ orderBy: { company_name: "asc" } });
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.supplier.findUnique({ where: { id: input.id } });
    }),

  /** 创建供应商 */
  create: permissionProcedure(PERMISSIONS.SUPPLIERS_CREATE)
    .input(
      z.object({
        company_name: z.string().min(1, "企业名称不能为空"),
        contact_name: z.string().min(1, "联系人不能为空"),
        contact_phone: z.string().min(1, "联系电话不能为空"),
        license_number: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.supplier.create({ data: { ...input, created_by: ctx.session.userId, updated_by: ctx.session.userId } });
    }),

  /** 更新供应商 */
  update: permissionProcedure(PERMISSIONS.SUPPLIERS_UPDATE)
    .input(
      z.object({
        id: z.string().uuid(),
        company_name: z.string().min(1, "企业名称不能为空"),
        contact_name: z.string().min(1, "联系人不能为空"),
        contact_phone: z.string().min(1, "联系电话不能为空"),
        license_number: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const result = await ctx.db.supplier.update({ where: { id }, data: { ...data, updated_by: ctx.session.userId } });
      return result;
    }),

  /** 删除供应商 */
  delete: permissionProcedure(PERMISSIONS.SUPPLIERS_DELETE)
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.supplier.delete({ where: { id: input.id } });
    }),
});
