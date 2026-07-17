import { z } from "zod";
import { createTRPCRouter, protectedProcedure, permissionProcedure } from "~/server/api/trpc";
import { hashPassword } from "~/server/auth/password";
import { PERMISSIONS } from "~/server/auth/profile";

/**
 * 成员/人员路由
 * 提供成员的增删改查功能，包含餐厅关联管理
 */
export const memberRouter = createTRPCRouter({
  /** 获取成员列表，支持搜索、按餐厅/角色筛选和分页 */
  list: protectedProcedure
    .input(
      z.object({
        keyword: z.string().optional(),
        restaurant_id: z.string().uuid().optional(),
        role_type: z.string().optional(),
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
                { phone: { contains: input.keyword, mode: "insensitive" as const } },
              ],
            }
          : {}),
        ...(input.role_type ? { role_type: input.role_type } : {}),
        ...(input.restaurant_id
          ? { restaurants: { some: { restaurant_id: input.restaurant_id } } }
          : {}),
      };
      const [items, total] = await Promise.all([
        ctx.db.member.findMany({
          where,
          orderBy: { created_at: "desc" },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
          include: {
            restaurants: { include: { restaurant: true } },
          },
        }),
        ctx.db.member.count({ where }),
      ]);
      return { items, total };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.member.findUnique({
        where: { id: input.id },
        include: { restaurants: { include: { restaurant: true } } },
      });
    }),

  /** 创建成员 */
  create: permissionProcedure(PERMISSIONS.MEMBERS_CREATE)
    .input(
      z.object({
        name: z.string().min(1, "姓名不能为空"),
        phone: z.string().min(1, "联系电话不能为空"),
        avatar_url: z.string().nullable().optional(),
        password: z.string().min(6, "密码至少 6 位"),
        role_type: z.enum(["admin", "user"]).default("user"),
        restaurant_ids: z.array(z.string().uuid()).default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { restaurant_ids, password, ...data } = input;
      return ctx.db.member.create({
        data: {
          ...data,
          password: hashPassword(password),
          created_by: ctx.session.userId,
          updated_by: ctx.session.userId,
          restaurants: {
            create: restaurant_ids.map((restaurant_id) => ({ restaurant_id })),
          },
        },
        include: { restaurants: { include: { restaurant: true } } },
      });
    }),

  /** 更新成员 */
  update: permissionProcedure(PERMISSIONS.MEMBERS_UPDATE)
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1, "姓名不能为空"),
        phone: z.string().min(1, "联系电话不能为空"),
        avatar_url: z.string().nullable().optional(),
        password: z.string().min(6, "密码至少 6 位").optional(),
        role_type: z.enum(["admin", "user"]).optional(),
        restaurant_ids: z.array(z.string().uuid()).default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, restaurant_ids, password, ...data } = input;
      await ctx.db.memberRestaurant.deleteMany({ where: { member_id: id } });
      const result = await ctx.db.member.update({
        where: { id },
        data: {
          ...data,
          ...(password ? { password: hashPassword(password) } : {}),
          updated_by: ctx.session.userId,
          restaurants: {
            create: restaurant_ids.map((restaurant_id) => ({ restaurant_id })),
          },
        },
        include: { restaurants: { include: { restaurant: true } } },
      });
      return result;
    }),

  /** 删除成员 */
  delete: permissionProcedure(PERMISSIONS.MEMBERS_DELETE)
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.member.delete({ where: { id: input.id } });
    }),

  /**
   * 管理员重置成员密码
   * @param memberId - 目标成员 ID
   * @param newPassword - 新密码明文
   */
  resetPassword: permissionProcedure(PERMISSIONS.MEMBERS_UPDATE)
    .input(
      z.object({
        memberId: z.string().uuid(),
        newPassword: z.string().min(6, "密码至少 6 位"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.member.update({
        where: { id: input.memberId },
        data: {
          password: hashPassword(input.newPassword),
          updated_by: ctx.session.userId,
        },
      });
      return result;
    }),
});
