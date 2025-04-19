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
import { updateTimestamp } from "../src/utils/updateLog.ts";

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
  },
  {
    url: "https://data.j-league.or.jp/SFMS01/search?competition_years=2025&competition_frame_ids=2",
    league: "J2",
  },
  {
    url: "https://data.j-league.or.jp/SFMS01/search?competition_years=2025&competition_frame_ids=3",
    league: "J3",
  },
  {
    url: "https://data.j-league.or.jp/SFMS01/search?competition_years=2025&competition_frame_ids=11",
    league: "Jリーグカップ",
  },
];

const webhookUrl = process.env.DISCORD_WEBHOOK_JLEAGUE;

const main = async () => {
  try {
    console.log("🚀 Jリーグ日程取得開始");
    const allMatches: any[] = [];

    for (const { url, league } of J_URLS) {
      const res = await axios.get(url);
      const $ = cheerio.load(res.data);

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
        const awayTeam = $(cols[7]).text().trim();
        const scoreStr = $(cols[6]).text().trim();

        if (!dateStr || !timeStr || !homeTeam || !awayTeam) return;

        const fullDateTimeStr = `2025/${dateStr} ${timeStr}`;
        const kickoff = new Date(`${fullDateTimeStr}:00 GMT+0900`);
        if (isNaN(kickoff.getTime())) return;

        // スコアの判定処理
        const scoreMatch = scoreStr.match(/^(\d+)[-ー](\d+)(?:\s*\(PK\d+[-ー](\d+)\))?/);
        const fullTime =
          scoreMatch && scoreMatch[1] && scoreMatch[2]
            ? {
                home: parseInt(scoreMatch[1], 10),
                away: parseInt(scoreMatch[2], 10),
              }
            : { home: null, away: null };

        const winner =
          fullTime.home != null && fullTime.away != null
            ? fullTime.home > fullTime.away
              ? "HOME_TEAM"
              : fullTime.home < fullTime.away
              ? "AWAY_TEAM"
              : league === "Jリーグカップ"
              ? scoreStr.includes("PK")
                ? scoreStr.includes("PK2-4") || scoreStr.includes("PK3-5") // ←ここは適宜修正
                  ? "AWAY_TEAM"
                  : "HOME_TEAM"
                : null
              : "DRAW"
            : null;

        allMatches.push({
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
            fullTime,
            halfTime: { home: null, away: null },
            winner,
          },
          startingMembers: [],
          substitutes: [],
          outOfSquad: [],
        });
      });
    }

    // Firestore 書き込み
    const year = "2025";
    const season = `${parseInt(year)}-${parseInt(year) + 1}`;
    const batch = db.batch();
    for (const match of allMatches) {
      const ref = db
        .collection("leagues")
        .doc("jleague")
        .collection("seasons")
        .doc(season)
        .collection("matches")
        .doc(match.matchId);
      batch.set(ref, match, { merge: true });
    }
    await batch.commit();

    // JSON出力
    const outputPath = path.resolve(__dirname, "../src/data/current_month_matches_jleague.json");
    fs.writeFileSync(outputPath, JSON.stringify(allMatches, null, 2), "utf-8");

    console.log(`✅ Jリーグ試合 ${allMatches.length} 件を保存`);
    await sendDiscordMessage(`✅ Jリーグ試合 ${allMatches.length} 件を更新しました`, webhookUrl!);
    updateTimestamp("updateJleagueSchedule");
  } catch (err) {
    console.error("❌ エラー:", err);
    await sendDiscordMessage(`❌ Jリーグ日程取得エラー: ${(err as Error).message}`, webhookUrl!);
    process.exit(1);
  }
};

main();
