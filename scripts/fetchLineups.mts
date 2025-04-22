import fs from "fs/promises";
import path from "path";
import fetch from "node-fetch";
import * as cheerio from "cheerio";
import { fileURLToPath } from "url";
import { dirname } from "path";

const JAPANESE_PLAYERS_URL = "https://soccer.yahoo.co.jp/ws/japanese/players";
const JSON_PATH = path.join(dirname(fileURLToPath(import.meta.url)), "../src/data/current_month_matches.json");
const webhookUrl = process.env.DISCORD_WEBHOOK_LINEUPS ?? "";

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

const parseYahooTime = (text: string): string | null => {
  const match = text.match(/(\d+)\/(\d+).*?(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const [, month, day, hourStr, minuteStr] = match;
  let hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);
  const date = new Date();

  date.setMonth(parseInt(month, 10) - 1);
  date.setDate(parseInt(day, 10));
  date.setMinutes(minute);
  date.setSeconds(0);
  date.setMilliseconds(0);

  if (hour >= 24) {
    date.setDate(date.getDate() + 1);
    hour -= 24;
  }

  date.setHours(hour);
  return date.toISOString().slice(0, 16); // YYYY-MM-DDTHH:mm
};

const extractAppearanceInfo = async (): Promise<
  { name: string; matchday: number; kickoff: string; status: AppearanceStatus }[]
> => {
  const res = await fetch(JAPANESE_PLAYERS_URL);
  const html = await res.text();
  const $ = cheerio.load(html);
  const appearances: {
    name: string;
    matchday: number;
    kickoff: string;
    status: AppearanceStatus;
  }[] = [];

  $(".sc-player").each((_, el) => {
    const name = $(el).find("h3 a").text().trim();
    const rows = $(el).find("table tbody tr");

    rows.each((_, row) => {
      const cols = $(row).find("td");
      const matchdayStr = $(cols[0]).text().trim().replace("第", "").replace("節", "");
      const kickoffRaw = $(cols[1]).text().trim();
      const statusStr = $(cols[4]).text().trim();

      const kickoff = parseYahooTime(kickoffRaw);
      const matchday = parseInt(matchdayStr, 10);
      if (!kickoff || isNaN(matchday)) return;

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
  console.log(`📋 appearanceサンプル:`, appearances.slice(0, 5));
  return appearances;
};

const updateJsonWithAppearances = async (
  appearances: Awaited<ReturnType<typeof extractAppearanceInfo>>
) => {
  const raw = await fs.readFile(JSON_PATH, "utf-8");
  const matches = JSON.parse(raw);
  let updatedCount = 0;
  const updatedPlayers: { name: string; status: AppearanceStatus }[] = [];

  for (const match of matches) {
    const matchday = match.matchday;
    const kickoff = match.kickoffTime?.slice(0, 16); // YYYY-MM-DDTHH:mm
    const homePlayers: string[] = match.homeTeam?.players ?? [];
    const awayPlayers: string[] = match.awayTeam?.players ?? [];

    const updates: any = {
      startingMembers: match.startingMembers ?? [],
      substitutes: match.substitutes ?? [],
      outOfSquad: match.outOfSquad ?? [],
    };

    for (const p of appearances) {
      if (p.matchday !== matchday || p.kickoff !== kickoff) continue;

      const isHome = homePlayers.includes(p.name);
      const isAway = awayPlayers.includes(p.name);
      if (!isHome && !isAway) continue;

      const key =
        p.status === "starter" ? "startingMembers" :
        p.status === "sub" ? "substitutes" :
        "outOfSquad";

      if (!updates[key].includes(p.name)) {
        updates[key].push(p.name);
        updatedPlayers.push({ name: p.name, status: p.status });
        console.log(`✅ 反映: ${p.name}（${p.status}）`);
      }
    }

    match.startingMembers = updates.startingMembers;
    match.substitutes = updates.substitutes;
    match.outOfSquad = updates.outOfSquad;

    if (
      updates.startingMembers.length > 0 ||
      updates.substitutes.length > 0 ||
      updates.outOfSquad.length > 0
    ) {
      updatedCount++;
    }
  }

  await fs.writeFile(JSON_PATH, JSON.stringify(matches, null, 2), "utf-8");
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
