import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { sendDiscordMessage } from "../src/utils/discordNotify.ts";
import { updateTimestamp } from "../src/utils/updateLog.ts";
import fetch from "node-fetch";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const FIREBASE_KEY = process.env.FIREBASE_PRIVATE_KEY_JSON_BASE64;
if (!FIREBASE_KEY) throw new Error("❌ Firebase秘密鍵が設定されていません");

const serviceAccount = JSON.parse(Buffer.from(FIREBASE_KEY, "base64").toString());
initializeApp({ credential: cert(serviceAccount) });

const db = getFirestore();
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK_SEASON || "";
const API_KEY = process.env.FOOTBALL_DATA_API_KEY;

if (!API_KEY) throw new Error("❌ FOOTBALL_DATA_API_KEY が設定されていません");

const API_BASE_URL = "https://api.football-data.org/v4/competitions";

const LEAGUE_IDS = [
  "2001", "2002", "2003", "2013", "2014",
  "2015", "2016", "2017", "2019", "2021"
];

function getSeasonLabel(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const start = month >= 7 ? year : year - 1;
  return `${start}-${start + 1}`;
}

const fetchMatchesForLeague = async (leagueId: string): Promise<any[]> => {
  const url = `${API_BASE_URL}/${leagueId}/matches`;
  const res = await fetch(url, {
    headers: { "X-Auth-Token": API_KEY },
  });
  if (!res.ok) throw new Error(`❌ ${leagueId} の試合取得に失敗 (${res.status})`);
  const data = await res.json();
  return data.matches || [];
};

const saveMatchesToFirestore = async (leagueId: string, seasonLabel: string, matches: any[]) => {
  const batch = db.batch();
  const collectionRef = db.collection("leagues").doc(leagueId).collection("seasons").doc(seasonLabel).collection("matches");

  matches.forEach((match) => {
    const docId = match.id?.toString();
    if (!docId) return;
    batch.set(collectionRef.doc(docId), match, { merge: true });
  });

  await batch.commit();
};

const main = async () => {
  console.log("🚀 updateSeasonData 開始");
  try {
    const seasonLabel = getSeasonLabel();
    let total = 0;

    for (const leagueId of LEAGUE_IDS) {
      const matches = await fetchMatchesForLeague(leagueId);
      console.log(`📥 ${leagueId}: ${matches.length} 試合取得`);
      await saveMatchesToFirestore(leagueId, seasonLabel, matches);
      total += matches.length;
    }

    updateTimestamp("updateSeason");
    console.log(`✅ 合計 ${total} 件の試合データを Firestore に保存`);
    await sendDiscordMessage(`✅ シーズンデータ更新完了（合計 ${total} 件）`, DISCORD_WEBHOOK);
  } catch (err) {
    console.error("❌ エラー:", err);
    await sendDiscordMessage(
      `❌ updateSeasonData エラー: ${err instanceof Error ? err.message : String(err)}`,
      DISCORD_WEBHOOK
    );
    process.exit(1);
  }
};

main();
