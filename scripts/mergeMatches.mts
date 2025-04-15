// 🚀 開始ログ
console.log("🚀 mergeMatches 開始");

import * as fs from "fs";
import * as path from "path";
import { updateTimestamp } from "../src/utils/updateLog.ts";
import { sendDiscordMessage } from "../src/utils/discordNotify.ts";

const JLEAGUE_PATH = path.resolve("src/data/current_month_matches_jleague.json");
const CELTIC_PATH = path.resolve("src/data/current_month_matches_celtic.json");
const OVERSEA_PATH = path.resolve("src/data/current_month_matches_oversea.json");
const TEAM_LEAGUE_NAMES_PATH = path.resolve("src/data/team_league_names.json");
const OUTPUT_PATH = path.resolve("src/data/current_month_matches.json");
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK_MATCHES || "";

const readJson = (filePath: string): any[] => {
  try {
    const data = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(data);
  } catch (err) {
    console.warn(`⚠️ ${filePath} の読み込みに失敗しました:`, err);
    return [];
  }
};

const readLeagueMap = (): Record<string, string> => {
  try {
    const raw = fs.readFileSync(TEAM_LEAGUE_NAMES_PATH, "utf-8");
    const json = JSON.parse(raw);
    const leagues = json.leagues as { en: string; jp: string }[];
    return Object.fromEntries(leagues.map((l) => [l.en.trim(), l.jp.trim()]));
  } catch (err) {
    console.warn("⚠️ team_league_names.json の読み込みに失敗しました:", err);
    return {};
  }
};

const normalizeMatch = (match: any, leagueMap: Record<string, string>): any => {
  let leagueEn = "";
  if (typeof match.league === "string") {
    leagueEn = match.league.trim();
  } else if (typeof match.league?.en === "string") {
    leagueEn = match.league.en.trim();
  }

  const leagueJp =
    typeof match.league?.jp === "string"
      ? match.league.jp
      : leagueMap[leagueEn] || leagueEn;

  return {
    matchId: match.matchId || "",
    kickoffTime: match.kickoffTime || null,
    matchday: match.matchday ?? null,
    league: {
      en: leagueEn,
      jp: leagueJp,
    },
    homeTeam: {
      id: match.homeTeam?.id ?? null,
      name: match.homeTeam?.name || { jp: "", en: "" },
      players: match.homeTeam?.players || [],
      englishplayers: match.homeTeam?.englishplayers || [],
      logo: match.homeTeam?.logo || "",
    },
    awayTeam: {
      id: match.awayTeam?.id ?? null,
      name: match.awayTeam?.name || { jp: "", en: "" },
      players: match.awayTeam?.players || [],
      englishplayers: match.awayTeam?.englishplayers || [],
      logo: match.awayTeam?.logo || "",
    },
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
  };
};

const main = async () => {
  try {
    const jleagueMatches = readJson(JLEAGUE_PATH);
    const celticMatches = readJson(CELTIC_PATH);
    const overseaMatches = readJson(OVERSEA_PATH);
    const leagueMap = readLeagueMap();

    const allMatches = [...jleagueMatches, ...celticMatches, ...overseaMatches];
    const normalized = allMatches.map((match) => normalizeMatch(match, leagueMap));

    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(normalized, null, 2), "utf-8");
    console.log(`✅ 全試合 ${normalized.length} 件を ${OUTPUT_PATH} に保存しました`);

    updateTimestamp("mergeMatches");
    await sendDiscordMessage(
      `✅ 日程マージ完了（全: ${normalized.length} 件, 国内: ${jleagueMatches.length} 件, 海外: ${celticMatches.length + overseaMatches.length} 件）`,
      DISCORD_WEBHOOK
    );
  } catch (err) {
    console.error("❌ マージ中にエラー:", err);
    await sendDiscordMessage(
      `❌ 日程マージ処理エラー: ${(err as Error).message}`,
      DISCORD_WEBHOOK
    );
    process.exit(1);
  }
};

main();
