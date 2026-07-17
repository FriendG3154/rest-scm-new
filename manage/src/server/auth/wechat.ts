import "server-only";

import { env } from "~/env";

/** 微信 code2Session 接口返回结构 */
interface WxCode2SessionResult {
  openid: string;
  session_key: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
}

/** 微信获取手机号接口返回结构 */
interface WxPhoneNumberResult {
  errcode: number;
  errmsg: string;
  phone_info?: {
    phoneNumber: string;
    purePhoneNumber: string;
    countryCode: string;
    watermark?: {
      timestamp: number;
      appid: string;
    };
  };
}

/** 微信接口 access_token 缓存 */
let accessTokenCache: { token: string; expiresAt: number } | null = null;

/**
 * 获取微信接口调用凭据 access_token（带缓存）
 * @returns access_token 字符串
 * @throws 当微信接口返回错误时抛出异常
 */
async function getAccessToken(): Promise<string> {
  // 缓存未过期则直接返回（提前 5 分钟刷新）
  if (accessTokenCache && Date.now() < accessTokenCache.expiresAt - 5 * 60 * 1000) {
    return accessTokenCache.token;
  }

  const url = new URL("https://api.weixin.qq.com/cgi-bin/token");
  url.searchParams.set("grant_type", "client_credential");
  url.searchParams.set("appid", env.WX_APPID);
  url.searchParams.set("secret", env.WX_SECRET);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`获取 access_token 失败: ${response.status}`);
  }

  const data = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    errcode?: number;
    errmsg?: string;
  };

  if (data.errcode && data.errcode !== 0) {
    throw new Error(`获取 access_token 失败: ${data.errmsg ?? "未知错误"} (${data.errcode})`);
  }

  if (!data.access_token) {
    throw new Error("获取 access_token 失败: 返回为空");
  }

  accessTokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 7200) * 1000,
  };

  return accessTokenCache.token;
}

/**
 * 调用微信 code2Session 接口，用临时 code 换取 openid 和 session_key
 * @param code - wx.login() 返回的临时登录凭证
 * @returns openid、session_key、unionid 等信息
 * @throws 当微信接口返回错误时抛出异常
 */
export async function code2Session(code: string): Promise<WxCode2SessionResult> {
  const url = new URL("https://api.weixin.qq.com/sns/jscode2session");
  url.searchParams.set("appid", env.WX_APPID);
  url.searchParams.set("secret", env.WX_SECRET);
  url.searchParams.set("js_code", code);
  url.searchParams.set("grant_type", "authorization_code");

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`微信接口请求失败: ${response.status}`);
  }

  const data = (await response.json()) as WxCode2SessionResult;
  if (data.errcode && data.errcode !== 0) {
    throw new Error(`微信登录失败: ${data.errmsg ?? "未知错误"} (${data.errcode})`);
  }

  return data;
}

/**
 * 通过手机号 code 获取用户手机号（新版接口，2023+ 推荐方式）
 * @param phoneCode - getPhoneNumber 事件返回的 code
 * @returns 去掉区号的纯手机号码
 * @throws 当微信接口返回错误时抛出异常
 */
export async function getPhoneNumber(phoneCode: string): Promise<string> {
  const accessToken = await getAccessToken();

  const response = await fetch(
    `https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=${accessToken}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: phoneCode }),
    },
  );

  if (!response.ok) {
    throw new Error(`获取手机号失败: ${response.status}`);
  }

  const data = (await response.json()) as WxPhoneNumberResult;
  if (data.errcode !== 0 || !data.phone_info) {
    throw new Error(`获取手机号失败: ${data.errmsg ?? "未知错误"} (${data.errcode})`);
  }

  return data.phone_info.purePhoneNumber;
}
