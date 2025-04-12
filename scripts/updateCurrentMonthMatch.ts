// 🚀 開始ログ
<<<<<<< HEAD
console.log("🚀 updateCurrentMonthMatch 開始");

// 必要な import
import * as fs from "fs";
import * as path from "path";
=======
console.log("🚀 updateMatchdayStatus 開始");

// ✅ Firestore 書き込みやファイル保存処理のための各種 import
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
>>>>>>> c3f0d5c (🔔 feat: 分離されたWebhookで試合データ通知を送信)
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { sendDiscordMessage } from "../src/utils/discordNotify.ts";

// Firebase 初期化
const base64 = process.env.FIREBASE_PRIVATE_KEY_JSON_BASE64;
if (!base64) throw new Error("❌ FIREBASE_PRIVATE_KEY_JSON_BASE64 が設定されていません。");
const serviceAccount = JSON.parse(Buffer.from(base64, "base64").toString());
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const LEAGUE_IDS = [
  "2001", "2002", "2003", "2013", "2014",
  "2015", "2016", "2017", "2019", "2021"
];

const teamDataPath = path.resolve("src/data/team_league_names.json");
const targetPath = path.resolve("src/data/current_month_matches.json");

const getTargetRange = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 30, 23, 59, 59);
  return [start.toISOString(), end.toISOString()];
};

const main = async () => {
  try {
<<<<<<< HEAD
    const [start, end] = getTargetRange();

    const results = await Promise.allSettled(
      LEAGUE_IDS.map((leagueId) =>
        db
          .collection("leagues")
          .doc(leagueId)
          .collection("matches")
          .where("kickoffTime", ">=", start)
          .where("kickoffTime", "<=", end)
          .get()
          .then((snapshot) => ({
            leagueId,
            matches: snapshot.docs.map((doc) => doc.data()),
          }))
      )
    );

    const successful = results
      .filter((r) => r.status === "fulfilled")
      .flatMap((r) => r.status === "fulfilled" ? r.value.matches : []);
=======
    const now = new Date();
    const leagueStatusMap: Record<string, { previous: number; current: number; next: number }> = {};
>>>>>>> c3f0d5c (🔔 feat: 分離されたWebhookで試合データ通知を送信)

    const teamDataRaw = fs.readFileSync(teamDataPath, "utf-8");
    const teamData = JSON.parse(teamDataRaw);
    const teams = teamData.teams;
    const leagueMap = Object.fromEntries(
      (Array.isArray(teamData.leagues) ? teamData.leagues : []).map((l) => [l.en, l.jp])
    );

    const getTeamInfo = (teamId: string) => {
      const team = teams.find((t) => t.teamId === teamId);
      return team
        ? {
            id: teamId,
            name: { jp: team.team, en: team.englishName },
            players: team.players || [],
            englishplayers: team.englishplayers || [],
            logo: team.logo || "",
          }
        : {
            id: teamId,
            name: { jp: "", en: "" },
            players: [],
            englishplayers: [],
            logo: "",
          };
    };

    const enrichedMatches = successful.map((match) => ({
      matchId: match.matchId?.toString() || match.id?.toString(),
      kickoffTime: match.kickoffTime || match.utcDate,
      matchday: match.matchday,
      league: {
        en: match.league || match.competition?.name || "",
        jp: leagueMap[match.league || match.competition?.name] || match.league || "",
      },
      homeTeam: getTeamInfo(match.homeTeam?.id),
      awayTeam: getTeamInfo(match.awayTeam?.id),
      lineupStatus: match.lineupStatus || "未発表",
      score: match.score || {
        winner: null,
        duration: "REGULAR",
        fullTime: { home: null, away: null },
        halfTime: { home: null, away: null },
      },
      startingMembers: match.startingMembers || [],
      substitutes: match.substitutes || [],
      outOfSquad: match.outOfSquad || [],
    }));

    fs.writeFileSync(targetPath, JSON.stringify(enrichedMatches, null, 2), "utf-8");
    console.log(`✅ ${enrichedMatches.length}件の試合情報を ${targetPath} に保存しました`);

    await sendDiscordMessage(
      `✅ 試合データ ${enrichedMatches.length} 件を更新しました`,
      "DISCORD_WEBHOOK_URL_CURRENT_MONTH_MATCH"
    );
  } catch (err) {
    console.error("❌ エラー:", err);
    await sendDiscordMessage(
      `❌ エラー発生: ${err instanceof Error ? err.message : String(err)}`,
      "DISCORD_WEBHOOK_URL_CURRENT_MONTH_MATCH"
    );
    process.exit(1);
  }
};

main();
