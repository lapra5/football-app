import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { sendDiscordMessage } from "../src/utils/discordNotify.ts";
import { updateTimestamp } from "../src/utils/updateLog.ts";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// 🔧 初期化
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const API_BASE_URL = "https://api.football-data.org/v4/matches";
const API_KEY = process.env.FOOTBALL_DATA_API_KEY;
const FIREBASE_KEY = process.env.FIREBASE_PRIVATE_KEY_JSON_BASE64;
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK_SCORES;

if (!API_KEY) throw new Error("❌ FOOTBALL_DATA_API_KEY が設定されていません");
if (!FIREBASE_KEY) throw new Error("❌ FIREBASE_PRIVATE_KEY_JSON_BASE64 が設定されていません");
if (!DISCORD_WEBHOOK) throw new Error("❌ DISCORD_WEBHOOK_SCORES が設定されていません");

// 🧠 Firebase 初期化
const serviceAccount = JSON.parse(Buffer.from(FIREBASE_KEY, "base64").toString());
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const targetPath = path.resolve(__dirname, "../src/data/current_month_matches.json");
const publicMatchesPath = path.resolve(__dirname, "../public/current_month_matches.json");
const publicUpdatedLogPath = path.resolve(__dirname, "../public/updated_log.json");

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

const fetchScore = async (matchId: string) => {
  const url = `${API_BASE_URL}/${matchId}`;
  const res = await fetch(url, { headers: { "X-Auth-Token": API_KEY } });
  if (!res.ok) throw new Error(`❌ ${matchId} のスコア取得失敗: ${res.status}`);
  return await res.json();
};

const main = async () => {
  try {
    const json = fs.readFileSync(targetPath, "utf-8");
    const matches = JSON.parse(json);

    const now = new Date();
    const targets = matches.filter((match: any) => {
      const kickoff = new Date(match.kickoffTime);
      const diff = now.getTime() - kickoff.getTime();
      return diff > 2 * 60 * 60 * 1000 && !match.score?.fullTime?.home;
    });

    console.log(`🎯 スコア取得対象: ${targets.length}件`);

    let updatedCount = 0;

    for (let i = 0; i < targets.length; i += 10) {
      const group = targets.slice(i, i + 10);

      const results = await Promise.allSettled(
        group.map(async (match) => {
          const detail = await fetchScore(match.matchId);
          const score = detail.score;
          if (!score || !score.fullTime) throw new Error(`score 情報が不正`);

          const updated = { ...match, score };

          // ここでシーズン（年）を設定
          const matchDate = new Date(match.utcDate);
          const seasonYear = matchDate.getFullYear();

          // Firestoreの保存先を leauges/{leagueId}/seasons/{seasonYear}/matches/{matchId} に変更
          const leagueId = match.matchId.split("_")[0];
          const docRef = db
            .collection("leagues")
            .doc(leagueId.toString())  // リーグID
            .collection("seasons")
            .doc(seasonYear.toString())  // シーズン（年）
            .collection("matches")
            .doc(match.matchId.toString());  // 試合IDでドキュメントを識別

          await docRef.set(updated, { merge: true });

          updatedCount++;
        })
      );

      if (i + 10 < targets.length) await delay(2000);
    }

    // 🔥 updated_log.json更新
    updateTimestamp("fetchScores");

    // 🔥 src/data/current_month_matches.json を public にコピー
    fs.copyFileSync(targetPath, publicMatchesPath);

    // 🔥 src/data/updated_log.json を public にコピー
    const updatedLogData = fs.readFileSync(path.resolve(__dirname, "../src/data/updated_log.json"), "utf-8");
    fs.writeFileSync(publicUpdatedLogPath, updatedLogData, "utf-8");

    await sendDiscordMessage(`✅ スコア情報を ${updatedCount} 件更新しました（Firestore書き込みのみ）`, DISCORD_WEBHOOK);
    console.log(`✅ Firestore に ${updatedCount} 件のスコア情報を書き込みました`);
  } catch (err) {
    console.error("❌ エラー:", err);
    await sendDiscordMessage(
      `❌ スコア取得エラー: ${err instanceof Error ? err.message : String(err)}`,
      DISCORD_WEBHOOK
    );
    process.exit(1);
  }
};

main();
