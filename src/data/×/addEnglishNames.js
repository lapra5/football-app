import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve("../../.env.local") });
const apiKey = process.env.API_FOOTBALL_KEY;
if (!apiKey) {
  console.error("❌ .env.local に API_FOOTBALL_KEY が設定されていません");
  process.exit(1);
}

const leagues = [
  { id: 39, name: "Premier League" },
  { id: 40, name: "Championship" },
  { id: 61, name: "Serie A" },
  { id: 78, name: "Bundesliga" },
  { id: 135, name: "La Liga" },
  { id: 140, name: "Ligue 1" },
  { id: 88, name: "Eredivisie" },
  { id: 94, name: "Primeira Liga" },
  { id: 71, name: "Campeonato Brasileiro Série A" },
];

const filePath = path.resolve("team_league_names.json");
const raw = fs.readFileSync(filePath, "utf-8");
const data = JSON.parse(raw);
const breakAfterIds = [1044, 576, 6806, 7397, 745, 721, 10340, 1138];

const fetchTeamsFromLeague = async (leagueId) => {
  const res = await fetch(`https://v3.football.api-sports.io/teams?league=${leagueId}&season=2023`, {
    headers: { "x-apisports-key": apiKey },
  });
  const json = await res.json();
  return json.response || [];
};

const run = async () => {
  console.log("🚀 API-FOOTBALLから英語名一括取得開始...");

  const englishNameMap = {};
  for (const league of leagues) {
    console.log(`➡️ ${league.name} を取得中...`);
    const teams = await fetchTeamsFromLeague(league.id);
    teams.forEach((t) => {
      englishNameMap[t.team.id] = t.team.name;
    });
  }

  data.teams.forEach((team) => {
    const englishName = englishNameMap[team.teamId] || "";
    team.englishName = englishName;
  });

  const teamLines = data.teams.flatMap((team, index, arr) => {
    const line = `  { "teamId": ${team.teamId}, "team": "${team.team}", "englishName": "${team.englishName}", "players": ${JSON.stringify(
      team.players
    )}, "logo": "${team.logo}" }${index < arr.length - 1 ? "," : ""}`;
    return breakAfterIds.includes(team.teamId) ? [line, ""] : [line];
  });

  const leaguesJson = JSON.stringify({ leagues: {} }, null, 2).replace(/^{\n|}$/g, "");
  const finalJson = `{\n  "teams": [\n${teamLines.join("\n")}\n  ],\n${leaguesJson}\n}`;

  fs.writeFileSync(filePath, finalJson, "utf-8");
  console.log("🎉 完了！team_league_names.json に英名を追加しました！");
};

run();
