import type { DataProvider } from "@refinedev/core";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import SuperJSON from "superjson";
import type { AppRouter } from "~/server/api/root";

/**
 * 创建 tRPC 原生客户端（非 React Hooks），供 Refine DataProvider 调用
 * @returns tRPC 客户端实例
 */
function createVanillaClient() {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        transformer: SuperJSON,
        url: getBaseUrl() + "/api/trpc",
      }),
    ],
  });
}

function getBaseUrl() {
  if (typeof window !== "undefined") return window.location.origin;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://localhost:${process.env.PORT ?? 3000}`;
}

/**
 * 资源名称(复数) 到 tRPC 路由名称(单数) 的映射
 */
const RESOURCE_MAP: Record<string, keyof AppRouter> = {
  restaurants: "restaurant",
  suppliers: "supplier",
  categories: "category",
  ingredients: "ingredient",
  units: "unit",
  members: "member",
  orders: "order",
  "audit-logs": "auditLog",
};

/**
 * 从 refine 的 CrudFilters 中提取关键词搜索值
 * @param filters - refine 传入的过滤器数组
 * @returns 关键词字符串或 undefined
 */
function extractKeyword(
  filters?: Array<{ field?: string; operator?: string; value?: unknown }>,
): string | undefined {
  if (!filters?.length) return undefined;
  for (const filter of filters) {
    if (
      "field" in filter &&
      filter.operator === "contains" &&
      filter.value
    ) {
      return String(filter.value);
    }
  }
  return undefined;
}

/**
 * 从 refine 的 CrudFilters 中提取 eq 类型的筛选条件
 * @param filters - refine 传入的过滤器数组
 * @returns 键值对对象，仅包含有值的 eq 筛选字段
 */
function extractEqFilters(
  filters?: Array<{ field?: string; operator?: string; value?: unknown }>,
): Record<string, string> {
  const result: Record<string, string> = {};
  if (!filters?.length) return result;
  for (const filter of filters) {
    if (
      "field" in filter &&
      filter.field &&
      filter.operator === "eq" &&
      filter.value
    ) {
      result[filter.field] = String(filter.value);
    }
  }
  return result;
}

/**
 * 获取 tRPC 路由代理对象
 * @param client - tRPC 客户端
 * @param resource - refine 资源名称
 */
function getRouter(client: ReturnType<typeof createVanillaClient>, resource: string) {
  const routerName = RESOURCE_MAP[resource] ?? resource;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return
  return (client as any)[routerName];
}

/**
 * 基于 tRPC 的 Refine DataProvider
 * 将 refine 的标准数据操作映射到 tRPC 过程调用
 */
export function createTrpcDataProvider(): DataProvider {
  const client = createVanillaClient();

  return {
    /**
     * 获取列表数据，支持分页和关键词搜索
     */
    getList: async ({ resource, pagination, filters }) => {
      const router = getRouter(client, resource);
      const page = pagination?.currentPage ?? 1;
      const pageSize = pagination?.pageSize ?? 10;
      const typedFilters = filters as Array<{ field?: string; operator?: string; value?: unknown }> | undefined;
      const keyword = extractKeyword(typedFilters);
      const eqFilters = extractEqFilters(typedFilters);

      // orders 使用非标准 listRequests 过程，单独映射
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const result = resource === "orders"
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        ? await router.listRequests.query({
            status: eqFilters.status,
            restaurant_id: eqFilters.restaurant_id,
            supplier_id: eqFilters.supplier_id,
            ingredient_id: eqFilters.ingredient_id,
            date_from: eqFilters.date_from,
            date_to: eqFilters.date_to,
            page,
            pageSize,
          })
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        : await router.list.query({
            keyword: keyword || undefined,
            ...eqFilters,
            page,
            pageSize,
          });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      return { data: result.items, total: result.total };
    },

    /**
     * 创建资源
     */
    create: async ({ resource, variables }) => {
      const router = getRouter(client, resource);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const data = resource === "orders"
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        ? await router.createRequest.mutate(variables)
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        : await router.create.mutate(variables);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      return { data };
    },

    /**
     * 更新资源
     */
    update: async ({ resource, id, variables }) => {
      const router = getRouter(client, resource);
      // orders 仅支持审核动作
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const data = resource === "orders"
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        ? await router.approve.mutate({ id })
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        : await router.update.mutate({ id, ...variables as object });
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      return { data };
    },

    /**
     * 删除单个资源
     */
    deleteOne: async ({ resource, id }) => {
      const router = getRouter(client, resource);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const data = await router.delete.mutate({ id });
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      return { data };
    },

    /**
     * 获取单个资源
     */
    getOne: async ({ resource, id }) => {
      const router = getRouter(client, resource);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const data = resource === "orders"
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        ? await router.getRequestDetail.query({ id })
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        : await router.getById.query({ id });
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      return { data };
    },

    getApiUrl: () => getBaseUrl() + "/api/trpc",
  };
}
