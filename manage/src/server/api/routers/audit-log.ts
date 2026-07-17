import { z } from "zod";
import { createTRPCRouter, permissionProcedure } from "~/server/api/trpc";
import { PERMISSIONS } from "~/server/auth/profile";

/**
 * 审计日志路由
 * 提供日志查询功能，仅管理员可访问
 */
export const auditLogRouter = createTRPCRouter({
  /**
   * 查询审计日志列表
   * 支持按用户、模块、操作类型、时间范围、结果筛选
   * @param keyword - 用户名关键字
   * @param module - 模块名称
   * @param action - 操作类型
   * @param result - 操作结果
   * @param start_date - 开始时间
   * @param end_date - 结束时间
   * @param page - 页码
   * @param pageSize - 每页数量
   */
  list: permissionProcedure(PERMISSIONS.MEMBERS_READ)
    .input(
      z.object({
        keyword: z.string().optional(),
        module: z.string().optional(),
        action: z.string().optional(),
        result: z.enum(["success", "fail"]).optional(),
        start_date: z.string().optional(),
        end_date: z.string().optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(10),
      }),
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {};

      if (input.keyword) {
        where.user_name = { contains: input.keyword, mode: "insensitive" };
      }
      if (input.module) {
        where.module = input.module;
      }
      if (input.action) {
        where.action = input.action;
      }
      if (input.result) {
        where.result = input.result;
      }
      if (input.start_date || input.end_date) {
        const created_at: Record<string, Date> = {};
        if (input.start_date) {
          created_at.gte = new Date(input.start_date);
        }
        if (input.end_date) {
          created_at.lte = new Date(input.end_date + "T23:59:59.999Z");
        }
        where.created_at = created_at;
      }

      const [items, total] = await Promise.all([
        ctx.db.auditLog.findMany({
          where,
          orderBy: { created_at: "desc" },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        ctx.db.auditLog.count({ where }),
      ]);

      return { items, total };
    }),

  /**
   * 获取日志模块和操作类型的可选值（用于筛选下拉）
   */
  options: permissionProcedure(PERMISSIONS.MEMBERS_READ).query(async ({ ctx }) => {
    const [modules, actions] = await Promise.all([
      ctx.db.auditLog.findMany({
        select: { module: true },
        distinct: ["module"],
        orderBy: { module: "asc" },
      }),
      ctx.db.auditLog.findMany({
        select: { action: true },
        distinct: ["action"],
        orderBy: { action: "asc" },
      }),
    ]);

    return {
      modules: modules.map((m) => m.module),
      actions: actions.map((a) => a.action),
    };
  }),
});
