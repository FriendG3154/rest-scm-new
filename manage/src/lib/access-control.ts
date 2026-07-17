import type { AccessControlProvider } from "@refinedev/core";

/**
 * Refine 资源名到权限前缀的映射
 * 对应 PERMISSIONS 中的 "模块:操作" 格式
 */
const RESOURCE_PERMISSION_MAP: Record<string, string> = {
  restaurants: "restaurants",
  suppliers: "suppliers",
  categories: "categories",
  ingredients: "ingredients",
  units: "units",
  members: "members",
  orders: "procurement",
};

/**
 * Refine action 到权限操作后缀的映射
 */
const ACTION_PERMISSION_MAP: Record<string, string> = {
  list: "read",
  show: "read",
  create: "create",
  edit: "update",
  delete: "delete",
  clone: "create",
};

/**
 * 创建 Refine accessControlProvider
 * 根据用户 profile（权限列表）判断是否允许执行指定资源的指定操作
 * @param permissions - 当前用户的权限字符串数组（从 auth.me 获取）
 * @param isLoading - 权限数据是否仍在加载中，加载中时全部返回 can:true 避免按钮闪烁
 * @returns AccessControlProvider
 */
export function createAccessControlProvider(
  permissions: string[],
  isLoading: boolean,
): AccessControlProvider {
  return {
    can: async ({ resource, action }) => {
      // 权限数据尚未加载完成时，暂时全部允许
      if (isLoading) {
        return { can: true };
      }
      // 无资源或无动作时默认允许（如仪表盘）
      if (!resource || !action) {
        return { can: true };
      }

      const permPrefix = RESOURCE_PERMISSION_MAP[resource];
      if (!permPrefix) {
        // 未注册的资源默认允许
        return { can: true };
      }

      const permSuffix = ACTION_PERMISSION_MAP[action];
      if (!permSuffix) {
        // 未知动作默认允许
        return { can: true };
      }

      // 订单审核特殊处理：edit 动作映射到 review 权限
      if (resource === "orders" && action === "edit") {
        const canReview = permissions.includes("procurement:review");
        return {
          can: canReview,
          reason: canReview ? undefined : "无审核权限",
        };
      }

      const requiredPerm = `${permPrefix}:${permSuffix}`;
      const hasPerm = permissions.includes(requiredPerm);

      return {
        can: hasPerm,
        reason: hasPerm ? undefined : "无操作权限",
      };
    },
  };
}
