import { promises as fs } from "fs";
import { NextResponse } from "next/server";
import {
  resolveContentTypeByPath,
  resolveStorageFilePath,
} from "~/server/file-storage";

export const runtime = "nodejs";

/**
 * 读取本地附件并通过 URL 返回文件内容。
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  try {
    const { path: pathSegments } = await context.params;
    const filePath = resolveStorageFilePath(pathSegments);
    const content = await fs.readFile(filePath);

    return new NextResponse(content, {
      headers: {
        "Content-Type": resolveContentTypeByPath(filePath),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ message: "文件不存在" }, { status: 404 });
  }
}
