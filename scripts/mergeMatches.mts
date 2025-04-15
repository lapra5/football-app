// scripts/mergeMatches.mts
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { updateTimestamp } from "../src/utils/updateLog.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const OUTPUT_PATH = path.resolve(__dirname, "../src/data/current_month_matches.json");
const SOURCE_FILES = [
  path.resolve(__dirname, "../src/data/current_month_matches_oversea.json"),
  path.resolve(__dirname, "../src/data/current_month_matches_jleague.json"),
  path.resolve(__dirname, "../src/data/current_month_matches_celtic.json"),
];

const readJsonSafely = (filePath: string) => {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    console.error(`❌ ${filePath} 読み込み失敗:`, err);
    return [];
  }
};

const normalizeMatch = (match: any) => {
  return {
    matchId: match.matchId ?? match.id ?? "",
    kickoffTime: match.kickoffTime,
    matchday: match.matchday ?? 0,
    league: typeof match.league === "object"
      ? match.league
      : { en: match.league || "", jp: match.league || "" },
    homeTeam: {
      id: match.homeTeam?.id ?? null,
      name: typeof match.homeTeam?.name === "object"
        ? match.homeTeam.name
        : { jp: match.homeTeam?.name ?? "", en: "" },
      players: match.homeTeam?.players ?? [],
      englishplayers: match.homeTeam?.englishplayers ?? [],
      logo: match.homeTeam?.logo ?? "",
    },
    awayTeam: {
      id: match.awayTeam?.id ?? null,
      name: typeof match.awayTeam?.name === "object"
        ? match.awayTeam.name
        : { jp: match.awayTeam?.name ?? "", en: "" },
      players: match.awayTeam?.players ?? [],
      englishplayers: match.awayTeam?.englishplayers ?? [],
      logo: match.awayTeam?.logo ?? "",
    },
    lineupStatus: match.lineupStatus ?? "未発表",
    score: match.score ?? {
      winner: null,
      duration: "REGULAR",
      fullTime: { home: null, away: null },
      halfTime: { home: null, away: null },
    },
    startingMembers: match.startingMembers ?? [],
    substitutes: match.substitutes ?? [],
    outOfSquad: match.outOfSquad ?? [],
  };
};

const main = () => {
  const allMatches = SOURCE_FILES.flatMap(readJsonSafely).map(normalizeMatch);
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(allMatches, null, 2), "utf-8");
  console.log(`✅ ${allMatches.length} 件の試合を ${OUTPUT_PATH} に保存しました`);
  updateTimestamp("updateCurrentMonthMatch");
};

main();
