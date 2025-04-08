import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    // 最新版: 読み込みパスを統一し、Turbopack のキャッシュエラー回避のため拡張子明示
    const filePath = path.resolve(process.cwd(), "src/data/team_league_names.json");

    if (!fs.existsSync(filePath)) {
      console.error("🔥 team_league_names.json が存在しません");
      return NextResponse.json({ teams: [], leagues: {}, error: "File not found" }, { status: 500 });
    }

    // 拡張子指定で import する代わりにファイル読み込みで常に取得する
    const fileData = fs.readFileSync(filePath, "utf-8");
    const jsonData = JSON.parse(fileData);

    if (!jsonData.teams || !jsonData.leagues) {
      console.error("🔥 JSON 構造エラーまたは空データ");
      return NextResponse.json({ teams: [], leagues: {}, error: "Invalid JSON structure" }, { status: 500 });
    }

    return NextResponse.json(jsonData);
  } catch (err) {
    console.error("🔥 team-league-names API 実行エラー:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
