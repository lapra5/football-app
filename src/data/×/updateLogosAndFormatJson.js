const fs = require("fs");
const path = require("path");
const https = require("https");

const leagues = {
  "Premier League": "プレミアリーグ（イングランド1部）",
  "Championship": "EFLチャンピオンシップ（イングランド2部）",
  "EFL Championship": "EFLチャンピオンシップ（イングランド2部）",
  "League One": "EFLリーグ1（イングランド3部）",
  "Bundesliga": "ブンデスリーガ（ドイツ1部）",
  "1. Bundesliga": "ブンデスリーガ（ドイツ1部）",
  "Serie A": "セリエA（イタリア1部）",
  "La Liga": "ラ・リーガ（スペイン1部）",
  "Primera Division": "ラ・リーガ（スペイン1部）",
  "Ligue 1": "リーグ・アン（フランス1部）",
  "Eredivisie": "エールディヴィジ（オランダ1部）",
  "Primeira Liga": "プリメイラ・リーガ（ポルトガル1部）",
  "Champions-League": "UEFAチャンピオンズリーグ",
  "Campeonato Brasileiro Série A": "カンピオナート・ブラジレイロ・セリエA（ブラジル1部）",
};

const breakAfterIds = [1044, 576, 6806, 7397, 745, 721, 10340, 1138];

const filePath = path.resolve(__dirname, "team_league_names.json");
const raw = fs.readFileSync(filePath, "utf-8");
const data = JSON.parse(raw);

const checkUrlExists = (url) => {
  return new Promise((resolve) => {
    https
      .get(url, (res) => resolve(res.statusCode === 200))
      .on("error", () => resolve(false));
  });
};

const run = async () => {
  console.log("🔎 ロゴURL診断 & 自動修正を開始します...");

  for (const team of data.teams) {
    const logoUrl = `https://crests.football-data.org/${team.teamId}.svg`;
    const exists = await checkUrlExists(logoUrl);
    if (!exists) {
      console.log(`⚠️ ロゴが見つからない: ${team.team} (${team.teamId}) -> 空に更新`);
      team.logo = "";
    } else {
      team.logo = logoUrl;
    }
  }

  const teamLines = data.teams.flatMap((team, index, arr) => {
    const line = `  { "teamId": ${team.teamId}, "team": "${team.team}", "players": ${JSON.stringify(
      team.players
    )}, "logo": "${team.logo}" }${index < arr.length - 1 ? "," : ""}`;
    return breakAfterIds.includes(team.teamId) ? [line, ""] : [line];
  });

  const leaguesJson = JSON.stringify({ leagues }, null, 2).replace(/^{\n|}$/g, "");

  const finalJson = `{\n  "teams": [\n${teamLines.join("\n")}\n  ],\n${leaguesJson}\n}`;

  fs.writeFileSync(filePath, finalJson, "utf-8");

  console.log("✅ 診断と自動修正が完了し、整形して保存しました！");
};

run();
