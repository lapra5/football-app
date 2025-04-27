import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { sendDiscordMessage } from "../src/utils/discordNotify.ts";
import { updateTimestamp } from "../src/utils/updateLog.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const base64 = process.env.FIREBASE_PRIVATE_KEY_JSON_BASE64;
if (!base64) throw new Error("❌ FIREBASE_PRIVATE_KEY_JSON_BASE64 が設定されていません。");

const serviceAccount = JSON.parse(Buffer.from(base64, "base64").toString());
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const publicUpdatedLogPath = path.resolve("public/updated_log.json");

const LEAGUE_IDS = [
  "2001", "2002", "2003", "2013", "2014",
  "2015", "2016", "2017", "2019", "2021"
];

const main = async () => {
  try {
    let updatedCount = 0;

    for (const leagueId of LEAGUE_IDS) {
      const ref = db.collection("leagues").doc(leagueId);
      const doc = await ref.get();
      const data = doc.data();
      if (!data) continue;

      const newData = {
        ...data,
        matchday: {
          previous: data.matchday?.previous ?? 0,
          current: data.matchday?.current ?? 0,
          next: data.matchday?.next ?? 0,
        }
      };

      await ref.set(newData, { merge: true });
      updatedCount++;
    }

    console.log("🔍 Webhook URL:", process.env.DISCORD_WEBHOOK_MATCHDAY);
    console.log(`✅ マッチデイ情報を ${updatedCount} リーグ分更新しました`);

    await sendDiscordMessage(
      `✅ マッチデイステータスを更新しました（全${updatedCount}リーグ）`,
      process.env.DISCORD_WEBHOOK_MATCHDAY as string
    );

    // 🔥 updated_log.json を更新＋publicにもコピー
    updateTimestamp("updateMatchdayStatus");
    const updatedLogData = fs.readFileSync("src/data/updated_log.json", "utf-8");
    fs.writeFileSync(publicUpdatedLogPath, updatedLogData, "utf-8");

  } catch (err) {
    console.error("❌ エラー:", err);
    await sendDiscordMessage(
      `❌ マッチデイ更新エラー: ${err instanceof Error ? err.message : String(err)}`,
      process.env.DISCORD_WEBHOOK_MATCHDAY!
    );
    process.exit(1);
  }
};

main();
