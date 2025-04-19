// scripts/updateCelticSchedule.mts
import puppeteer, { Page } from "puppeteer";
import * as cheerio from "cheerio";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import dotenv from "dotenv";
import { sendDiscordMessage } from "../src/utils/discordNotify.ts";
import { updateTimestamp } from "../src/utils/updateLog.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const serviceAccount = JSON.parse(
  Buffer.from(process.env.FIREBASE_PRIVATE_KEY_JSON_BASE64!, "base64").toString()
);
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const getSeasonYear = (): string => {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  return m >= 7 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
};

const URL = "https://www.transfermarkt.jp/serutikkufc/spielplan/verein/371/plus/0?saison_id=2024";
const webhookUrl = process.env.DISCORD_WEBHOOK_CELTIC;

async function autoScroll(page: Page) {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      let totalHeight = 0;
      const distance = 300;
      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= document.body.scrollHeight - window.innerHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 300);
    });
  });
}

const main = async () => {
  try {
    console.log("🚀 セルティック日程取得開始");

    const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
    const page = await browser.newPage();
    await page.setUserAgent("Mozilla/5.0");
    await page.goto(URL, { waitUntil: "load", timeout: 60000 });

    const popup = await page.waitForSelector("#onetrust-accept-btn-handler", { timeout: 10000 }).catch(() => null);
    if (popup) await popup.click();
    await autoScroll(page);
    await new Promise((r) => setTimeout(r, 8000));

    const html = await page.content();
    const $ = cheerio.load(html);
    const rows = $("table tbody tr");
    if (rows.length === 0) throw new Error("❌ tr 要素が空です。HTML構造が変更された可能性があります。");

    const matches: any[] = [];
    rows.each((_, el) => {
      const cols = $(el).find("td");
      if (cols.length < 8) return;

      const matchdayRaw = $(cols[0]).text().trim();
      const matchday = parseInt(matchdayRaw.replace(/\D/g, ""), 10) || 0;
      const rawDate = $(cols[3]).text().trim().replace(/[^\d/]/g, "");
      const timeStr = $(cols[4]).text().trim();
      const homeTeam = $(cols[5]).text().trim();
      const scoreText = $(cols[6]).text().trim();
      const awayTeam = $(cols[7]).text().trim();

      if (!rawDate || !timeStr || !homeTeam || !awayTeam) return;

      const kickoff = new Date(`2025/${rawDate} ${timeStr}:00 GMT+0900`);
      if (isNaN(kickoff.getTime())) return;

      const [ftHomeStr, ftAwayStr] = scoreText.split("-").map((v) => parseInt(v));
      const fullTime = !isNaN(ftHomeStr) && !isNaN(ftAwayStr)
        ? { home: ftHomeStr, away: ftAwayStr }
        : { home: null, away: null };

      let winner: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null = null;
      if (fullTime.home !== null && fullTime.away !== null) {
        if (fullTime.home > fullTime.away) winner = "HOME_TEAM";
        else if (fullTime.home < fullTime.away) winner = "AWAY_TEAM";
        else winner = "DRAW";
      }

      matches.push({
        matchId: `CELTIC_${kickoff.toISOString()}_vs_${awayTeam}`,
        kickoffTime: kickoff.toISOString(),
        matchday,
        league: "スコットランド",
        homeTeam: { name: homeTeam, id: null, players: [] },
        awayTeam: { name: awayTeam, id: null, players: [] },
        lineupStatus: "未発表",
        score: {
          winner,
          duration: "REGULAR",
          fullTime,
          halfTime: { home: null, away: null },
        },
        startingMembers: [],
        substitutes: [],
        outOfSquad: [],
      });
    });

    await browser.close();

    const season = getSeasonYear();
    const batch = db.batch();
    matches.forEach((match) => {
      const ref = db.collection("leagues").doc("celtic").collection("seasons").doc(season).collection("matches").doc(match.matchId);
      batch.set(ref, match, { merge: true });
    });
    await batch.commit();

    fs.writeFileSync(path.resolve(__dirname, "../src/data/current_month_matches_celtic.json"), JSON.stringify(matches, null, 2), "utf-8");
    updateTimestamp("updateCelticSchedule");

    await sendDiscordMessage(`✅ セルティック試合 ${matches.length} 件を更新しました`, webhookUrl!);
    console.log(`✅ Firestore & JSON へ保存完了: ${matches.length} 件`);
  } catch (err) {
    console.error("❌ エラー:", err);
    await sendDiscordMessage(`❌ セルティック日程取得エラー: ${(err as Error).message}`, webhookUrl!);
    process.exit(1);
  }
};

main();
