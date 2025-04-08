import { NextResponse } from "next/server";
import { exec } from "child_process";
import path from "path";
import { updateTimestamp } from "@/utils/updateLog";

export async function POST() {
  // Windows環境での絶対パス指定
  const scriptPath = "F:/Python/practice/web_sample/my-app/src/data/updatePlayers.mjs";

  return new Promise((resolve) => {
    exec(`node "${scriptPath}"`, (error, stdout, stderr) => {
      if (error) {
        console.error("❌ スクリプト実行エラー:", error);
        return resolve(
          NextResponse.json({ success: false, error: stderr || error.message }, { status: 500 })
        );
      }

      console.log("✅ スクリプト出力:", stdout);

      try {
        updateTimestamp("updatePlayers");
      } catch (logErr) {
        console.error("❌ ログ更新エラー:", logErr);
      }

      resolve(
        NextResponse.json({ success: true, message: "移籍情報の更新が完了しました。" })
      );
    });
  });
}
