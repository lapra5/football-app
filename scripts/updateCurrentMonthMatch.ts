// 🚀 開始ログ
console.log("🚀 updateCurrentMonthMatch 開始");

// ✅ Firestore 書き込みやファイル保存処理のための各種 import
import * as fs from "fs";
import * as path from "path";
import { sendDiscordMessage } from "@/utils/discordNotify.ts";

type Match = {
  id: number;
  home: string;
  away: string;
  date: string;
};

const fetchMatchData = async (): Promise<Match[]> => {
  console.log("📡 データ取得開始...");
  return [
    { id: 1, home: "Team A", away: "Team B", date: "2025-04-12" },
    { id: 2, home: "Team C", away: "Team D", date: "2025-04-13" },
  ];
};

const saveMatches = async (matches: Match[]) => {
  const outputPath = path.resolve("src/data/current_month_matches.json");
  fs.writeFileSync(outputPath, JSON.stringify(matches, null, 2));
  console.log(`✅ ${matches.length}件の試合情報を ${outputPath} に保存しました`);
  return matches.length;
};

const main = async () => {
  const matches = await fetchMatchData();
  const count = await saveMatches(matches);

  await sendDiscordMessage(`✅ 試合データ ${count} 件を更新しました`);
};

main().catch(async (err) => {
  console.error("❌ スクリプト実行中にエラーが発生しました:");
  console.error(err);
  await sendDiscordMessage(`❌ エラー発生: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
