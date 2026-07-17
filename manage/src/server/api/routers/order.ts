import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, restaurantProcedure, restaurantPermissionProcedure, assertRestaurantAccess } from "~/server/api/trpc";
import { PERMISSIONS } from "~/server/auth/profile";

/**
 * 校验数量是否在食材单位的范围限制内
 * @param quantity - 输入数量
 * @param unit - 单位对象，包含 min_value 和 max_value
 * @param ingredientName - 食材名称，用于错误提示
 */
function assertQuantityInUnitRange(
  quantity: number,
  unit: { name: string; min_value: unknown; max_value: unknown },
  ingredientName: string,
) {
  const minVal = unit.min_value !== null && unit.min_value !== undefined ? Number(unit.min_value) : null;
  const maxVal = unit.max_value !== null && unit.max_value !== undefined ? Number(unit.max_value) : null;
  if (minVal !== null && quantity < minVal) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `「${ingredientName}」的数量不能小于 ${minVal}${unit.name}`,
    });
  }
  if (maxVal !== null && quantity > maxVal) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `「${ingredientName}」的数量不能大于 ${maxVal}${unit.name}`,
    });
  }
}

/**
 * 订单管理路由
 * 提供订单的查看、创建、编辑、审批功能
 */
export const orderRouter = createTRPCRouter({
  /** 获取订单列表，支持按状态、餐厅、供应商、食材、日期范围筛选，非 admin 仅返回关联餐厅的订单 */
  listRequests: restaurantProcedure
    .input(
      z.object({
        status: z.string().optional(),
        restaurant_id: z.string().uuid().optional(),
        supplier_id: z.string().uuid().optional(),
        ingredient_id: z.string().uuid().optional(),
        date_from: z.string().optional(),
        date_to: z.string().optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(10),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (input.restaurant_id) {
        assertRestaurantAccess(ctx.restaurantIds, input.restaurant_id);
      }
      const where: Record<string, unknown> = {
        ...(input.status ? { status: input.status } : {}),
        ...(input.restaurant_id ? { restaurant_id: input.restaurant_id } : {}),
      };
      // 日期范围筛选（使用本地时区拼接时间避免 UTC 偏移）
      if (input.date_from || input.date_to) {
        const dateFilter: Record<string, Date> = {};
        if (input.date_from) dateFilter.gte = new Date(`${input.date_from}T00:00:00`);
        if (input.date_to) {
          const endDate = new Date(`${input.date_to}T00:00:00`);
          endDate.setDate(endDate.getDate() + 1);
          dateFilter.lt = endDate;
        }
        where.created_at = dateFilter;
      }
      // 非 admin 用户强制过滤关联餐厅
      if (!input.restaurant_id && ctx.restaurantIds !== null) {
        where.restaurant_id = { in: ctx.restaurantIds };
      }
      // 按供应商或食材筛选时，需过滤含有对应明细项的订单
      if (input.supplier_id || input.ingredient_id) {
        where.items = {
          some: {
            ...(input.supplier_id ? { supplier_id: input.supplier_id } : {}),
            ...(input.ingredient_id ? { ingredient_id: input.ingredient_id } : {}),
          },
        };
      }
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

  /**
   * 按日期统计已审核订单数量
   * @param month - 查询月份，格式 YYYY-MM
   * @returns 该月每天的订单数量 { date: string, count: number }[]
   */
  orderCountByDate: restaurantProcedure
    .input(
      z.object({
        month: z.string().regex(/^\d{4}-\d{2}$/),
      }),
    )
    .query(async ({ ctx, input }) => {
      const startDate = new Date(`${input.month}-01T00:00:00`);
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 1);

      const where: Record<string, unknown> = {
        status: "approved",
        created_at: { gte: startDate, lt: endDate },
      };
      if (ctx.restaurantIds !== null) {
        where.restaurant_id = { in: ctx.restaurantIds };
      }

      const orders = await ctx.db.order.findMany({
        where,
        select: { created_at: true },
      });

      const countMap = new Map<string, number>();
      for (const order of orders) {
        const d = order.created_at;
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        countMap.set(dateStr, (countMap.get(dateStr) ?? 0) + 1);
      }

      return Array.from(countMap.entries()).map(([date, count]) => ({ date, count }));
    }),
    
    todaylistRequests: restaurantProcedure
    .input(
      z.object({
        status: z.string().optional(),
        restaurant_id: z.string().uuid().optional()
      }),
    )
    .query(async ({ ctx, input }) => {
      if (input.restaurant_id) {
        assertRestaurantAccess(ctx.restaurantIds, input.restaurant_id);
      }
      const where: Record<string, unknown> = {
        ...(input.status ? { status: input.status } : {}),
        ...(input.restaurant_id ? { restaurant_id: input.restaurant_id } : {}),
        created_at: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
          lt: new Date(new Date().setHours(24, 0, 0, 0)),
        },
      };
      if (!input.restaurant_id && ctx.restaurantIds !== null) {
        where.restaurant_id = { in: ctx.restaurantIds };
      }
      const [items, total] = await Promise.all([
        ctx.db.order.findMany({
          where,
          orderBy: { created_at: "desc" },
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

  /** 获取订单详情，校验餐厅归属 */
  getRequestDetail: restaurantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const order = await ctx.db.order.findUniqueOrThrow({
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
      assertRestaurantAccess(ctx.restaurantIds, order.restaurant_id);
      return order;
    }),

  /** 创建订单，校验餐厅归属 */
  createRequest: restaurantPermissionProcedure(PERMISSIONS.PROCUREMENT_CREATE)
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
      assertRestaurantAccess(ctx.restaurantIds, input.restaurant_id);

      // 校验每个食材数量是否在单位范围内
      const ingredientIds = input.items.map((i) => i.ingredient_id);
      const ingredients = await ctx.db.ingredient.findMany({
        where: { id: { in: ingredientIds } },
        include: { unit: true },
      });
      const ingredientMap = new Map(ingredients.map((ing) => [ing.id, ing]));
      for (const item of input.items) {
        const ing = ingredientMap.get(item.ingredient_id);
        if (ing) {
          assertQuantityInUnitRange(item.quantity, ing.unit, ing.name);
        }
      }

      const count = await ctx.db.order.count();
      const currentYear = new Date().getFullYear();
      const month = new Date().getMonth() + 1;
      const day = new Date().getDate();
      const fullday = `${currentYear}${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}`;
      const fullhead = `RQ-${fullday}`;
      const request_no = `RQ-${fullday}-${String(count + 1).padStart(4, "0")}`;
      if(!request_no) {
        throw new Error("生成订单编号失败");
      }
      const existing = await ctx.db.order.findFirst({
        where: { request_no: { startsWith: fullhead },
        restaurant_id: input.restaurant_id },
        include: { restaurant:true, items: true },
      });
      if (existing) {
        return ctx.db.order.update({
          where: { id: existing.id },
          data: {
            items: { create: input.items },
            updated_by: ctx.session.userId,
          },
          include: {
            restaurant: true,
            items: { include: { ingredient: { include: { unit: true } }, supplier: true } },
          },
        });
      }
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

  /** 更新订单明细项数量，校验订单所属餐厅归属 */
  updateItem: restaurantPermissionProcedure(PERMISSIONS.PROCUREMENT_UPDATE)
    .input(
      z.object({
        id: z.string().uuid(),
        quantity: z.number().positive("数量必须大于0"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.db.orderItem.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          order: { select: { restaurant_id: true } },
          ingredient: { include: { unit: true } },
        },
      });
      assertRestaurantAccess(ctx.restaurantIds, item.order.restaurant_id);
      assertQuantityInUnitRange(input.quantity, item.ingredient.unit, item.ingredient.name);
      const result = await ctx.db.orderItem.update({
        where: { id: input.id },
        data: { quantity: input.quantity },
      });
      return result;
    }),

  /** 删除订单明细项，校验订单所属餐厅归属 */
  deleteItem: restaurantPermissionProcedure(PERMISSIONS.PROCUREMENT_DELETE)
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.db.orderItem.findUniqueOrThrow({
        where: { id: input.id },
        include: { order: { select: { restaurant_id: true } } },
      });
      assertRestaurantAccess(ctx.restaurantIds, item.order.restaurant_id);
      return ctx.db.orderItem.delete({ where: { id: input.id } });
    }),

  /** 审核/批准订单，校验订单所属餐厅归属 */
  approve: restaurantPermissionProcedure(PERMISSIONS.PROCUREMENT_REVIEW)
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const order = await ctx.db.order.findUniqueOrThrow({
        where: { id: input.id },
        select: { restaurant_id: true },
      });
      assertRestaurantAccess(ctx.restaurantIds, order.restaurant_id);
      const result = await ctx.db.order.update({
        where: { id: input.id },
        data: { status: "approved", updated_by: ctx.session.userId },
      });
      return result;
    }),

  /** 仪表盘统计，非 admin 仅统计关联餐厅的订单 */
  stats: restaurantProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const todayFilter = { created_at: { gte: todayStart, lt: todayEnd } };
    const restaurantFilter = ctx.restaurantIds !== null ? { restaurant_id: { in: ctx.restaurantIds } } : {};
    const [pendingCount, approvedCount] = await Promise.all([
      ctx.db.order.count({ where: { status: "pending", ...todayFilter, ...restaurantFilter } }),
      ctx.db.order.count({ where: { status: "approved", ...todayFilter, ...restaurantFilter } }),
    ]);
    return { pendingCount, approvedCount };
  }),

  /**
   * 今日汇总清单
   * 同时返回今天的 pending 和 approved 订单，前端根据数据决定展示逻辑
   * @returns {object} { pendingItems: Order[], approvedItems: Order[], status: string }
   */
  summaryToday: restaurantProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    const todayWhere = {
      created_at: { gte: todayStart, lt: todayEnd },
    };
    const restaurantFilter = ctx.restaurantIds !== null ? { restaurant_id: { in: ctx.restaurantIds } } : {};
    const includeRelations = {
      restaurant: true,
      items: {
        include: {
          ingredient: { include: { unit: true } },
          supplier: true,
        },
      },
    };

    const [pendingOrders, approvedOrders] = await Promise.all([
      ctx.db.order.findMany({
        where: { ...todayWhere, status: "pending", ...restaurantFilter },
        orderBy: { created_at: "desc" },
        include: includeRelations,
      }),
      ctx.db.order.findMany({
        where: { ...todayWhere, status: "approved", ...restaurantFilter },
        orderBy: { created_at: "desc" },
        include: includeRelations,
      }),
    ]);

    // status 字段保持向后兼容：优先 pending，其次 approved
    let status = "";
    if (pendingOrders.length > 0) status = "pending";
    else if (approvedOrders.length > 0) status = "approved";

    // items 保持向后兼容：优先返回 pending，否则返回 approved
    const items = pendingOrders.length > 0 ? pendingOrders : approvedOrders;

    return { items, pendingItems: pendingOrders, approvedItems: approvedOrders, status };
  }),
});
