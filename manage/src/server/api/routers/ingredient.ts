import { z } from "zod";
import { createTRPCRouter, protectedProcedure, permissionProcedure } from "~/server/api/trpc";
import { PERMISSIONS } from "~/server/auth/profile";

/**
 * 食材（SKU）路由
 * 提供食材的增删改查功能，包含关联供应商管理
 */
export const ingredientRouter = createTRPCRouter({
  /** 获取食材列表，支持搜索、分类筛选和分页 */
  list: protectedProcedure
    .input(
      z.object({
        keyword: z.string().optional(),
        category_id: z.string().uuid().optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(10),
      }),
    )
    .query(async ({ ctx, input }) => {
      const where = {
        ...(input.keyword
          ? {
              OR: [
                { name: { contains: input.keyword, mode: "insensitive" as const } },
                { sku_code: { contains: input.keyword, mode: "insensitive" as const } },
              ],
            }
          : {}),
        ...(input.category_id ? { category_id: input.category_id } : {}),
      };
      const [items, total] = await Promise.all([
        ctx.db.ingredient.findMany({
          where,
          orderBy: { created_at: "desc" },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
          include: {
            category: true,
            unit: true,
            suppliers: { include: { supplier: true }, orderBy: { is_default: "desc" } },
          },
        }),
        ctx.db.ingredient.count({ where }),
      ]);
      return { items, total };
    }),

  /** 获取全量食材列表（不分页），用于小程序导入清单 */
  listAll: protectedProcedure
    .query(async ({ ctx }) => {
      const items = await ctx.db.ingredient.findMany({
        orderBy: { created_at: "desc" },
        include: {
          category: true,
          unit: true,
          suppliers: { include: { supplier: true }, orderBy: { is_default: "desc" } },
        },
      });
      return items;
    }),

  /** 获取食材详情 */
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.ingredient.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          category: true,
          unit: true,
          suppliers: { include: { supplier: true }, orderBy: { is_default: "desc" } },
        },
      });
    }),

  /** 创建食材 */
  create: permissionProcedure(PERMISSIONS.INGREDIENTS_CREATE)
    .input(
      z.object({
        sku_code: z.string().min(1, "SKU编码不能为空"),
        name: z.string().min(1, "食材名称不能为空"),
        category_id: z.string().uuid(),
        unit_id: z.string().uuid(),
        icon: z.string().nullable().optional(),
        image_url: z.string().nullable().optional(),
        description: z.string().nullable().optional(),
        supplier_ids: z.array(z.string().uuid()).default([]),
        default_supplier_id: z.string().uuid().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { supplier_ids, default_supplier_id, ...data } = input;
      return ctx.db.ingredient.create({
        data: {
          ...data,
          created_by: ctx.session.userId,
          updated_by: ctx.session.userId,
          suppliers: {
            create: supplier_ids.map((supplier_id) => ({
              supplier_id,
              is_default: supplier_id === default_supplier_id,
            })),
          },
        },
        include: { category: true, unit: true, suppliers: { include: { supplier: true }, orderBy: { is_default: "desc" } } },
      });
    }),

  /** 更新食材 */
  update: permissionProcedure(PERMISSIONS.INGREDIENTS_UPDATE)
    .input(
      z.object({
        id: z.string().uuid(),
        sku_code: z.string().min(1, "SKU编码不能为空"),
        name: z.string().min(1, "食材名称不能为空"),
        category_id: z.string().uuid(),
        unit_id: z.string().uuid(),
        icon: z.string().nullable().optional(),
        image_url: z.string().nullable().optional(),
        description: z.string().nullable().optional(),
        supplier_ids: z.array(z.string().uuid()).default([]),
        default_supplier_id: z.string().uuid().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, supplier_ids, default_supplier_id, ...data } = input;
      await ctx.db.ingredientSupplier.deleteMany({ where: { ingredient_id: id } });
      const result = await ctx.db.ingredient.update({
        where: { id },
        data: {
          ...data,
          updated_by: ctx.session.userId,
          suppliers: {
            create: supplier_ids.map((supplier_id) => ({
              supplier_id,
              is_default: supplier_id === default_supplier_id,
            })),
          },
        },
        include: { category: true, unit: true, suppliers: { include: { supplier: true }, orderBy: { is_default: "desc" } } },
      });
      return result;
    }),

  /** 删除食材 */
  delete: permissionProcedure(PERMISSIONS.INGREDIENTS_DELETE)
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.ingredient.delete({ where: { id: input.id } });
    }),
});
