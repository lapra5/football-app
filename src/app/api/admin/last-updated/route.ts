// 例: /api/admin/last-updated/route.ts
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const logPath = path.resolve(process.cwd(), "src/data/updated_log.json");

export async function GET() {
  try {
    const data = fs.existsSync(logPath)
      ? JSON.parse(fs.readFileSync(logPath, "utf-8"))
      : {};
    return NextResponse.json(data);
  } catch (error) {
    console.error("ログ読み取りエラー:", error);
    return NextResponse.json({}, { status: 500 });
  }
}
