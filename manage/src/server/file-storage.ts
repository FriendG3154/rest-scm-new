import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { env } from "~/env";

const MIME_EXT_MAP: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/svg+xml": ".svg",
};

const EXT_CONTENT_TYPE_MAP: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

/**
 * 规范化并确保本地附件目录存在。
 */
export async function ensureStorageDir() {
  await fs.mkdir(env.FILE_STORAGE_DIR, { recursive: true });
}

/**
 * 根据 MIME 获取文件后缀；未知类型回退为 .bin。
 */
export function resolveFileExtension(mimeType: string): string {
  return MIME_EXT_MAP[mimeType] ?? ".bin";
}

/**
 * 生成数据库中保存的 URL（优先绝对 URL，否则相对 URL）。
 */
export function buildFileUrl(relativePath: string): string {
  if (!env.FILE_BASE_URL) {
    return relativePath;
  }
  return new URL(relativePath, env.FILE_BASE_URL).toString();
}

/**
 * 生成安全文件名。
 */
export function createStoredFileName(mimeType: string): string {
  return `${randomUUID()}${resolveFileExtension(mimeType)}`;
}

/**
 * 将文件写入本地附件目录。
 */
export async function writeBufferToStorage(fileName: string, content: Buffer) {
  await ensureStorageDir();
  const fullPath = path.join(env.FILE_STORAGE_DIR, fileName);
  await fs.writeFile(fullPath, content);
  return fullPath;
}

/**
 * 将 URL 路径转换为本地绝对路径并进行目录越界校验。
 */
export function resolveStorageFilePath(pathSegments: string[]): string {
  const safeSegments = pathSegments.filter((segment) => segment && segment !== ".");
  const storageRoot = path.resolve(env.FILE_STORAGE_DIR);
  const target = path.resolve(storageRoot, ...safeSegments);
  if (target !== storageRoot && !target.startsWith(`${storageRoot}${path.sep}`)) {
    throw new Error("非法文件路径");
  }
  return target;
}

/**
 * 根据文件后缀推断响应 Content-Type。
 */
export function resolveContentTypeByPath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return EXT_CONTENT_TYPE_MAP[ext] ?? "application/octet-stream";
}
