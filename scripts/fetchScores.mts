import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import fetch from "node-fetch";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const targetPath = path.resolve(__dirname, "../src/data/current_month_matches.json");
const API_BASE = "https://api.football-data.org/v4";
const API_KEY = process.env.FOOTBALL_DATA_API_KEY;

if (!API_KEY) throw new Error("❌ FOOTBALL_DATA_API_KEY が設定されていません");

const readMatches = () => {
  const raw = fs.readFileSync(targetPath, "utf-8");
  return JSON.parse(raw);
};

const writeMatches = (matches) => {
  fs.writeFileSync(targetPath, JSON.stringify(matches, null, 2), "utf-8");
};

const getScore = async (matchId) => {
  const res = await fetch(`${API_BASE}/matches/${matchId}`, {
    headers: { "X-Auth-Token": API_KEY },
  });
  if (!res.ok) throw new Error(`❌ API error: ${res.status}`);
  return res.json();
};

const main = async () => {
  try {
    const now = new Date();
    const matches = readMatches();
    let updatedCount = 0;

    for (const match of matches) {
      const kickoff = new Date(match.kickoffTime);
      const twoHoursLater = new Date(kickoff.getTime() + 2 * 60 * 60 * 1000);
      const needsUpdate = now >= twoHoursLater && match.score?.fullTime?.home === null;

      if (!needsUpdate) continue;

      try {
        const result = await getScore(match.matchId);
        match.score = result.match.score;
        updatedCount++;
        console.log(`✅ スコア更新: ${match.matchId}`);
      } catch (err) {
        console.warn(`⚠️ スコア取得失敗: ${match.matchId}`, err.message);
      }
    }

    writeMatches(matches);
    console.log(`📝 ${updatedCount}件のスコアを更新しました`);
  } catch (err) {
    console.error("❌ エラー:", err);
  }
};

main();
