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

const filePath = path.resolve("team_league_names.json");
const saveFilePath = path.resolve("team_league_names_API-FOOTBALL.json");

const raw = fs.readFileSync(filePath, "utf-8");
const data = JSON.parse(raw);

const fetchLogoFromAPIFootball = async (teamName) => {
  const url = `https://v3.football.api-sports.io/teams?search=${encodeURIComponent(teamName)}`;

  try {
    const res = await fetch(url, {
      headers: {
        "x-apisports-key": apiKey,
      },
    });
    const json = await res.json();

    if (json.response && json.response.length > 0) {
      return json.response[0].team.logo;
    } else {
      console.log(`⚠️ ${teamName} のロゴがAPIで見つかりませんでした`);
      return "";
    }
  } catch (err) {
    console.error(`❌ ${teamName} 取得エラー:`, err);
    return "";
  }
};

const run = async () => {
  console.log("🚀 API-FOOTBALL からロゴ取得開始...");

  const updatedTeams = [];
  for (const team of data.teams) {
    console.log(`➡️ ${team.team} のロゴ取得中...`);
    const logo = await fetchLogoFromAPIFootball(team.team);
    updatedTeams.push({
      teamId: team.teamId,
      team: team.team,
      players: team.players,
      logo,
    });
  }

  const finalJson = JSON.stringify({ teams: updatedTeams, leagues: data.leagues }, null, 2);
  fs.writeFileSync(saveFilePath, finalJson, "utf-8");

  console.log(`✅ 完了！結果は ${saveFilePath} に保存しました！`);
};

run();
