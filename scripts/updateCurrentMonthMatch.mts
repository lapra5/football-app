// 🚀 開始ログ
console.log("🚀 updateCurrentMonthMatch 開始");

// 必要な import
import * as fs from "fs";
import * as path from "path";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { sendDiscordMessage } from "../src/utils/discordNotify.ts";
import { updateTimestamp } from "../src/utils/updateLog.ts";

// Firebase 初期化
const base64 = process.env.FIREBASE_PRIVATE_KEY_JSON_BASE64;
if (!base64) throw new Error("❌ FIREBASE_PRIVATE_KEY_JSON_BASE64 が設定されていません。");
const serviceAccount = JSON.parse(Buffer.from(base64, "base64").toString());
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// Webhook
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK_MATCHES || "";

// 対象リーグ
const LEAGUE_IDS = [
  "2001", "2002", "2003", "2013", "2014",
  "2015", "2016", "2017", "2019", "2021"
];

// ファイルパス
const teamDataPath = path.resolve("src/data/team_league_names.json");
const targetPath = path.resolve("src/data/current_month_matches_oversea.json");

// 日付範囲取得
const getTargetRange = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 30, 23, 59, 59);
  return [start.toISOString(), end.toISOString()];
};

const main = async () => {
  try {
    const [start, end] = getTargetRange();
    const now = new Date();

    // チームデータ読み込み
    const teamDataRaw = fs.readFileSync(teamDataPath, "utf-8");
    const teamData = JSON.parse(teamDataRaw);
    const teams = teamData.teams;
    const leagueMap = Object.fromEntries(
      (Array.isArray(teamData.leagues) ? teamData.leagues : []).map((l) => [l.en, l.jp])
    );

    const getTeamInfo = (teamId: string | number) => {
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

    const matches: any[] = [];

    for (const leagueId of LEAGUE_IDS) {
      const seasonRefs = await db.collection("leagues").doc(leagueId).collection("seasons").listDocuments();
      const sortedSeasons = seasonRefs
        .map(ref => ref.id)
        .filter(id => /^\d{4}-\d{4}$/.test(id))
        .sort((a, b) => {
          const aYear = new Date(a.split("-")[0]).getFullYear();
          const bYear = new Date(b.split("-")[0]).getFullYear();
          return Math.abs(now.getFullYear() - aYear) - Math.abs(now.getFullYear() - bYear);
        });

      for (const seasonId of sortedSeasons.slice(0, 1)) { // 最も近いシーズンのみ対象
        const snapshot = await db
          .collection("leagues")
          .doc(leagueId)
          .collection("seasons")
          .doc(seasonId)
          .collection("matches")
          .where("kickoffTime", ">=", start)
          .where("kickoffTime", "<=", end)
          .get();

        snapshot.docs.forEach(doc => matches.push(doc.data()));
      }
    }

    const enrichedMatches = matches.map((match) => ({
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
    updateTimestamp("updateCurrentMonthMatch");

    await sendDiscordMessage(
      `✅ 海外リーグ試合データ取得完了: ${enrichedMatches.length} 件を current_month_matches_oversea.json に保存しました`,
      DISCORD_WEBHOOK
    );
  } catch (err) {
    console.error("❌ エラー:", err);
    await sendDiscordMessage(
      `❌ エラー発生: ${err instanceof Error ? err.message : String(err)}`,
      DISCORD_WEBHOOK
    );
    process.exit(1);
  }
};

main();
