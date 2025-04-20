import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fetch from "node-fetch";
import * as cheerio from "cheerio";

const serviceAccountBase64 = process.env.FIREBASE_ADMIN_BASE64;
const webhookUrl = process.env.DISCORD_WEBHOOK_LINEUPS ?? "";

if (!serviceAccountBase64) throw new Error("FIREBASE_ADMIN_BASE64 が未設定です");
const serviceAccount = JSON.parse(Buffer.from(serviceAccountBase64, "base64").toString("utf8"));
initializeApp({ credential: cert(serviceAccount) });

const db = getFirestore();
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

const updateFirestoreWithAppearances = async (
  appearances: Awaited<ReturnType<typeof extractAppearanceInfo>>
) => {
  const snapshot = await db.collectionGroup("matches").get();

  let updatedCount = 0;
  const updatedPlayers: { name: string; status: AppearanceStatus }[] = [];

  for (const doc of snapshot.docs) {
    const data = doc.data();

    const matchday = data.matchday;
    const utcDate = data.utcDate;
    const homeTeam = data.homeTeam?.name;
    const awayTeam = data.awayTeam?.name;

    if (!utcDate || !homeTeam || !awayTeam) continue;
    if (typeof utcDate !== "string") continue;

    const kickoff = utcDate.slice(0, 16);

    console.log(`🆚 試合: ${homeTeam} vs ${awayTeam} | matchday: ${matchday}, kickoff: ${kickoff}`);

    const updates: any = {};

    for (const player of appearances) {
      const matchdayMatch = player.matchday === matchday;
      const kickoffMatch = kickoff.includes(player.kickoff.slice(0, 5));
    
      if (!matchdayMatch) {
        console.log(`🛑 matchday不一致: 選手 ${player.name} 節: ${player.matchday} ≠ 試合: ${matchday}`);
        continue;
      }
    
      if (!kickoffMatch) {
        console.log(`🛑 kickoff不一致: 選手 ${player.name} 開始: ${player.kickoff} ≠ 試合: ${kickoff}`);
        continue;
      }
    
      // ここまで来たらマッチしている（両チームに登録試行）
      for (const side of ["homeTeam", "awayTeam"] as const) {
        const key =
          player.status === "starter"
            ? "startingMembers"
            : player.status === "sub"
            ? "substitutes"
            : "outOfSquad";
    
        updates[`${side}.${key}`] ??= [];
        if (!updates[`${side}.${key}`].includes(player.name)) {
          updates[`${side}.${key}`].push(player.name);
          updatedPlayers.push({ name: player.name, status: player.status });
          console.log(`✅ 登録: ${player.name}（${player.status}） -> ${side}.${key}`);
        }
      }
    }    

    if (Object.keys(updates).length > 0) {
      await doc.ref.update(updates);
      updatedCount++;
    }
  }

  return { updatedCount, updatedPlayers };
};

const main = async () => {
  try {
    console.log("🟡 スタメン情報取得開始（fetchLineups）");
    const appearances = await extractAppearanceInfo();
    const { updatedCount, updatedPlayers } = await updateFirestoreWithAppearances(appearances);

    const maxList = 15;
    const playerList = updatedPlayers
      .slice(0, maxList)
      .map((p) => `• ${p.name}：${p.status === "starter" ? "先発" : p.status === "sub" ? "途中出場" : "ベンチ外"}`)
      .join("\n");
    const more = updatedPlayers.length > maxList ? `\n…他${updatedPlayers.length - maxList}名` : "";

    await sendDiscordMessage(
      `✅ スタメン取得成功\nFirestoreに${updatedCount}試合分の出場情報を反映しました。\n\n${playerList}${more}`
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
