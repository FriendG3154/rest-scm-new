import { NextResponse } from "next/server";
import {
  buildFileUrl,
  createStoredFileName,
  writeBufferToStorage,
} from "~/server/file-storage";

export const runtime = "nodejs";

/**
 * 上传单个附件到本地磁盘，并返回可访问 URL。
 */
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const uploaded = formData.get("file");

    if (!(uploaded instanceof File)) {
      return NextResponse.json({ message: "缺少文件参数 file" }, { status: 400 });
    }

    if (!uploaded.type.startsWith("image/")) {
      return NextResponse.json({ message: "仅支持图片文件" }, { status: 400 });
    }

    const maxSize = 300 * 1024;
    if (uploaded.size > maxSize) {
      return NextResponse.json({ message: "图片过大，请控制在 300KB 以内" }, { status: 400 });
    }

    const fileName = createStoredFileName(uploaded.type);
    const content = Buffer.from(await uploaded.arrayBuffer());
    await writeBufferToStorage(fileName, content);

    const relativePath = `/api/files/${fileName}`;
    const fileUrl = buildFileUrl(relativePath);

    return NextResponse.json({ url: fileUrl, path: relativePath });
  } catch {
    return NextResponse.json({ message: "上传失败，请稍后重试" }, { status: 500 });
  }
}
