import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { sendDiscordMessage } from "../src/utils/discordNotify";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

const teamDataPath = path.resolve(__dirname, "../src/data/team_league_names.json");
const targetPath = path.resolve(__dirname, "../src/data/matchday_status.json");

const main = async () => {
  try {
    console.log("🚀 updateMatchdayStatus 開始");

    const now = new Date();
    const leagueStatusMap: Record<string, { previous: number; current: number; next: number }> = {};

    const teamDataRaw = fs.readFileSync(teamDataPath, "utf-8");
    const teamData = JSON.parse(teamDataRaw);
    const leagueMap = Object.fromEntries(
      (Array.isArray(teamData.leagues) ? teamData.leagues : []).map((l) => [l.en, l.jp])
    );

    for (const leagueId of LEAGUE_IDS) {
      const snapshot = await db.collection("leagues").doc(leagueId).collection("matches").get();
      const matches = snapshot.docs.map((doc) => doc.data());

      const sortedMatches = matches
        .filter((m) => m.kickoffTime)
        .sort((a, b) => new Date(a.kickoffTime).getTime() - new Date(b.kickoffTime).getTime());

      const grouped = new Map<number, any[]>();
      sortedMatches.forEach((m) => {
        if (!grouped.has(m.matchday)) grouped.set(m.matchday, []);
        grouped.get(m.matchday)!.push(m);
      });

      let currentMatchday: number | undefined;
      for (const [matchday, matchesOfDay] of grouped) {
        if (matchesOfDay.some((m) => new Date(m.kickoffTime).getTime() > now.getTime())) {
          currentMatchday = matchday;
          break;
        }
      }
      if (!currentMatchday) {
        const all = [...grouped.keys()].sort((a, b) => b - a);
        currentMatchday = all[0];
      }

      const leagueName = sortedMatches[0]?.league || sortedMatches[0]?.competition?.name || "";
      const jpName = leagueMap[leagueName] || leagueName;

      leagueStatusMap[jpName] = {
        previous: currentMatchday - 1,
        current: currentMatchday,
        next: currentMatchday + 1,
      };
    }

    fs.writeFileSync(targetPath, JSON.stringify(leagueStatusMap, null, 2), "utf-8");
    console.log(`✅ matchday_status.json に保存しました (${Object.keys(leagueStatusMap).length} リーグ)`);
    await sendDiscordMessage(`✅ matchday_status.json を更新しました（${Object.keys(leagueStatusMap).length} リーグ）`);
  } catch (err) {
    console.error("❌ エラー:", err);
    await sendDiscordMessage(`❌ エラー発生: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
};

main();
