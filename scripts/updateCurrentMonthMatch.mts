// scripts/updateCurrentMonthMatch.mjs
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { sendDiscordMessage } from "../src/utils/discordNotify.mts";
import util from "util"; // ← 上の方に追加

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const getFirestoreInstance = () => {
  const base64 = process.env.FIREBASE_PRIVATE_KEY_JSON_BASE64;
  if (!base64) throw new Error("❌ FIREBASE_PRIVATE_KEY_JSON_BASE64 が設定されていません。");
  const serviceAccount = JSON.parse(Buffer.from(base64, "base64").toString());
  initializeApp({ credential: cert(serviceAccount) });
  return getFirestore();
};

const db = getFirestoreInstance();

const LEAGUE_IDS = [
  "2001", "2002", "2003", "2013", "2014",
  "2015", "2016", "2017", "2019", "2021"
];

const teamDataPath = path.resolve(__dirname, "../src/data/team_league_names.json");
const targetPath = path.resolve(__dirname, "../src/data/current_month_matches.json");

const getTargetRange = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 30, 23, 59, 59);
  return [start.toISOString(), end.toISOString()];
};

const main = async () => {
  try {
    // ✅ テスト通知（最初に送信）
    await sendDiscordMessage("📢 テスト通知：GitHub Actions 経由で送信できています！");

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
      .flatMap((r) => r.value.matches);

    const failed = results
      .filter((r) => r.status === "rejected")
      .map((r, i) => ({ leagueId: LEAGUE_IDS[i], error: r.reason }));

    if (failed.length > 0) {
      const msg = `⚠️ 一部のリーグで取得失敗: ${failed.map(f => f.leagueId).join(', ')}`;
      console.warn(msg);
      await sendDiscordMessage(msg);
    }

    const teamDataRaw = fs.readFileSync(teamDataPath, "utf-8");
    const teamData = JSON.parse(teamDataRaw);
    const teams = teamData.teams;
    const leagueMap = Object.fromEntries(
      (Array.isArray(teamData.leagues) ? teamData.leagues : []).map((l) => [l.en, l.jp])
    );

    const getTeamInfo = (teamId) => {
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

    const successMsg = `✅ updateCurrentMonthMatch 成功: ${enrichedMatches.length} 試合更新`;
    console.log(successMsg);
    await sendDiscordMessage(successMsg);
  } catch (err) {
    console.error("❌ エラー:", err);
    await sendDiscordMessage(`❌ updateCurrentMonthMatch でエラー発生: ${err.stack || err.message}`);
  }
};

main().catch(async (err) => {
  console.error("❌ スクリプト実行中にエラーが発生しました:");

  let message: string;

  if (err instanceof Error) {
    message = `❌ updateCurrentMonthMatch エラー:\n${err.message}\n${err.stack}`;
    console.error(err.stack);
  } else {
    try {
      message = `❌ updateCurrentMonthMatch 不明なエラー:\n${JSON.stringify(err)}`;
    } catch (e) {
      message = "❌ updateCurrentMonthMatch でエラー発生（内容不明）";
    }
    console.error(err);
  }

  await sendDiscordMessage(message);
  process.exit(1);
});
