"use client";
import React from "react";
import { usePermission } from "~/hook/use-permission";

interface RequirePermissionProps {
  permission: string | string[]; // 例如 "user:add"
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function RequirePermission({ permission, children, fallback = null }: RequirePermissionProps) {
  const { hasPermission } = usePermission();

  if (hasPermission(permission)) {
    return <>{children}</>;
  }

  return <>{fallback}</>; // 没有权限时显示占位或隐藏
}
