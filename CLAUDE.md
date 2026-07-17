# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

餐饮供应链管理系统（REST-SCM），管理从供应商、食材、餐厅到采购需求的全链路。包含两个子项目：

- **`manage/`** — Next.js 15 管理后台（Web 端）
- **`wechat/`** — 微信小程序（门店员工移动端）

## 常用命令

所有命令在 `manage/` 目录下执行：

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器 (Turbopack) |
| `npm run build` | 生产构建 |
| `npm run start` | 启动生产服务器 |
| `npm run lint` | ESLint 检查 |
| `npm run lint:fix` | ESLint 自动修复 |
| `npm run check` | lint + typecheck 全量检查 |
| `npm run typecheck` | TypeScript 类型检查 |
| `npm run format:check` | Prettier 格式检查 |
| `npm run format:write` | Prettier 自动格式化 |
| `npm run db:generate` | Prisma 迁移 + 客户端生成 |
| `npm run db:push` | Prisma schema 推送到数据库（无迁移文件） |
| `npm run db:studio` | 启动 Prisma Studio 可视化管理 |
| `npm run db:migrate` | 生产环境执行迁移 |

`npm install` 后会自动执行 `prisma generate`。

## 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | Next.js 15 (App Router)，`output: "standalone"` |
| API | tRPC v11，统一入口 `/api/trpc/[trpc]` |
| ORM | Prisma v6 + PostgreSQL |
| UI | Ant Design 6.x + Refine (`@refinedev/antd` + `@refinedev/core`) |
| 样式 | Tailwind CSS v4（原子化，禁用全局样式），禁止引入其他 UI 库 |
| 认证 | JWT (jose)，Web 端 httpOnly cookie，小程序 Bearer token |
| 校验 | Zod（环境变量 + tRPC 入参） |
| 序列化 | SuperJSON |
| 加密 | AES-CBC (crypto-js) 传输加密，MD5+salt 存储哈希 |
| 格式化 | Prettier + `prettier-plugin-tailwindcss` |
| 检查 | ESLint v9 flat config + typescript-eslint |

## 目录结构

```
manage/
  src/
    app/                        # 前端页面（App Router）
      layout.tsx                # 根布局（AntdRegistry + TRPCProvider）
      page.tsx                  # 登录页 (/)
      (admin)/                  # 需认证的页面路由组
        layout.tsx              # 管理后台布局（侧边栏 + 顶栏 + Refine）
        dashboard/page.tsx
        categories/page.tsx
        ingredients/page.tsx
        suppliers/page.tsx
        restaurants/page.tsx
        members/page.tsx
        units/page.tsx
        audit-logs/page.tsx
        procurement/
          requests/page.tsx     # 采购需求清单（可编辑、审核）
          history/page.tsx      # 历史供货单（只读，按日期查询）
      api/
        trpc/[trpc]/route.ts    # tRPC 统一入口
        upload/route.ts         # 图片上传（max 300KB）
        files/[...path]/route.ts# 静态文件服务
    server/
      db.ts                     # Prisma 单例
      api/
        root.ts                 # AppRouter 聚合所有子路由
        trpc.ts                 # tRPC 初始化 + context + 中间件
        routers/                # 子路由器
          auth.ts               # 登录/登出/修改密码/Token 刷新
          category.ts           # 食材大类 CRUD
          ingredient.ts         # 食材小类 CRUD + 供应商关联
          unit.ts               # 计量单位 CRUD
          supplier.ts           # 供应商 CRUD
          restaurant.ts         # 餐厅 CRUD
          member.ts             # 成员 CRUD + 餐厅分配
          order.ts              # 采购订单 CRUD、审批、统计、汇总
          audit-log.ts          # 审计日志查询
      auth/
        session.ts              # JWT 签发/验证 + Cookie 管理
        password.ts             # AES 解密 + MD5+salt 哈希
        profile.ts              # 权限定义 + 角色-权限映射
        wechat.ts               # 微信 code2Session + getPhoneNumber
      audit-log.ts              # 审计日志写入服务
      file-storage.ts           # 本地文件读写
    trpc/
      react.tsx                 # tRPC React Provider + api 客户端
      server.ts                 # 服务端 tRPC 调用器（RSC 用）
      query-client.ts           # TanStack QueryClient 配置
    lib/
      refine-data-provider.ts   # Refine DataProvider 适配器（桥接 tRPC）
      access-control.ts         # Refine AccessControlProvider（权限映射）
      crypto.ts                 # 前端 AES 加密
    hook/
      use-permission.ts         # 权限检查 Hook
      use-restaurant-access.ts  # 餐厅访问权检查 Hook
    components/
      require-permission.tsx    # 权限门控组件
    middleware.ts               # Edge 中间件（JWT 校验 + 路由守卫）
  prisma/
    schema.prisma               # 数据模型定义（10 张表）
wechat/
  app.js / app.json / app.wxss   # 小程序入口 + 全局配置（Skyline 渲染）
  pages/                         # 5 个页面：login, list, summary, profile, send-order
  api/                           # tRPC API 调用封装
  utils/
    request.js                   # wx.request tRPC 客户端 + Token 自动刷新队列
    auth.js                      # Token/用户存储 + 权限检查
    util.js                      # 工具函数
  components/navigation-bar/     # 自定义导航栏
  custom-tab-bar/                # 自定义底部 Tab 栏（3 Tab）
```

## 数据库模型

所有表使用 `snake_case` 字段命名，主键为 UUID v7（`gen_random_uuid()` 自动生成），包含 `created_at`/`updated_at` 时间戳字段。核心表：

| 表 | 用途 | 关键关联 |
|---|------|---------|
| `category` | 食材大类 | |
| `ingredient` | 食材 SKU | FK → category, unit; M:N ↔ supplier |
| `unit` | 计量单位（含 min/max 限制） | |
| `supplier` | 供应商 | M:N ↔ ingredient |
| `ingredient_supplier` | 食材-供应商关联（含 is_default） | |
| `restaurant` | 餐厅门店 | M:N ↔ member |
| `member` | 成员/用户 | M:N ↔ restaurant |
| `member_restaurant` | 成员-餐厅关联 | |
| `order` | 采购需求单 | FK → restaurant |
| `order_item` | 采购明细行 | FK → order, ingredient, supplier |
| `audit_log` | 操作审计日志 | |

## 认证与权限

**双端认证：**
- Web 管理后台：密码登录 → AES 解密 → MD5+salt 验证 → JWT 对（30min/1h）存入 httpOnly cookie
- 微信小程序：手机号+密码 或 微信手机号快捷登录 → JWT 对返回为 Bearer token

**角色与权限：**
- `admin`（店长）：全部权限
- `user`（员工）：只读采购相关权限
- 细粒度权限字符串（如 `categories:create`、`procurement:review`），通过 `profile.ts` 定义

**tRPC 中间件链：**
`timingMiddleware` → `auditLogMiddleware`（自动记录所有变更）→ `authMiddleware`（JWT 验证）→ `restaurantMemberMiddleware`（加载餐厅归属）→ `permissionProcedure(perm)`（权限检查）

所有 mutation 自动写入 `audit_log` 表。

## tRPC API 路由

```
appRouter
  auth          → login, logout, me, changePassword, mobileLogin, wechatLogin, refreshToken
  category      → list, all, getById, create, update, delete
  ingredient    → list, listAll, getById, create, update, delete
  unit          → list, all, getById, create, update, delete
  supplier      → list, all, getById, create, update, delete
  restaurant    → list, all, getById, create, update, delete
  member        → list, getById, create, update, delete, resetPassword
  order         → listRequests, todaylistRequests, getRequestDetail, createRequest,
                   updateItem, deleteItem, approve, stats, summaryToday, orderCountByDate
  auditLog      → list, options
```

`list` 返回分页列表，`all` 返回全量（用于下拉选择）。order 路由的创建是追加模式：同日同餐厅再次调用会追加明细到已有订单。

## 验证规则（来自 README.md）

- **代码风格**：Airbnb JavaScript Style Guide + Prettier
- **命名**：函数 camelCase，类 PascalCase，常量 UPPER_SNAKE_CASE，Agent 类以 "Agent" 结尾
- **注释**：核心函数必须写中文 docstring（入参、出参、功能描述）
- **错误处理**：后端 try-catch 返回统一格式错误；前端对 API 错误做友好提示
- **数据库字段**：snake_case，主键统一命名为 `id`（UUID v7 自动生成）
- **样式**：只使用 Tailwind 原子化样式，禁止全局样式，禁止引入 Ant Design 以外的 UI 库

## 业务核心流程

管理员配置基础数据（食材、供应商、餐厅、单位、成员）→ 员工在微信小程序为所属餐厅提交每日采购需求 → 店长在管理后台或小程序审核汇总 → 按供应商/餐厅/食材维度生成采购单图片发送给供应商 → 历史订单可追溯查询
