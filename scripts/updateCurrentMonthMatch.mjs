import fs from "fs";
import path from "path";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { fileURLToPath } from "url";
import serviceAccount from "../serviceAccountKey.json" assert { type: "json" };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_PATH = path.join(__dirname, "../src/data/current_month_match.json");
const TEAM_DATA_PATH = path.join(__dirname, "../src/data/team_league_names.json");

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

function getThisMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  return [start.toISOString(), end.toISOString()];
}

function extractJapanesePlayers(teamId, playerNames, teamData) {
  const team = teamData.teams.find((t) => t.teamId === teamId);
  if (!team || !team.players) return [];

  return team.players
    .filter((p) => playerNames.includes(p.jp))
    .map((p) => p.en || p.jp);
}

async function updateCurrentMonthMatch() {
  const [start, end] = getThisMonthRange();

  const snapshot = await db
    .collection("matches")
    .where("kickoffTime", ">=", start)
    .where("kickoffTime", "<=", end)
    .get();

  const teamData = JSON.parse(fs.readFileSync(TEAM_DATA_PATH, "utf8"));
  const matches = [];

  snapshot.forEach((doc) => {
    const m = doc.data();

    const homePlayers = extractJapanesePlayers(m.homeTeam.id, m.homeTeam.players || [], teamData);
    const awayPlayers = extractJapanesePlayers(m.awayTeam.id, m.awayTeam.players || [], teamData);

    matches.push({
      matchId: m.matchId,
      league: m.league,
      kickoffTime: m.kickoffTime,
      matchday: m.matchday,
      homeTeam: {
        id: m.homeTeam.id,
        name: m.homeTeam.name,
        players: homePlayers,
      },
      awayTeam: {
        id: m.awayTeam.id,
        name: m.awayTeam.name,
        players: awayPlayers,
      },
      lineupStatus: m.lineupStatus,
      score: m.score,
      startingMembers: m.startingMembers || [],
      substitutes: m.substitutes || [],
      outOfSquad: m.outOfSquad || [],
    });
  });

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(matches, null, 2), "utf8");
  console.log("✅ current_month_match.json を保存しました");
  console.log("件数:", matches.length);
}

updateCurrentMonthMatch();
