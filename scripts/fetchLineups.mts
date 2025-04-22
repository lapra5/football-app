import fs from "fs/promises";
import path from "path";
import fetch from "node-fetch";
import * as cheerio from "cheerio";

const webhookUrl = process.env.DISCORD_WEBHOOK_LINEUPS ?? "";
const MATCH_FILE_PATH = path.resolve("src/data/current_month_matches.json");
const JAPANESE_PLAYERS_URL = "https://soccer.yahoo.co.jp/ws/japanese/players";

type AppearanceStatus = "starter" | "sub" | "benchOut";

const sendDiscordMessage = async (message: string) => {
  if (!webhookUrl) return;
  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: message }),
    });
    console.log("✅ Discord通知送信成功");
  } catch (error) {
    console.error("❌ Discord通知送信失敗", error);
  }
};

const yahooTimeToUtc = (dateStr: string, timeStr: string): string => {
  const year = new Date().getFullYear();
  const [month, day] = dateStr.split("/").map(Number);
  let [hour, minute] = timeStr.split(":").map(Number);
  const baseDate = new Date(year, month - 1, day);

  if (hour >= 24) {
    baseDate.setDate(baseDate.getDate() + 1);
    hour -= 24;
  }

  baseDate.setHours(hour - 9, minute, 0);
  return baseDate.toISOString().slice(0, 16); // e.g. 2025-04-21T18:45
};

const extractAppearanceInfo = async (): Promise<
  { name: string; matchday: number; kickoff: string; status: AppearanceStatus }[]
> => {
  const res = await fetch(JAPANESE_PLAYERS_URL);
  const html = await res.text();
  const $ = cheerio.load(html);
  const appearances: any[] = [];

  $(".sc-player").each((_, el) => {
    const name = $(el).find("h3 a").text().trim();
    const rows = $(el).find("table tbody tr");

    let matchday = 0;
    let kickoff = "";

    rows.each((_, row) => {
      const cols = $(row).find("td");
      const matchdayRaw = $(cols[0]).find("span").text().trim();
      const timeRaw = $(cols[0]).find("time").text().trim();
      const statusStr = $(cols[1]).text().trim();

      const matchdayStr = matchdayRaw.replace("第", "").replace("節", "");
      matchday = parseInt(matchdayStr, 10);
      if (isNaN(matchday) || !timeRaw) return;

      const dateMatch = timeRaw.match(/(\d{1,2})\/(\d{1,2})/);
      const timeMatch = timeRaw.match(/(\d{1,2}:\d{2})/);
      if (!dateMatch || !timeMatch) return;

      kickoff = yahooTimeToUtc(`${dateMatch[1]}/${dateMatch[2]}`, timeMatch[1]);

      let status: AppearanceStatus | null = null;
      if (statusStr.includes("先発")) status = "starter";
      else if (statusStr.includes("途中")) status = "sub";
      else if (statusStr.includes("ベンチ外")) status = "benchOut";

      if (status) {
        appearances.push({ name, matchday, kickoff, status });
      }
    });
  });

  console.log(`🔍 appearance件数: ${appearances.length}`);
  return appearances;
};

const updateJsonWithAppearances = async (
  appearances: Awaited<ReturnType<typeof extractAppearanceInfo>>
) => {
  const json = JSON.parse(await fs.readFile(MATCH_FILE_PATH, "utf-8"));
  let updatedCount = 0;
  const updatedPlayers: { name: string; status: AppearanceStatus }[] = [];

  for (const match of json) {
    const { matchday, kickoffTime, homeTeam, awayTeam } = match;
    const kickoff = kickoffTime.slice(0, 16);
    const allPlayers = [...(homeTeam?.players ?? []), ...(awayTeam?.players ?? [])];

    let matchUpdated = false;

    for (const player of appearances) {
      if (player.matchday !== matchday) continue;
      if (!kickoff.includes(player.kickoff.slice(11, 16))) continue;
      if (!allPlayers.includes(player.name)) continue;

      const targetKey =
        player.status === "starter"
          ? "startingMembers"
          : player.status === "sub"
          ? "substitutes"
          : "outOfSquad";

      match[targetKey] ??= [];
      if (!match[targetKey].includes(player.name)) {
        match[targetKey].push(player.name);
        updatedPlayers.push({ name: player.name, status: player.status });
        console.log(`✅ ${player.name} を ${targetKey} に追加`);
        matchUpdated = true;
      }
    }

    if (matchUpdated) updatedCount++;
  }

  await fs.writeFile(MATCH_FILE_PATH, JSON.stringify(json, null, 2));
  return { updatedCount, updatedPlayers };
};

const main = async () => {
  try {
    console.log("🟡 スタメン情報取得開始（fetchLineups）");
    const appearances = await extractAppearanceInfo();
    const { updatedCount, updatedPlayers } = await updateJsonWithAppearances(appearances);

    const maxList = 15;
    const playerList = updatedPlayers
      .slice(0, maxList)
      .map((p) => `• ${p.name}：${p.status === "starter" ? "先発" : p.status === "sub" ? "途中出場" : "ベンチ外"}`)
      .join("\n");
    const more = updatedPlayers.length > maxList ? `\n…他${updatedPlayers.length - maxList}名` : "";

    await sendDiscordMessage(
      `✅ スタメン取得成功\ncurrent_month_matches.json に${updatedCount}試合分の出場情報を反映しました。\n\n${playerList}${more}`
    );

    console.log("✅ 完了");
  } catch (error) {
    console.error("❌ エラー:", error);
    await sendDiscordMessage(`❌ スタメン取得失敗\nエラー内容：\n\`\`\`\n${String(error)}\n\`\`\``);
    process.exit(1);
  }
};

main();
