// 🚀 開始ログ
console.log("🚀 updateJleagueSchedule 開始");

import axios from "axios";
import * as cheerio from "cheerio";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import dotenv from "dotenv";
import { sendDiscordMessage } from "../src/utils/discordNotify.ts";
import { updateTimestamp } from "../src/utils/updateLog.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const serviceAccount = JSON.parse(
  Buffer.from(process.env.FIREBASE_PRIVATE_KEY_JSON_BASE64!, "base64").toString()
);
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const currentYear = new Date().getFullYear();
const webhookUrl = process.env.DISCORD_WEBHOOK_JLEAGUE;

const publicUpdatedLogPath = path.resolve("public/updated_log.json");

const J_URLS = [
  {
    url: `https://data.j-league.or.jp/SFMS01/search?competition_years=${currentYear}&competition_frame_ids=1&competition_ids=651`,
    league: "J1",
  },
  {
    url: `https://data.j-league.or.jp/SFMS01/search?competition_years=${currentYear}&competition_frame_ids=2`,
    league: "J2",
  },
  {
    url: `https://data.j-league.or.jp/SFMS01/search?competition_years=${currentYear}&competition_frame_ids=3`,
    league: "J3",
  },
  {
    url: `https://data.j-league.or.jp/SFMS01/search?competition_years=${currentYear}&competition_frame_ids=11`,
    league: "Jリーグカップ",
  },
];

function extractSeasonYear(url: string): string {
  const match = url.match(/competition_years=(\d{4})/);
  return match ? match[1] : new Date().getFullYear().toString();
}

const main = async () => {
  try {
    console.log("🚀 Jリーグ日程取得開始");
    const allMatches: any[] = [];

    for (const { url, league } of J_URLS) {
      const res = await axios.get(url);
      const $ = cheerio.load(res.data);
      const seasonYear = extractSeasonYear(url);

      $("tbody > tr").each((_, el) => {
        const cols = $(el).find("td");
        if (cols.length < 8) return;

        const matchdayText = $(cols[2]).text().trim();
        const normalized = matchdayText.replace(/[０-９]/g, (s) =>
          String.fromCharCode(s.charCodeAt(0) - 0xfee0)
        );
        const matchdayMatch = normalized.match(/第(\d+)節/);
        const matchday = matchdayMatch ? parseInt(matchdayMatch[1], 10) : 0;

        const dateStr = $(cols[3]).text().trim();
        const timeStr = $(cols[4]).text().trim();
        const homeTeam = $(cols[5]).text().trim();
        const scoreRaw = $(cols[6]).text().trim();
        const awayTeam = $(cols[7]).text().trim();

        if (!dateStr || !timeStr || !homeTeam || !awayTeam) return;

        const fullDateTimeStr = `${seasonYear}/${dateStr} ${timeStr}`;
        const kickoff = new Date(`${fullDateTimeStr}:00 GMT+0900`);
        if (isNaN(kickoff.getTime())) return;

        let fullTimeHome: number | null = null;
        let fullTimeAway: number | null = null;
        let pkHome: number | null = null;
        let pkAway: number | null = null;
        let winner: "HOME_TEAM" | "AWAY_TEAM" | null = null;

        const scoreMatch = scoreRaw.match(/(\d+)-(\d+)(?:\s*\(PK(\d+)-(\d+)\))?/);
        if (scoreMatch) {
          fullTimeHome = parseInt(scoreMatch[1]);
          fullTimeAway = parseInt(scoreMatch[2]);
          if (scoreMatch[3] && scoreMatch[4]) {
            pkHome = parseInt(scoreMatch[3]);
            pkAway = parseInt(scoreMatch[4]);
          }

          if (pkHome !== null && pkAway !== null) {
            winner = pkHome > pkAway ? "HOME_TEAM" : "AWAY_TEAM";
          } else if (fullTimeHome !== null && fullTimeAway !== null) {
            winner = fullTimeHome > fullTimeAway ? "HOME_TEAM" : fullTimeAway > fullTimeHome ? "AWAY_TEAM" : null;
          }
        }

        const match = {
          matchId: `${league}_${kickoff.toISOString()}_${homeTeam}_vs_${awayTeam}`,
          kickoffTime: kickoff.toISOString(),
          homeTeam: { name: homeTeam, id: null, players: [] },
          awayTeam: { name: awayTeam, id: null, players: [] },
          league,
          matchday,
          status: "SCHEDULED",
          lineupStatus: "未発表",
          score: {
            duration: "REGULAR",
            fullTime: { home: fullTimeHome, away: fullTimeAway },
            halfTime: league === "Jリーグカップ" && pkHome !== null && pkAway !== null
              ? { home: pkHome, away: pkAway }
              : { home: null, away: null },
            winner,
          },
          startingMembers: [],
          substitutes: [],
          outOfSquad: [],
        };

        const ref = db
          .collection("leagues")
          .doc("jleague")
          .collection("seasons")
          .doc(seasonYear)
          .collection("matches")
          .doc(match.matchId);

        allMatches.push({ ref, match });
      });
    }

    const batch = db.batch();
    allMatches.forEach(({ ref, match }) => batch.set(ref, match, { merge: true }));
    await batch.commit();

    console.log(`✅ Jリーグ試合 ${allMatches.length} 件を保存`);
    await sendDiscordMessage(`✅ Jリーグ試合 ${allMatches.length} 件を更新しました`, webhookUrl!);

    const outputPath = path.resolve(__dirname, "../src/data/current_month_matches_jleague.json");
    fs.writeFileSync(outputPath, JSON.stringify(allMatches.map(m => m.match), null, 2), "utf-8");
    console.log(`📝 ${outputPath} に ${allMatches.length} 件の試合を保存しました`);

    // 🔥 updated_log.json を更新＋publicにコピー
    updateTimestamp("updateJleagueSchedule");
    const updatedLogData = fs.readFileSync("src/data/updated_log.json", "utf-8");
    fs.writeFileSync(publicUpdatedLogPath, updatedLogData, "utf-8");

  } catch (err) {
    console.error("❌ エラー:", err);
    await sendDiscordMessage(`❌ Jリーグ日程取得エラー: ${(err as Error).message}`, webhookUrl!);
    process.exit(1);
  }
};

main();
