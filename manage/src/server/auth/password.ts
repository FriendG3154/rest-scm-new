import "server-only";

import { createHash, randomBytes } from "crypto";
import CryptoJS from "crypto-js";
import { env } from "~/env";

/**
 * AES 解密前端传来的密文，还原明文密码
 * @param cipherText - 前端 AES 加密后的 Base64 字符串
 * @returns 解密后的明文密码
 */
export function decryptPassword(cipherText: string): string {
  const key = CryptoJS.enc.Utf8.parse(env.AES_KEY);
  const iv = CryptoJS.enc.Utf8.parse(env.AES_KEY.slice(0, 16));
  const decrypted = CryptoJS.AES.decrypt(cipherText, key, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  return decrypted.toString(CryptoJS.enc.Utf8);
}

/**
 * 生成带盐的 MD5 哈希
 * 格式：salt:md5(salt + password)
 * @param password - 明文密码
 * @returns 带盐的 MD5 哈希字符串
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = createHash("md5")
    .update(salt + password)
    .digest("hex");
  return `${salt}:${hash}`;
}

/**
 * 验证密码是否匹配
 * @param password - 明文密码
 * @param stored - 数据库中存储的 salt:hash 字符串
 * @returns 是否匹配
 */
export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const computed = createHash("md5")
    .update(salt + password)
    .digest("hex");
  return computed === hash;
}
