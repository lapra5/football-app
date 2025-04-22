import fs from "fs/promises";
import path from "path";
import fetch from "node-fetch";
import * as cheerio from "cheerio";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault("Asia/Tokyo");

const JAPANESE_PLAYERS_URL = "https://soccer.yahoo.co.jp/ws/japanese/players";
const MATCH_JSON_PATH = path.resolve("src/data/current_month_matches.json");
const UPDATED_LOG_PATH = path.resolve("src/data/updated_log.json");
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

  $(".sc-player").each((i, el) => {
    const name = $(el).find("h3 a").text().trim();
    const rows = $(el).find("table tbody tr");

    rows.each((j, row) => {
      const cols = $(row).find("td");
      const matchdayStr = $(cols[0]).text().trim().replace("第", "").replace("節", "");
      const kickoffRaw = $(cols[1]).text().trim();
      const statusStr = $(cols[4]).text().trim();

      const matchday = parseInt(matchdayStr, 10);
      if (isNaN(matchday) || !kickoffRaw) return;

      const match = kickoffRaw.match(/(\d+)\/(\d+).*?(\d+):(\d+)/);
      if (!match) return;
      const [_, month, day, hour, minute] = match.map(Number);

      const adjustedHour = hour >= 24 ? hour - 24 : hour;
      const date = dayjs.tz(
        `2025-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")} ${adjustedHour}:${minute}`,
        "Asia/Tokyo"
      );
      const kickoff = date.utc().format("YYYY-MM-DDTHH:mm");

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

const updateLocalMatchJson = async (
  appearances: Awaited<ReturnType<typeof extractAppearanceInfo>>
) => {
  const raw = await fs.readFile(MATCH_JSON_PATH, "utf-8");
  const matches = JSON.parse(raw) as any[];

  let updatedCount = 0;
  const updatedPlayers: { name: string; status: AppearanceStatus }[] = [];

  for (const match of matches) {
    const matchday = match.matchday;
    const kickoffTime = match.kickoffTime?.slice(0, 16);
    const homeNames = match.homeTeam?.players ?? [];
    const awayNames = match.awayTeam?.players ?? [];
    const allPlayers = [...homeNames, ...awayNames];

    for (const player of appearances) {
      const matchdayMatch = player.matchday === matchday;
      const kickoffMatch = kickoffTime === player.kickoff;
      const playerMatch = allPlayers.includes(player.name);

      // ✅ デバッグ出力
      console.log(`🔎 チェック中: ${player.name} | 節=${player.matchday}, kickoff=${player.kickoff}`);
      console.log(`    🟢 節一致: ${matchdayMatch}, 🕒 時刻一致: ${kickoffMatch}, 👤 名前一致: ${playerMatch}`);

      if (!matchdayMatch || !kickoffMatch || !playerMatch) {
        console.log("    ⛔ マッチしなかったためスキップ\n");
        continue;
      }

      const key =
        player.status === "starter"
          ? "startingMembers"
          : player.status === "sub"
          ? "substitutes"
          : "outOfSquad";

      match[key] ??= [];
      if (!match[key].includes(player.name)) {
        match[key].push(player.name);
        updatedPlayers.push({ name: player.name, status: player.status });
        console.log(`✅ ${player.name} を ${key} に追加\n`);
        updatedCount++;
      }
    }
  }

  await fs.writeFile(MATCH_JSON_PATH, JSON.stringify(matches, null, 2), "utf-8");

  const updatedLog = JSON.parse(await fs.readFile(UPDATED_LOG_PATH, "utf-8"));
  updatedLog["fetchLineups"] = new Date().toISOString();
  await fs.writeFile(UPDATED_LOG_PATH, JSON.stringify(updatedLog, null, 2), "utf-8");

  return { updatedCount, updatedPlayers };
};

const main = async () => {
  try {
    console.log("🟡 スタメン情報取得開始（fetchLineups）");
    const appearances = await extractAppearanceInfo();
    const { updatedCount, updatedPlayers } = await updateLocalMatchJson(appearances);

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
    await sendDiscordMessage(
      `❌ スタメン取得失敗\nエラー内容：\n\`\`\`\n${String(error)}\n\`\`\``
    );
    process.exit(1);
  }
};

main();
