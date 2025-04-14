// 🚀 マージ処理開始ログ
console.log("🚀 mergeMatches 開始");

import * as fs from "fs";
import * as path from "path";
import { sendDiscordMessage } from "../src/utils/discordNotify.ts";
import { updateTimestamp } from "../src/utils/updateLog.ts";

// Webhook（方法2: 環境変数から直接取得）
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK_MATCHES || "";

// データファイルのパス
const basePath = path.resolve("src/data");
const inputFiles = [
  "current_month_matches_oversea.json",
  "current_month_matches_jleague.json",
  "current_month_matches_celtic.json",
];
const outputPath = path.resolve(basePath, "current_month_matches.json");

const main = async () => {
  try {
    const allMatches: any[] = [];

    for (const file of inputFiles) {
      const fullPath = path.resolve(basePath, file);
      if (!fs.existsSync(fullPath)) {
        console.warn(`⚠️ ${file} が見つかりません。スキップします`);
        continue;
      }

      const raw = fs.readFileSync(fullPath, "utf-8");
      const data = JSON.parse(raw);
      if (!Array.isArray(data)) {
        console.warn(`⚠️ ${file} の形式が不正です。スキップします`);
        continue;
      }

      console.log(`📦 ${file}: ${data.length} 件`);
      allMatches.push(...data);
    }

    fs.writeFileSync(outputPath, JSON.stringify(allMatches, null, 2), "utf-8");
    console.log(`✅ ${allMatches.length} 件の試合を ${outputPath} に保存しました`);

    updateTimestamp("mergeMatches");

    // mergeMatches.mts のDiscord通知
    await sendDiscordMessage(
        `✅ 月間試合データ統合完了: 海外＋Jリーグ＋セルティックで合計 ${allMatches.length} 件を current_month_matches.json に保存しました`,
        DISCORD_WEBHOOK
    );
  } catch (err) {
    console.error("❌ エラー:", err);
    await sendDiscordMessage(
      `❌ mergeMatches エラー: ${err instanceof Error ? err.message : String(err)}`,
      DISCORD_WEBHOOK
    );
    process.exit(1);
  }
};

main();
