
/**
 * 权限定义常量
 * 格式：模块:操作
 */
export const PERMISSIONS = {
  // 食材大类
  CATEGORIES_READ: "categories:read",
  CATEGORIES_CREATE: "categories:create",
  CATEGORIES_UPDATE: "categories:update",
  CATEGORIES_DELETE: "categories:delete",
  // 食材/SKU
  INGREDIENTS_READ: "ingredients:read",
  INGREDIENTS_CREATE: "ingredients:create",
  INGREDIENTS_UPDATE: "ingredients:update",
  INGREDIENTS_DELETE: "ingredients:delete",
  // 供应商
  SUPPLIERS_READ: "suppliers:read",
  SUPPLIERS_CREATE: "suppliers:create",
  SUPPLIERS_UPDATE: "suppliers:update",
  SUPPLIERS_DELETE: "suppliers:delete",
  // 餐厅
  RESTAURANTS_READ: "restaurants:read",
  RESTAURANTS_CREATE: "restaurants:create",
  RESTAURANTS_UPDATE: "restaurants:update",
  RESTAURANTS_DELETE: "restaurants:delete",
  // 成员管理
  MEMBERS_READ: "members:read",
  MEMBERS_CREATE: "members:create",
  MEMBERS_UPDATE: "members:update",
  MEMBERS_DELETE: "members:delete",
  // 计量单位
  UNITS_READ: "units:read",
  UNITS_CREATE: "units:create",
  UNITS_UPDATE: "units:update",
  UNITS_DELETE: "units:delete",
  // 采购需求
  PROCUREMENT_READ: "procurement:read",
  PROCUREMENT_CREATE: "procurement:create",
  PROCUREMENT_UPDATE: "procurement:update",
  PROCUREMENT_DELETE: "procurement:delete",
  PROCUREMENT_REVIEW: "procurement:review",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/**
 * 角色-权限映射表
 * admin: 拥有所有模块的完整权限
 * user:  仅拥有查看和创建采购需求的权限
 */
const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  admin: Object.values(PERMISSIONS),
  user: [
    PERMISSIONS.CATEGORIES_READ,
    PERMISSIONS.INGREDIENTS_READ,
    PERMISSIONS.SUPPLIERS_READ,
    PERMISSIONS.RESTAURANTS_READ,
    PERMISSIONS.UNITS_READ,
    PERMISSIONS.PROCUREMENT_READ,
    PERMISSIONS.PROCUREMENT_CREATE,
  ],
};

/**
 * 角色显示名映射
 * admin → 店长, user → 员工
 */
export const ROLE_LABELS: Record<string, string> = {
  admin: "店长",
  user: "员工",
};

/**
 * 根据角色获取权限列表
 * @param role - 角色（admin / user）
 * @returns 权限字符串数组
 */
export function getPermissions(role: string): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

/**
 * 检查角色是否拥有指定权限
 * @param role - 角色
 * @param permission - 需要检查的权限
 * @returns 是否拥有该权限
 */
export function hasPermission(role: string, permission: Permission): boolean {
  return getPermissions(role).includes(permission);
}