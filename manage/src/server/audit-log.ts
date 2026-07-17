import { db } from "~/server/db";

/**
 * 审计日志记录参数
 */
export interface AuditLogParams {
  /** 操作用户 ID */
  user_id?: string | null;
  /** 操作用户名称 */
  user_name?: string | null;
  /** 操作类型：login / logout / create / update / delete / approve 等 */
  action: string;
  /** 模块名称：auth / category / ingredient / supplier / restaurant / member / order / unit */
  module: string;
  /** 操作对象 ID */
  target_id?: string | null;
  /** 操作详情（会被序列化为 JSON） */
  detail?: Record<string, unknown> | string | null;
  /** 操作结果：success / fail */
  result?: "success" | "fail";
  /** 客户端 IP */
  ip?: string | null;
  /** 客户端 User-Agent */
  user_agent?: string | null;
}

/**
 * 写入审计日志
 * 异步写入，不阻塞主业务流程，写入失败仅打印错误不抛异常
 * @param params - 日志参数
 */
export async function writeAuditLog(params: AuditLogParams): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        user_id: params.user_id ?? null,
        user_name: params.user_name ?? null,
        action: params.action,
        module: params.module,
        target_id: params.target_id ?? null,
        detail:
          typeof params.detail === "object" && params.detail !== null
            ? JSON.stringify(params.detail)
            : (params.detail ?? null),
        result: params.result ?? "success",
        ip: params.ip ?? null,
        user_agent: params.user_agent ?? null,
      },
    });
  } catch (error) {
    console.error("[AuditLog] 写入审计日志失败:", error);
  }
}

/**
 * 从 Headers 中提取客户端信息
 * @param headers - HTTP 请求头
 * @returns ip 和 user_agent
 */
export function extractClientInfo(headers: Headers): {
  ip: string | null;
  user_agent: string | null;
} {
  const ip =
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers.get("x-real-ip") ??
    null;
  const user_agent = headers.get("user-agent") ?? null;
  return { ip, user_agent };
}
