import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fetch from "node-fetch";
import * as cheerio from "cheerio";

const webhookUrl = process.env.DISCORD_WEBHOOK_LINEUPS ?? "";
const serviceAccountBase64 = process.env.FIREBASE_ADMIN_BASE64;

if (!serviceAccountBase64) throw new Error("FIREBASE_SERVICE_ACCOUNT が未設定です");
if (!webhookUrl) console.warn("⚠️ DISCORD_WEBHOOK_LINEUPS が未設定です");

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

  return appearances;
};

const updateFirestoreWithAppearances = async (
  appearances: Awaited<ReturnType<typeof extractAppearanceInfo>>
) => {
  //const snapshot = await db
    //.collectionGroup("matches")
    //.where("season.year", ">=", "2024")
    //.get();

  const snapshot = await db.collectionGroup("matches").get(); // ← まずはこれで

  let updatedCount = 0;
  const updatedPlayers: { name: string; status: AppearanceStatus }[] = [];

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const matchday = data.matchday;
    const kickoff = data.utcDate.slice(0, 16);

    const matchRef = doc.ref;
    const homeTeam = data.homeTeam.name;
    const awayTeam = data.awayTeam.name;

    const updates: any = {};

    for (const player of appearances) {
      if (player.matchday !== matchday) continue;
      if (!kickoff.includes(player.kickoff.slice(0, 5))) continue;

      const teamName = [homeTeam, awayTeam].find((t) => player.name.includes(t));
      if (!teamName) continue;

      const side = teamName === homeTeam ? "homeTeam" : "awayTeam";
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
      }
    }

    if (Object.keys(updates).length > 0) {
      await matchRef.update(updates);
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
