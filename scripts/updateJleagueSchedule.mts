// scripts/updateJleagueSchedule.mts
import axios from "axios";
import * as cheerio from "cheerio";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import dotenv from "dotenv";
import { sendDiscordMessage } from "../src/utils/discordNotify.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const serviceAccount = JSON.parse(
  Buffer.from(process.env.FIREBASE_PRIVATE_KEY_JSON_BASE64!, "base64").toString()
);
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const J_URLS = [
  {
    url: "https://data.j-league.or.jp/SFMS01/search?competition_years=2025&competition_frame_ids=1&competition_ids=651",
    league: "J1",
    docId: "j1",
  },
  {
    url: "https://data.j-league.or.jp/SFMS01/search?competition_years=2025&competition_frame_ids=2",
    league: "J2",
    docId: "j2",
  },
  {
    url: "https://data.j-league.or.jp/SFMS01/search?competition_years=2025&competition_frame_ids=3",
    league: "J3",
    docId: "j3",
  },
  {
    url: "https://data.j-league.or.jp/SFMS01/search?competition_years=2025&competition_frame_ids=11",
    league: "Jリーグカップ",
    docId: "jcup",
  },
];

const webhookUrl = process.env.DISCORD_WEBHOOK_JLEAGUE;

const main = async () => {
  try {
    console.log("🚀 Jリーグ日程取得開始");

    let totalCount = 0;
    const leagueCountMap: Record<string, number> = {};

    for (const { url, league, docId } of J_URLS) {
      const res = await axios.get(url);
      const $ = cheerio.load(res.data);
      const matches: any[] = [];

      $(".data_table tr").each((_, el) => {
        const cols = $(el).find("td");
        if (cols.length < 8) return;

        const dateStr = $(cols[3]).text().trim(); // ex: "02/25(土)"
        const timeStr = $(cols[4]).text().trim(); // ex: "14:00"
        const homeTeam = $(cols[5]).text().trim();
        const awayTeam = $(cols[7]).text().trim();

        // 日時未定の試合はスキップ
        if (!dateStr || !timeStr || !homeTeam || !awayTeam) return;
        if (timeStr === "未定") return;

        const fullDateTimeStr = `2025/${dateStr} ${timeStr}`;
        const kickoff = new Date(`${fullDateTimeStr}:00 GMT+0900`);
        if (isNaN(kickoff.getTime())) return;

        matches.push({
          matchId: `${league}_${kickoff.toISOString()}_${homeTeam}_vs_${awayTeam}`,
          kickoffTime: kickoff.toISOString(),
          homeTeam: { name: homeTeam, id: null, players: [] },
          awayTeam: { name: awayTeam, id: null, players: [] },
          league,
          matchday: 0,
          status: "SCHEDULED",
          lineupStatus: "未発表",
        });
      });

      const ref = db.collection("leagues").doc(docId).collection("matches");
      const batch = db.batch();
      matches.forEach((match) => {
        batch.set(ref.doc(match.matchId), match, { merge: true });
      });
      await batch.commit();

      totalCount += matches.length;
      leagueCountMap[league] = matches.length;
      console.log(`📥 ${league}: ${matches.length}件`);
    }

    const summary = Object.entries(leagueCountMap)
      .map(([lg, cnt]) => `• ${lg}: ${cnt}件`)
      .join("\n");

    const message = `✅ Jリーグ試合取得完了\n合計: ${totalCount}件\n${summary}`;
    console.log(message);
    await sendDiscordMessage(message, webhookUrl!);
  } catch (err) {
    console.error("❌ エラー:", err);
    await sendDiscordMessage(`❌ Jリーグ日程取得エラー: ${(err as Error).message}`, webhookUrl!);
    process.exit(1);
  }
};

main();
