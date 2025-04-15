// 🚀 開始ログ
console.log("🚀 mergeMatches 開始");

import * as fs from "fs";
import * as path from "path";
import { updateTimestamp } from "../src/utils/updateLog.ts";
import { sendDiscordMessage } from "../src/utils/discordNotify.ts";

const JLEAGUE_PATH = path.resolve("src/data/current_month_matches_jleague.json");
const CELTIC_PATH = path.resolve("src/data/current_month_matches_celtic.json");
const OVERSEA_PATH = path.resolve("src/data/current_month_matches_oversea.json");
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

const normalizeMatch = (match: any): any => {
  return {
    matchId: match.matchId || "",
    kickoffTime: match.kickoffTime || null,
    matchday: match.matchday ?? null,
    league: {
      en: match.league?.en || match.league || "",
      jp: match.league?.jp || match.league || ""
    },
    homeTeam: {
      id: match.homeTeam?.id ?? null,
      name: match.homeTeam?.name || { jp: "", en: "" },
      players: match.homeTeam?.players || [],
      englishplayers: match.homeTeam?.englishplayers || [],
      logo: match.homeTeam?.logo || ""
    },
    awayTeam: {
      id: match.awayTeam?.id ?? null,
      name: match.awayTeam?.name || { jp: "", en: "" },
      players: match.awayTeam?.players || [],
      englishplayers: match.awayTeam?.englishplayers || [],
      logo: match.awayTeam?.logo || ""
    },
    lineupStatus: match.lineupStatus || "未発表",
    score: match.score || {
      winner: null,
      duration: "REGULAR",
      fullTime: { home: null, away: null },
      halfTime: { home: null, away: null }
    },
    startingMembers: match.startingMembers || [],
    substitutes: match.substitutes || [],
    outOfSquad: match.outOfSquad || []
  };
};

const main = async () => {
  try {
    const jleagueMatches = readJson(JLEAGUE_PATH);
    const celticMatches = readJson(CELTIC_PATH);
    const overseaMatchesRaw = readJson(OVERSEA_PATH);

    const normalized = [...jleagueMatches, ...celticMatches, ...overseaMatchesRaw].map(normalizeMatch);

    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(normalized, null, 2), "utf-8");
    console.log(`✅ 全試合 ${normalized.length} 件を ${OUTPUT_PATH} に保存しました`);

    updateTimestamp("mergeMatches");
    await sendDiscordMessage(
      `✅ 日程マージ完了（全: ${normalized.length} 件, 国内: ${jleagueMatches.length} 件, 海外: ${celticMatches.length + overseaMatchesRaw.length} 件）`,
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
