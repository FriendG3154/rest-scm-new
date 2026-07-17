import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import {
  createSession,
  destroySession,
  verifySession,
  signTokenPair,
  verifyTokenString,
} from "~/server/auth/session";
import { decryptPassword, verifyPassword, hashPassword } from "~/server/auth/password";
import { getPermissions } from "~/server/auth/profile";
import { code2Session, getPhoneNumber } from "~/server/auth/wechat";
import { writeAuditLog, extractClientInfo } from "~/server/audit-log";

/**
 * 认证路由
 * 提供登录、登出、获取当前用户信息
 */
export const authRouter = createTRPCRouter({
  /**
   * 登录
   * 前端传入 AES 加密后的密码，后端解密后与数据库中的 MD5 哈希比对
   */
  login: publicProcedure
    .input(
      z.object({
        username: z.string().min(1, "账号不能为空"),
        password: z.string().min(1, "密码不能为空"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // 根据手机号查找成员
      const member = await ctx.db.member.findFirst({
        where: { phone: input.username },
      });
      if (!member) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "账号或密码错误",
        });
      }

      // 解密前端 AES 密文，得到明文密码
      let plainPassword: string;
      try {
        plainPassword = decryptPassword(input.password);
      } catch {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "密码解密失败",
        });
      }

      // 校验密码
      if (!member.password || !verifyPassword(plainPassword, member.password)) {
        const { ip, user_agent } = extractClientInfo(ctx.headers);
        void writeAuditLog({
          user_id: member.id,
          user_name: member.name,
          action: "login",
          module: "auth",
          detail: { method: "password", phone: input.username, reason: "密码错误" },
          result: "fail",
          ip,
          user_agent,
        });
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "账号或密码错误",
        });
      }
      if(member.role_type ==="user"){
        const { ip, user_agent } = extractClientInfo(ctx.headers);
         void writeAuditLog({
          user_id: member.id,
          user_name: member.name,
          action: "login",
          module: "auth",
          detail: { method: "auth_type", phone: input.username, reason: "账号类型不允许登录" },
          result: "fail",
          ip,
          user_agent,
        });
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "账号类型不允许登录",
        });
      }
      const profile = getPermissions(member.role_type);
      await createSession({
        userId: member.id,
        name: member.name,
        role: member.role_type,
        profile,
      });

      const { ip, user_agent } = extractClientInfo(ctx.headers);
      void writeAuditLog({
        user_id: member.id,
        user_name: member.name,
        action: "login",
        module: "auth",
        detail: { method: "password", phone: input.username },
        ip,
        user_agent,
      });

      return {
        success: true,
        user: {
          name: member.name,
          role: member.role_type,
          profile,
        },
      };
    }),

  /**
   * 登出
   * 清除 session cookie
   */
  logout: publicProcedure.mutation(async () => {
    await destroySession();
    return { success: true };
  }),

  /**
   * 获取当前登录用户信息
   * 会自动触发 token 刷新逻辑
   * @returns 用户信息，包含关联的餐厅 ID 列表（admin 返回 null 表示拥有全部餐厅权限）
   */
  me: publicProcedure.query(async ({ ctx }) => {
    const session = await verifySession();
    if (!session) {
      return null;
    }

    // admin 拥有全部餐厅权限，restaurantIds 为 null
    let restaurantIds: string[] | null = null;
    if (session.role !== "admin") {
      const memberships = await ctx.db.memberRestaurant.findMany({
        where: { member_id: session.userId },
        select: { restaurant_id: true },
      });
      restaurantIds = memberships.map((m) => m.restaurant_id);
    }

    return {
      userId: session.userId,
      name: session.name,
      role: session.role,
      profile: session.profile,
      restaurantIds,
    };
  }),

  /**
   * 修改密码
   * 需要验证旧密码，修改成功后销毁 session 强制重新登录
   * @param oldPassword - AES 加密的旧密码
   * @param newPassword - 新密码明文
   */
  changePassword: protectedProcedure
    .input(
      z.object({
        oldPassword: z.string().min(1, "请输入旧密码"),
        newPassword: z.string().min(6, "新密码至少 6 位"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const member = await ctx.db.member.findUnique({
        where: { id: ctx.session.userId },
      });
      if (!member) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "用户不存在",
        });
      }

      // 解密前端 AES 密文
      let plainOldPassword: string;
      try {
        plainOldPassword = decryptPassword(input.oldPassword);
      } catch {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "密码解密失败",
        });
      }

      // 校验旧密码
      if (!member.password || !verifyPassword(plainOldPassword, member.password)) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "旧密码错误",
        });
      }

      // 更新密码
      await ctx.db.member.update({
        where: { id: ctx.session.userId },
        data: { password: hashPassword(input.newPassword) },
      });

      // 销毁 session，强制重新登录
      await destroySession();

      return { success: true };
    }),

  /**
   * 小程序登录
   * 通过手机号和密码登录，返回 token 对（不写入 cookie）
   * @param phone - 手机号
   * @param password - 明文密码（HTTPS 传输保障安全）
   */
  mobileLogin: publicProcedure
    .input(
      z.object({
        phone: z.string().min(1, "手机号不能为空"),
        password: z.string().min(1, "密码不能为空"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const member = await ctx.db.member.findFirst({
        where: { phone: input.phone },
        include: { restaurants: { include: { restaurant: true } } },
      });
      if (!member) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "账号或密码错误",
        });
      }

      if (!member.password || !verifyPassword(input.password, member.password)) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "账号或密码错误",
        });
      }

      const profile = getPermissions(member.role_type);
      const tokens = await signTokenPair({
        userId: member.id,
        name: member.name,
        role: member.role_type,
        profile,
      });

      const { ip, user_agent } = extractClientInfo(ctx.headers);
      void writeAuditLog({
        user_id: member.id,
        user_name: member.name,
        action: "login",
        module: "auth",
        detail: { method: "mobile_password", phone: input.phone },
        ip,
        user_agent,
      });

      return {
        success: true,
        user: {
          id: member.id,
          name: member.name,
          role: member.role_type,
          avatar_url: member.avatar_url,
          profile,
          restaurants: member.restaurants.map((r) => ({
            id: r.restaurant.id,
            name: r.restaurant.name,
            address: r.restaurant.address,
          })),
        },
        ...tokens,
      };
    }),

  /**
   * 微信手机号快捷登录
   * 前端通过 getPhoneNumber 获取手机号 code + wx.login() 获取登录 code
   * 后端用登录 code 换取 openid，用手机号 code 获取手机号，自动匹配/绑定用户
   * @param code - wx.login() 返回的临时登录凭证
   * @param phoneCode - getPhoneNumber 事件返回的 code
   */
  wechatLogin: publicProcedure
    .input(
      z.object({
        code: z.string().min(1, "code 不能为空"),
        phoneCode: z.string().min(1, "手机号授权码不能为空"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // 1. 用 code 换取 openid + session_key
      const wxResult = await code2Session(input.code);
      if (!wxResult.openid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "微信登录失败，请重试",
        });
      }

      // 2. 用 phoneCode 获取手机号
      let phone: string;
      try {
        phone = await getPhoneNumber(input.phoneCode);
      } catch {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "获取手机号失败，请重试",
        });
      }

      // 3. 按手机号查找用户，手机号不存在则禁止登录
      const member = await ctx.db.member.findFirst({
        where: { phone },
        include: { restaurants: { include: { restaurant: true } } },
      });

      if (!member) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "该手机号未注册，请联系管理员添加账号",
        });
      }

      // 4. 绑定或更新微信信息
      if (member.wx_openid !== wxResult.openid) {
        await ctx.db.member.update({
          where: { id: member.id },
          data: {
            wx_openid: wxResult.openid,
            wx_unionid: wxResult.unionid ?? null,
            wx_session_key: wxResult.session_key,
          },
        });
      } else {
        await ctx.db.member.update({
          where: { id: member.id },
          data: { wx_session_key: wxResult.session_key },
        });
      }

      // 6. 签发 token
      const profile = getPermissions(member.role_type);
      const tokens = await signTokenPair({
        userId: member.id,
        name: member.name,
        role: member.role_type,
        profile,
      });

      const { ip, user_agent } = extractClientInfo(ctx.headers);
      void writeAuditLog({
        user_id: member.id,
        user_name: member.name,
        action: "login",
        module: "auth",
        detail: { method: "wechat", phone },
        ip,
        user_agent,
      });

      return {
        success: true,
        user: {
          id: member.id,
          name: member.name,
          role: member.role_type,
          avatar_url: member.avatar_url,
          profile,
          restaurants: member.restaurants.map((r) => ({
            id: r.restaurant.id,
            name: r.restaurant.name,
            address: r.restaurant.address,
          })),
        },
        ...tokens,
      };
    }),

  /**
   * 刷新 token（供小程序使用）
   * @param refreshToken - 旧的 refreshToken
   * @returns 新的 token 对
   */
  refreshToken: publicProcedure
    .input(z.object({ refreshToken: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const payload = await verifyTokenString(input.refreshToken);
      if (!payload) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "登录已过期，请重新登录",
        });
      }

      // 重新查询用户确保账号仍有效
      const member = await ctx.db.member.findUnique({
        where: { id: payload.userId },
      });
      if (!member) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "用户不存在",
        });
      }

      const profile = getPermissions(member.role_type);
      const tokens = await signTokenPair({
        userId: member.id,
        name: member.name,
        role: member.role_type,
        profile,
      });

      return { success: true, ...tokens };
    }),
});
