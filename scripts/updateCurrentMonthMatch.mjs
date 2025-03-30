// scripts/updateCurrentMonthMatch.mjs
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";
dayjs.extend(utc);
dayjs.extend(timezone);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_PATH = path.join(__dirname, "../src/data/current_month_match.json");

// ✅ 修正：Secretsから復元した serviceAccountKey.json を直接読み込む
const serviceAccount = JSON.parse(fs.readFileSync("serviceAccountKey.json", "utf8"));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const now = dayjs().tz("Asia/Tokyo");
const year = now.year();
const month = now.month() + 1;

function isSameMonth(dateStr) {
  const d = dayjs(dateStr).tz("Asia/Tokyo");
  return d.year() === year && d.month() + 1 === month;
}

async function fetchMatchesThisMonth() {
  const matchesRef = db.collection("matches");
  const snapshot = await matchesRef.get();

  const result = [];

  snapshot.forEach(doc => {
    const data = doc.data();
    if (!data.kickoffTime) return;
    if (!isSameMonth(data.kickoffTime)) return;

    result.push({
      matchId: doc.id,
      league: data.league,
      kickoffTime: data.kickoffTime,
      matchday: data.matchday,
      homeTeam: {
        id: data.homeTeam.id,
        name: data.homeTeam.name,
        players: data.homeTeam.players || [],
      },
      awayTeam: {
        id: data.awayTeam.id,
        name: data.awayTeam.name,
        players: data.awayTeam.players || [],
      },
      lineupStatus: data.lineupStatus || "未発表",
      score: data.score || {
        fullTime: { home: null, away: null },
        halfTime: { home: null, away: null, winner: null },
      },
      startingMembers: data.startingMembers || [],
      substitutes: data.substitutes || [],
      outOfSquad: data.outOfSquad || [],
    });
  });

  return result;
}

async function main() {
  try {
    const matches = await fetchMatchesThisMonth();
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(matches, null, 2), "utf8");
    console.log(`✅ 保存完了: ${OUTPUT_PATH}`);
    console.log(`🔄 今月の試合数: ${matches.length}`);
  } catch (err) {
    console.error("❌ エラー:", err);
    process.exit(1);
  }
}

main();
