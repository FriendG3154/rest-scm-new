# Copilot 项目全局指令
## 1. 技术栈与编码规范
- 编程语言：TS，
- 框架：Next.js，tRPC
- 样式：Tailwind CSS，遵循原子化原则，禁止使用全局样式
- 组件库：ant-design，禁止引入其他 UI 库
- 缓存: Redis 
- ui中间层: refine
- ORM: Prisma
- 后台通过Trpc暴露API，前端通过App Router调用Trpc接口
- 代码风格：遵循 Airbnb JavaScript Style Guide，使用 Prettier 格式化代码
- 目录结构：前端代码放在 `src/app`，后端代码放在 `src/server`，数据库模型放在 `prisma`
- 数据库：PostgreSQL，使用 Prisma 进行 ORM 映射
- 错误处理：后端必须使用 try-catch 捕获异常并返回统一格式的错误响应，前端必须对 API 错误进行友好提示
- 数据库字段命名：使用小写字母和下划线分隔（snake_case），例如 `user_id`、`created_at`,`created_by`，避免使用驼峰命名或其他风格
- id字段：所有数据库表的主键字段必须命名为 `id`，改为uuid.v7，并且设置为自动生成，禁止手动赋值。
- 命名规则：函数用小驼峰，类用大驼峰，常量全大写加下划线，Agent 相关类名必须以「Agent」结尾
- 注释要求：核心函数必须写中文文档字符串（docstring），包含入参、出参、功能描述

## 2. 项目概述
这是餐饮企业的后台管理系统，核心目标是管理从供应商、食材、餐厅，到需求、采购的全链路流程。

## 3. 项目目录
- `src/app`：前端代码，包含页面组件、UI 组件、样式等
- `src/server`：后端代码，包含 API 路由、业务逻辑、数据库访问等
- `prisma`：Prisma 数据模型定义和迁移文件
-  `generated/prisma`：Prisma 生成的客户端代码
- `public`：静态资源，如图片、字体等
- `src/env.js`：环境变量校验入口，使用 zod 定义和验证环境变量