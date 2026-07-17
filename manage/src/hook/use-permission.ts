import { api } from "~/trpc/react";

/**
 * 权限检查 Hook
 * 基于 tRPC auth.me 返回的 permissions 判断
 */
export function usePermission() {
  const { data: user } = api.auth.me.useQuery();

  const hasPermission = (requiredPerms: string | string[]) => {
    if (!user) return false;

    const reqList = Array.isArray(requiredPerms) ? requiredPerms : [requiredPerms];
    const userPerms = user.profile ?? [];

    return reqList.some((p) => (userPerms as string[]).includes(p));
  };

  return { hasPermission };
}
