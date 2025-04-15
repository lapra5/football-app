import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import dotenv from "dotenv";
import { updateTimestamp } from "../src/utils/updateLog.ts";
import { sendDiscordMessage } from "../src/utils/discordNotify.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const base64 = process.env.FIREBASE_PRIVATE_KEY_JSON_BASE64!;
const serviceAccount = JSON.parse(Buffer.from(base64, "base64").toString());
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const outputPath = path.resolve(__dirname, "../src/data/current_month_matches.json");
const jleaguePath = path.resolve(__dirname, "../src/data/current_month_matches_jleague.json");
const celticPath = path.resolve(__dirname, "../src/data/current_month_matches_celtic.json");

const getTargetRange = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 30, 23, 59, 59);
  return [start.toISOString(), end.toISOString()];
};

const normalizeMatch = (match: any) => ({
  matchId: match.matchId || "",
  kickoffTime: match.kickoffTime || "",
  homeTeam: match.homeTeam || {},
  awayTeam: match.awayTeam || {},
  league: match.league || "",
  matchday: match.matchday ?? 0,
  status: match.status || "SCHEDULED",
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
});

const main = async () => {
  try {
    const [start, end] = getTargetRange();
    const overseaLeagues = [
      "2001", "2002", "2003", "2013", "2014", "2015", "2016", "2017", "2019", "2021"
    ];

    const snapshots = await Promise.all(
      overseaLeagues.map((id) =>
        db
          .collection("leagues")
          .doc(id)
          .collection("matches")
          .where("kickoffTime", ">=", start)
          .where("kickoffTime", "<=", end)
          .get()
      )
    );

    const overseaMatches = snapshots.flatMap((snap) =>
      snap.docs.map((doc) => normalizeMatch(doc.data()))
    );

    const jleagueMatches = fs.existsSync(jleaguePath)
      ? JSON.parse(fs.readFileSync(jleaguePath, "utf-8")).map(normalizeMatch)
      : [];

    const celticMatches = fs.existsSync(celticPath)
      ? JSON.parse(fs.readFileSync(celticPath, "utf-8")).map(normalizeMatch)
      : [];

    const allMatches = [...overseaMatches, ...jleagueMatches, ...celticMatches];

    fs.writeFileSync(outputPath, JSON.stringify(allMatches, null, 2), "utf-8");

    console.log(`✅ 海外 ${overseaMatches.length} 件, Jリーグ ${jleagueMatches.length} 件, セルティック ${celticMatches.length} 件 統合`);
    console.log(`📝 書き出し完了: ${outputPath}`);

    updateTimestamp("mergeMatches");
    await sendDiscordMessage(`📝 マッチ統合完了: 合計 ${allMatches.length} 試合を current_month_matches.json に書き出しました`, process.env.DISCORD_WEBHOOK_MATCHES!);
  } catch (err) {
    console.error("❌ エラー:", err);
    await sendDiscordMessage(`❌ マッチ統合失敗: ${(err as Error).message}`, process.env.DISCORD_WEBHOOK_MATCHES!);
    process.exit(1);
  }
};

main();
