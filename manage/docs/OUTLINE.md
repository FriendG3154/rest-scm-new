# 餐饮供应链管理系统（REST-SCM）前端开发大纲

## 一、项目概述

基于 Next.js App Router + tRPC + Prisma + Ant Design 的餐饮企业后台管理系统，管理从供应商、食材、餐厅到需求、采购的全链路流程。

---

## 二、技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | Next.js 15 (App Router) |
| UI 组件库 | Ant Design 5.x |
| API 层 | tRPC v11 |
| 数据库 | PostgreSQL + Prisma ORM |
| 样式 | Tailwind CSS |
| 状态管理 | React Query (tRPC 内置) |

---

## 三、数据库模型（Prisma Schema）

### 3.1 食材大类 `Category`
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID v7 | 主键，自动生成 |
| name | String | 分类名称 |
| icon | String? | 图标标识 |
| sort_order | Int | 排序序号 |
| created_at | DateTime | 创建时间 |
| updated_at | DateTime | 更新时间 |

### 3.2 食材小类/SKU `Ingredient`
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID v7 | 主键 |
| sku_code | String @unique | SKU 编码，如 SKU-VEG-001 |
| name | String | 食材名称 |
| category_id | UUID | 所属大类 FK |
| unit_id | UUID | 计量单位 FK |
| image_url | String? | 图片 URL |
| description | String? | 说明描述 |
| created_at | DateTime | |
| updated_at | DateTime | |

### 3.3 计量单位 `Unit`
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID v7 | 主键 |
| name | String | 单位名称，如 克(Gram) |
| min_value | Decimal? | 输入限制最小值 |
| max_value | Decimal? | 输入限制最大值 |
| description | String? | 描述 |
| created_at | DateTime | |
| updated_at | DateTime | |

### 3.4 供应商 `Supplier`
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID v7 | 主键 |
| company_name | String | 企业名称 |
| contact_name | String | 联系人姓名 |
| contact_phone | String | 联系人电话 |
| license_number | String? | 营业执照号码 |
| created_at | DateTime | |
| updated_at | DateTime | |

### 3.5 食材-供应商关联 `IngredientSupplier`
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID v7 | 主键 |
| ingredient_id | UUID | FK → Ingredient |
| supplier_id | UUID | FK → Supplier |
| is_default | Boolean | 是否默认供应商 |

### 3.6 餐厅 `Restaurant`
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID v7 | 主键 |
| name | String | 门店名称 |
| contact_person | String | 负责人 |
| contact_phone | String | 联系电话 |
| address | String | 详细地址 |
| created_at | DateTime | |
| updated_at | DateTime | |

### 3.7 成员/人员 `Member`
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID v7 | 主键 |
| name | String | 姓名 |
| role | String | 角色：店长/员工 |
| phone | String | 联系电话 |
| created_at | DateTime | |
| updated_at | DateTime | |

### 3.8 成员-餐厅关联 `MemberRestaurant`
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID v7 | 主键 |
| member_id | UUID | FK → Member |
| restaurant_id | UUID | FK → Restaurant |

### 3.9 采购需求单 `PurchaseRequest`
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID v7 | 主键 |
| request_no | String @unique | 引用 ID，如 RQ-2023-8842 |
| restaurant_id | UUID | FK → Restaurant |
| status | String | pending/approved/completed |
| submitted_at | DateTime | 提交日期 |
| created_at | DateTime | |
| updated_at | DateTime | |

### 3.10 采购需求明细 `PurchaseRequestItem`
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID v7 | 主键 |
| request_id | UUID | FK → PurchaseRequest |
| ingredient_id | UUID | FK → Ingredient |
| quantity | Decimal | 数量 |
| supplier_id | UUID? | 对应供应商 FK |

---

## 四、前端页面结构

### 4.1 全局布局 `src/app/layout.tsx`
- 顶部导航栏：品牌标识、全局搜索、通知、设置、用户头像
- 侧边栏菜单：
  - 工作台（仪表盘）
  - 组织机构 → 餐厅管理、人员管理
  - 食材库 → 食材大类、食材小类
  - 供应商管理
  - 采购管理 → 需求清单、历史供货单
  - 单位管理

### 4.2 登录页 `/login`
- 品牌 Logo + 系统名称
- 账号输入框（带图标）
- 密码输入框（带显示/隐藏切换）
- 记住登录状态复选框
- 登录按钮

### 4.3 仪表盘 `/dashboard`
- 统计卡片：待处理订单数、已汇总订单数
- 统一单据中心表格：引用ID、餐厅实体、物品数量、提交日期
- 日期过滤：今天/本周/本月

### 4.4 食材大类管理 `/categories`
- **列表页**：序号、图标、名称、SKU数量、操作（修改/删除）
- **新增/编辑弹窗**：分类名称输入框
- 搜索功能
- 分页

### 4.5 食材小类管理 `/ingredients`
- **列表页**：预览图、SKU编码(Badge)、名称、单位、供应商数量、说明、操作
- **新增/编辑弹窗**：食材编码、名称、分类图片上传、单位选择、说明、关联供应商(多选)
- 搜索功能
- 分页

### 4.6 供应商管理 `/suppliers`
- **列表页**：供应商名称、联系人、联系电话、营业执照号码、操作
- **新增/编辑弹窗**：企业名称、联系人姓名、联系人电话、营业执照号码
- 搜索功能
- 分页

### 4.7 餐厅管理 `/restaurants`
- **列表页**：餐厅名称、负责人、联系电话、详细地址、操作
- **新增/编辑弹窗**：门店名称、联系人、手机号码、详细地址
- 分页

### 4.8 人员管理 `/members`
- **列表页**：姓名(含头像/ID)、角色(Badge)、联系方式、管理餐厅(Tags)、操作
- **新增/编辑弹窗**：姓名、角色选择、联系电话、管辖餐厅(多选Tag)
- 筛选：所属店铺、角色
- 分页

### 4.9 单位管理 `/units`
- **列表页**：单位名称、输入限制范围、描述、更新时间、操作
- **新增/编辑弹窗**：单位名称、最小值、最大值、描述
- 搜索功能
- 分页

### 4.10 采购需求清单 `/procurement/requests`
- 视图切换：按餐厅归纳/按供应商归纳/按食材归纳
- 分组表格：按餐厅分组显示食材列表
- 可编辑数量字段
- 删除行项
- 审核提交按钮

### 4.11 历史供货单 `/procurement/history`
- 日期筛选器 + 查询按钮
- 视图切换（同上）
- 分组只读表格：食材名称、单位/数量、对应供应商
- 分页

---

## 五、tRPC 路由结构

```
appRouter
├── category    → list / create / update / delete
├── ingredient  → list / getById / create / update / delete
├── unit        → list / create / update / delete
├── supplier    → list / create / update / delete
├── restaurant  → list / create / update / delete
├── member      → list / create / update / delete
└── purchase    → listRequests / getRequestDetail / createRequest / updateItem / deleteItem / approve
```

---

## 六、开发优先级

| 阶段 | 内容 | 说明 |
|------|------|------|
| P0 | 数据库 Schema + 全局布局 | 基础设施 |
| P1 | 单位管理、食材大类 | 最简单的 CRUD，跑通全链路 |
| P2 | 供应商管理、食材小类 | 含关联关系 |
| P3 | 餐厅管理、人员管理 | 含多对多关联 |
| P4 | 仪表盘、采购管理 | 业务复杂度最高 |
| P5 | 登录页 | 认证体系 |

---

## 七、文件目录规划

```
src/
├── app/
│   ├── layout.tsx                 # 根布局（ConfigProvider, TRPCProvider）
│   ├── page.tsx                   # 重定向到 /dashboard
│   ├── login/
│   │   └── page.tsx               # 登录页
│   ├── (admin)/                   # 需登录的页面组
│   │   ├── layout.tsx             # 管理后台布局（侧边栏+顶部栏）
│   │   ├── dashboard/
│   │   │   └── page.tsx
│   │   ├── categories/
│   │   │   └── page.tsx
│   │   ├── ingredients/
│   │   │   └── page.tsx
│   │   ├── suppliers/
│   │   │   └── page.tsx
│   │   ├── restaurants/
│   │   │   └── page.tsx
│   │   ├── members/
│   │   │   └── page.tsx
│   │   ├── units/
│   │   │   └── page.tsx
│   │   └── procurement/
│   │       ├── requests/
│   │       │   └── page.tsx
│   │       └── history/
│   │           └── page.tsx
│   └── api/trpc/[trpc]/route.ts   # tRPC 入口
├── server/
│   ├── db.ts
│   └── api/
│       ├── root.ts
│       ├── trpc.ts
│       └── routers/
│           ├── category.ts
│           ├── ingredient.ts
│           ├── unit.ts
│           ├── supplier.ts
│           ├── restaurant.ts
│           ├── member.ts
│           └── purchase.ts
└── trpc/                          # 客户端 tRPC 配置
```
