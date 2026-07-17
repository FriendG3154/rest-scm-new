import { useRouter } from "next/navigation";
import { useEffect, useCallback } from "react";
import { App } from "antd";
import { api } from "~/trpc/react";

/**
 * 餐厅权限校验 Hook
 * 基于 auth.me 返回的 restaurantIds 判断用户是否拥有指定餐厅的访问权限
 * admin 角色拥有全部餐厅权限，普通用户仅能访问关联的餐厅
 * @returns hasRestaurantAccess - 校验函数, restaurantIds - 用户关联的餐厅 ID 列表, isAdmin - 是否为管理员
 */
export function useRestaurantAccess() {
  const { data: user, isLoading } = api.auth.me.useQuery();
  const router = useRouter();
  const { message } = App.useApp();

  const isAdmin = user?.role === "admin";
  const restaurantIds = user?.restaurantIds ?? null;

  /**
   * 校验用户是否有权访问指定餐厅
   * @param targetRestaurantId - 目标餐厅 ID
   * @returns 是否有权限
   */
  const hasRestaurantAccess = useCallback(
    (targetRestaurantId: string): boolean => {
      if (!user) return false;
      // admin 拥有全部餐厅权限
      if (restaurantIds === null) return true;
      return restaurantIds.includes(targetRestaurantId);
    },
    [user, restaurantIds],
  );

  /**
   * 校验餐厅权限，无权限时提示并跳转首页
   * @param targetRestaurantId - 目标餐厅 ID
   * @returns 是否有权限
   */
  const assertRestaurantAccess = useCallback(
    (targetRestaurantId: string): boolean => {
      if (isLoading) return true; // 加载中暂不校验
      const hasAccess = hasRestaurantAccess(targetRestaurantId);
      if (!hasAccess) {
        void message.error("您没有该餐厅的操作权限");
        router.push("/dashboard");
      }
      return hasAccess;
    },
    [hasRestaurantAccess, isLoading, message, router],
  );

  /**
   * 校验用户是否关联了任何餐厅，未关联则跳转首页
   * 适用于页面级别的守卫，在页面加载时自动检查
   */
  const requireAnyRestaurant = useCallback(() => {
    if (isLoading || !user) return;
    if (restaurantIds !== null && restaurantIds.length === 0) {
      void message.error("您未关联任何餐厅，无法进行该操作");
      router.push("/dashboard");
    }
  }, [isLoading, user, restaurantIds, message, router]);

  return {
    isLoading,
    isAdmin,
    restaurantIds,
    hasRestaurantAccess,
    assertRestaurantAccess,
    requireAnyRestaurant,
  };
}

/**
 * 餐厅页面守卫 Hook
 * 在页面挂载时自动检查用户是否关联餐厅，未关联则跳转首页
 * 用于餐厅相关页面的顶层组件
 */
export function useRequireRestaurant() {
  const access = useRestaurantAccess();

  useEffect(() => {
    access.requireAnyRestaurant();
  }, [access]);

  return access;
}
