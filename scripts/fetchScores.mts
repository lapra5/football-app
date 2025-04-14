import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { sendDiscordMessage } from "../src/utils/discordNotify.ts";
import { updateTimestamp } from "../src/utils/updateLog";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const API_BASE_URL = "https://api.football-data.org/v4/matches";
const API_KEY = process.env.FOOTBALL_DATA_API_KEY;
const webhookUrl = process.env.DISCORD_WEBHOOK_SCORES;

if (!API_KEY) throw new Error("❌ FOOTBALL_DATA_API_KEY が設定されていません");
if (!webhookUrl) throw new Error("❌ DISCORD_WEBHOOK_SCORES が設定されていません");

const targetPath = path.resolve(__dirname, "../src/data/current_month_matches.json");

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

const fetchScore = async (matchId: string) => {
  const url = `${API_BASE_URL}/${matchId}`;
  const res = await fetch(url, { headers: { "X-Auth-Token": API_KEY } });
  if (!res.ok) throw new Error(`❌ ${matchId} のスコア取得失敗: ${res.status}`);
  const data = await res.json();
  return data;
};

const main = async () => {
  try {
    const json = fs.readFileSync(targetPath, "utf-8");
    const matches = JSON.parse(json);

    const now = new Date();
    const targets = matches.filter((match: any) => {
      const kickoff = new Date(match.kickoffTime);
      const diff = now.getTime() - kickoff.getTime();
      return diff > 2 * 60 * 60 * 1000 && !match.score?.fullTime?.home;
    });

    console.log(`🎯 スコア取得対象: ${targets.length}件`);

    let updatedCount = 0;

    for (let i = 0; i < targets.length; i += 10) {
      const group = targets.slice(i, i + 10);

      const results = await Promise.allSettled(
        group.map(async (match) => {
          const detail = await fetchScore(match.matchId);
          const score = detail.score;
          if (!score || !score.fullTime) throw new Error(`score 情報が不正`);

          match.score = score;
          updatedCount++;
          return match;
        })
      );

      if (i + 10 < targets.length) await delay(2000);
    }

    fs.writeFileSync(targetPath, JSON.stringify(matches, null, 2), "utf-8");
    console.log(`📝 スコア更新件数: ${updatedCount}`);
    updateTimestamp("updateCurrentMonthMatch"); // ← 追加！

    await sendDiscordMessage(`✅ スコア情報を ${updatedCount} 件更新しました`, webhookUrl);
  } catch (err) {
    console.error("❌ エラー:", err);
    await sendDiscordMessage(
      `❌ スコア取得エラー: ${err instanceof Error ? err.message : String(err)}`,
      webhookUrl
    );
    process.exit(1);
  }
};

main();
