import CryptoJS from "crypto-js";
import { env } from "~/env";

/**
 * AES 加密密码（前端调用）
 * 使用 CBC 模式 + PKCS7 填充
 * @param plainText - 明文密码
 * @returns Base64 编码的密文
 */
export function encryptPassword(plainText: string): string {
  const key = CryptoJS.enc.Utf8.parse(env.NEXT_PUBLIC_AES_KEY);
  const iv = CryptoJS.enc.Utf8.parse(env.NEXT_PUBLIC_AES_KEY.slice(0, 16));
  const encrypted = CryptoJS.AES.encrypt(plainText, key, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  return encrypted.toString();
}
