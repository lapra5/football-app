// scripts/fetchLineups.mts
import fs from "fs/promises";
import path from "path";
import fetch from "node-fetch";
import * as cheerio from "cheerio";

const webhookUrl = process.env.DISCORD_WEBHOOK_LINEUPS ?? "";
const JSON_PATH = path.resolve("src/data/current_month_matches.json");

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
  const res = await fetch("https://soccer.yahoo.co.jp/ws/japanese/players");
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
      const kickoff = $(cols[1]).text().trim();
      const statusStr = $(cols[4]).text().trim();
      const matchday = parseInt(matchdayStr, 10);
      if (isNaN(matchday)) return;

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
  const fileContent = await fs.readFile(JSON_PATH, "utf8");
  const matches = JSON.parse(fileContent);
  let updatedCount = 0;
  const updatedPlayers: { name: string; status: AppearanceStatus }[] = [];

  for (const match of matches) {
    const kickoff = match.kickoffTime?.slice(0, 16);
    const matchday = match.matchday;
    if (!kickoff || !match.homeTeam || !match.awayTeam) continue;

    const updates: Record<string, string[]> = {
      startingMembers: match.startingMembers ?? [],
      substitutes: match.substitutes ?? [],
      outOfSquad: match.outOfSquad ?? [],
    };

    const japanesePlayers = [
      ...(match.homeTeam.players ?? []),
      ...(match.awayTeam.players ?? []),
    ];

    for (const player of appearances) {
      if (player.matchday !== matchday) continue;
      if (!kickoff.includes(player.kickoff.slice(0, 5))) continue;
      if (!japanesePlayers.includes(player.name)) continue;

      const targetKey =
        player.status === "starter"
          ? "startingMembers"
          : player.status === "sub"
          ? "substitutes"
          : "outOfSquad";

      if (!updates[targetKey].includes(player.name)) {
        updates[targetKey].push(player.name);
        updatedPlayers.push({ name: player.name, status: player.status });
        console.log(`✅ 登録: ${player.name} (${player.status}) -> ${targetKey}`);
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

  await fs.writeFile(JSON_PATH, JSON.stringify(matches, null, 2), "utf8");

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
      `✅ スタメン取得成功\n${updatedCount}試合分の出場情報を current_month_matches.json に反映しました。\n\n${playerList}${more}`
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
