import * as cheerio from "cheerio";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { sendDiscordMessage } from "../src/utils/discordNotify.ts";
import { updateTimestamp } from "../src/utils/updateLog.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const DATA_PATH = path.join(__dirname, "../src/data/team_league_names.json");
const LOG_PATH = path.join(__dirname, "../src/data/transfer_cleanup_log.csv");

function normalizeName(name: string): string {
  return name
    .replace(/[・\s]/g, "")
    .replace(/ヴィ/g, "ビ")
    .replace(/トゥ/g, "ツ")
    .replace(/メンヘングラードバッハ/g, "メンヒェングラートバッハ")
    .replace(/[^぀-ヿ一-龯\w]/g, "")
    .toLowerCase();
}

function isMatch(nameA: string, nameB: string): boolean {
  const normA = normalizeName(nameA);
  const normB = normalizeName(nameB);
  return !!normA && !!normB && (normA === normB || normA.includes(normB) || normB.includes(normA));
}

function loadTeamData(): any {
  return JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
}

function writeCsvLog(logs: any[]): void {
  const headers = "Type,Player,Team,Details\n";
  const rows = logs.map(l => `${l.type},${l.player},${l.team},${l.details || ""}`).join("\n");
  fs.writeFileSync(LOG_PATH, headers + rows, "utf8");
}

function saveTeamDataFormatted(data: any): void {
  const breakIds = new Set([1044, 1138, 576, 721, 7397, 745, 6806, 10340]);
  const lines: string[] = [];

  lines.push("{");
  lines.push('  "teams": [');

  data.teams.forEach((team: any, idx: number) => {
    const players = team.players || [];
    const englishplayers = team.englishplayers || [];
    const line = `    { "teamId": ${team.teamId}, "team": "${team.team}", "englishName": "${team.englishName}", "players": [${players.map((p: string) => `"${p}"`).join(", ")}], "englishplayers": [${englishplayers.map((p: string) => `"${p}"`).join(", ")}], "logo": "${team.logo}" }`;
    const isLast = idx === data.teams.length - 1;
    lines.push(line + (breakIds.has(team.teamId) || !isLast ? "," : ""));
    if (breakIds.has(team.teamId)) lines.push("");
  });

  lines.push("  ],");
  lines.push('  "leagues": {');
  const leagueEntries = Object.entries(data.leagues || {});
  leagueEntries.forEach(([key, val], idx) => {
    lines.push(`    "${key}": "${val}"${idx < leagueEntries.length - 1 ? "," : ""}`);
  });
  lines.push("  }");
  lines.push("}");

  fs.writeFileSync(DATA_PATH, lines.join("\n"), "utf8");
}

async function fetchFromWorldFootball(jpName: string): Promise<string> {
  const searchUrl = `https://www.worldfootball.net/search/?q=${encodeURIComponent(jpName)}`;
  try {
    const res = await fetch(searchUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
    const html = await res.text();
    const $ = cheerio.load(html);
    const link = $('a[href*="/player_summary/"]').first().attr("href");
    if (!link) return "undefined";

    const detailRes = await fetch(`https://www.worldfootball.net${link}`);
    const detailHtml = await detailRes.text();
    const $$ = cheerio.load(detailHtml);
    const name = $$('.head h2[itemprop="name"]').text().trim();
    return name || "undefined";
  } catch {
    return "undefined";
  }
}

async function fetchEnglishName(jpName: string): Promise<string> {
  const titles = [
    encodeURIComponent(jpName.replace(/ /g, "_")),
    encodeURIComponent(jpName.replace(/ /g, ""))
  ];
  for (const title of titles) {
    const url = `https://ja.wikipedia.org/w/api.php?action=query&format=json&prop=langlinks&titles=${title}&lllang=en`;
    try {
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
      const json = await res.json();
      const page: any = Object.values(json.query.pages)[0];
      if (page.langlinks && page.langlinks[0]) {
        return page.langlinks[0]["*"];
      }
    } catch {}
  }

  try {
    const searchUrl = `https://www.footballdatabase.eu/en/search/${encodeURIComponent(jpName)}`;
    const res = await fetch(searchUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
    const html = await res.text();
    const $ = cheerio.load(html);
    const firstResult = $('a[href*="/players/"]').first().text().trim();
    if (firstResult) return firstResult;

    const nameH1 = $(".titlePlayer h1").first().text().trim().replace(/\s+/g, " ");
    if (nameH1) return nameH1;
  } catch {}

  return await fetchFromWorldFootball(jpName);
}

async function fetchJapanesePlayers(): Promise<{ player: string; team: string }[]> {
  const res = await fetch("https://soccer.yahoo.co.jp/ws/japanese/players");
  const html = await res.text();
  const $ = cheerio.load(html);
  const results: { player: string; team: string }[] = [];

  $("section.sc-modCommon02").each((_, section) => {
    const team = $(section).find(".sc-head01__title").text().trim();
    $(section).find(".sc-head03__title a").each((_, el) => {
      const player = $(el).text().trim();
      results.push({ player, team });
    });
  });

  return results;
}

const publicUpdatedLogPath = path.resolve("public/updated_log.json");

const main = async () => {
  console.log("🚀 updatePlayers 開始");
  try {
    const fetched = await fetchJapanesePlayers();
    const data = loadTeamData();
    const logs: any[] = [];
    const processed = new Set<string>();

    for (const team of data.teams) {
      team.players = team.players || [];
      team.englishplayers = team.englishplayers || [];
    }

    for (const { player, team: newTeamName } of fetched) {
      processed.add(player);
      const matchedTeam = data.teams.find((t: any) => isMatch(t.team, newTeamName) || isMatch(t.englishName, newTeamName));
      if (!matchedTeam) {
        logs.push({ type: "TeamMismatch", player, team: newTeamName });
        continue;
      }

      const idx = matchedTeam.players.indexOf(player);
      if (idx !== -1) {
        const currentEn = matchedTeam.englishplayers[idx];
        if (!currentEn || currentEn === "undefined") {
          const enName = await fetchEnglishName(player);
          matchedTeam.englishplayers[idx] = enName;
          logs.push({ type: "RetryUpdate", player, team: matchedTeam.team, details: enName });
        } else {
          logs.push({ type: "Unchanged", player, team: matchedTeam.team });
        }
        continue;
      }

      const enName = await fetchEnglishName(player);
      matchedTeam.players.push(player);
      matchedTeam.englishplayers.push(enName);
      logs.push({ type: "Added", player, team: matchedTeam.team, details: enName });
    }

    for (const team of data.teams) {
      const newJp: string[] = [];
      const newEn: string[] = [];
      for (let i = 0; i < team.players.length; i++) {
        const jp = team.players[i];
        const en = team.englishplayers[i];
        if (processed.has(jp)) {
          newJp.push(jp);
          newEn.push(en);
        } else {
          logs.push({ type: "Removed", player: jp, team: team.team });
        }
      }
      team.players = newJp;
      team.englishplayers = newEn;
    }

    saveTeamDataFormatted(data);
    writeCsvLog(logs);
    console.log("✔ 完了しました！");
    await sendDiscordMessage(
      `✅ 日本人選手の移籍情報を更新しました（件数: ${logs.length}）\n・team_league_names.json を保存\n・transfer_cleanup_log.csv を出力`,
      process.env.DISCORD_WEBHOOK_PLAYERS ?? ""
    );

    // 🔥 updated_log.json 更新＋publicにコピー
    updateTimestamp("updatePlayers");
    const updatedLogData = fs.readFileSync("src/data/updated_log.json", "utf-8");
    fs.writeFileSync(publicUpdatedLogPath, updatedLogData, "utf-8");

  } catch (err) {
    console.error("❌ エラー発生:", err);
    await sendDiscordMessage(
      `❌ updatePlayers エラー: ${err instanceof Error ? err.message : String(err)}\n・team_league_names.json は未更新\n・transfer_cleanup_log.csv は未出力の可能性あり`,
      process.env.DISCORD_WEBHOOK_PLAYERS ?? ""
    );
    process.exit(1);
  }
};

main();