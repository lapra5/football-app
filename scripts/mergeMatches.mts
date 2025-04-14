import fs from "fs";
import path from "path";
import { sendDiscordMessage } from "../src/utils/discordNotify.ts";
import { updateTimestamp } from "../src/utils/updateLog.ts";

// 出力先
const outputPath = path.resolve("src/data/current_month_matches.json");
const webhookUrl = process.env.DISCORD_WEBHOOK_MATCHES || "";

// 各JSONファイルのパス
const sourceFiles = [
  "current_month_matches_oversea.json",
  "current_month_matches_jleague.json",
  "current_month_matches_celtic.json",
].map((file) => path.resolve("src/data", file));

const main = async () => {
  try {
    console.log("🚀 mergeMatches 開始");

    const allMatches: any[] = [];

    for (const filePath of sourceFiles) {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, "utf-8");
        const parsed = JSON.parse(raw);
        allMatches.push(...parsed);
        console.log(`📄 ${path.basename(filePath)}: ${parsed.length} 件`);
      } else {
        console.warn(`⚠️ ファイルが存在しません: ${filePath}`);
      }
    }

    fs.writeFileSync(outputPath, JSON.stringify(allMatches, null, 2), "utf-8");
    console.log(`✅ 統合完了: ${allMatches.length} 件 → ${outputPath}`);

    updateTimestamp("mergeMatches");

    await sendDiscordMessage(
      `📦 試合データ統合完了: ${allMatches.length} 件を current_month_matches.json に保存しました`,
      webhookUrl
    );
  } catch (err) {
    console.error("❌ エラー:", err);
    await sendDiscordMessage(
      `❌ mergeMatches エラー: ${(err as Error).message}`,
      webhookUrl
    );
    process.exit(1);
  }
};

main();
