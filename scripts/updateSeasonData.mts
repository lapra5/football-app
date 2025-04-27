// 🚀 開始ログ
console.log("🚀 updateSeasonData 開始");

import * as path from "path";
import * as fs from "fs";
import fetch from "node-fetch";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import dotenv from "dotenv";
import { updateTimestamp } from "../src/utils/updateLog.ts";
import { sendDiscordMessage } from "../src/utils/discordNotify.ts";

dotenv.config({ path: path.resolve(".env.local") });

const base64 = process.env.FIREBASE_PRIVATE_KEY_JSON_BASE64!;
const serviceAccount = JSON.parse(Buffer.from(base64, "base64").toString());
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const API_KEY = process.env.FOOTBALL_DATA_API_KEY!;
const DISCORD_WEBHOOK_SEASON = process.env.DISCORD_WEBHOOK_SEASON!;
const publicUpdatedLogPath = path.resolve("public/updated_log.json");

const leagueIds = [
  2021, 2016, 2015, 2002, 2019,
  2014, 2003, 2017, 2013, 2001
];

const getSeasonYear = (date: Date): string => {
  const year = date.getFullYear();
  return date.getMonth() >= 6
    ? `${year}-${year + 1}`
    : `${year - 1}-${year}`;
};

const getTargetRange = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 30);
  return [start.toISOString(), end.toISOString()];
};

const main = async () => {
  try {
    const [start, end] = getTargetRange();
    const seasonLabel = getSeasonYear(new Date());

    const allMatches: any[] = [];

    for (const leagueId of leagueIds) {
      const res = await fetch(`https://api.football-data.org/v4/competitions/${leagueId}/matches`, {
        headers: { "X-Auth-Token": API_KEY }
      });
      const json = await res.json();

      const matches = (json.matches || []).filter((m: any) =>
        m.utcDate >= start && m.utcDate <= end
      );

      matches.forEach((match: any) => {
        const matchId = match.id.toString();
        allMatches.push({
          matchId,
          ...match
        });
      });

      const ref = db
        .collection("leagues")
        .doc(leagueId.toString())
        .collection("seasons")
        .doc(seasonLabel)
        .collection("matches");

      const batch = db.batch();
      for (const match of matches) {
        const matchId = match.id.toString();
        batch.set(ref.doc(matchId), match, { merge: true });
      }
      await batch.commit();
    }

    console.log(`✅ ${allMatches.length} 件のマッチデータを保存しました`);

    // 🔥 updated_log.json 更新＋publicにもコピー
    updateTimestamp("updateSeason");
    const updatedLogData = fs.readFileSync("src/data/updated_log.json", "utf-8");
    fs.writeFileSync(publicUpdatedLogPath, updatedLogData, "utf-8");

    await sendDiscordMessage(
      `✅ updateSeasonData 完了: ${allMatches.length} 件保存しました`,
      DISCORD_WEBHOOK_SEASON
    );
  } catch (err) {
    console.error("❌ エラー:", err);
    await sendDiscordMessage(
      `❌ updateSeasonData エラー: ${(err as Error).message}`,
      DISCORD_WEBHOOK_SEASON
    );
    process.exit(1);
  }
};

main();
