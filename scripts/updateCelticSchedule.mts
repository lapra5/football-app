// scripts/updateCelticSchedule.mts
import puppeteer, { Page } from "puppeteer";
import * as cheerio from "cheerio";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { sendDiscordMessage } from "../src/utils/discordNotify.ts";
import dotenv from "dotenv";
import { updateTimestamp } from "../src/utils/updateLog.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const serviceAccount = JSON.parse(
  Buffer.from(process.env.FIREBASE_PRIVATE_KEY_JSON_BASE64!, "base64").toString()
);
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// 🚦 saison_id の自動判定（7月以前は前年のID）
const today = new Date();
const year = today.getMonth() + 1 <= 6 ? today.getFullYear() - 1 : today.getFullYear();
const saisonId = year;
const URL = `https://www.transfermarkt.jp/serutikkufc/spielplan/verein/371/plus/0?saison_id=${saisonId}`;
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

const getSeasonLabel = () => `${saisonId}-${saisonId + 1}`;

const main = async () => {
  try {
    console.log("🚀 セルティック日程取得開始");

    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();
    await page.setUserAgent("Mozilla/5.0");
    await page.goto(URL, { waitUntil: "load", timeout: 60000 });

    const popupSelector = "#onetrust-accept-btn-handler";
    const popupFound = await page.waitForSelector(popupSelector, { timeout: 10000 }).catch(() => null);
    if (popupFound) await page.click(popupSelector);

    await autoScroll(page);
    await new Promise((r) => setTimeout(r, 8000));

    const html = await page.content();
    const $ = cheerio.load(html);
    const rows = $("table tbody tr");

    if (rows.length === 0) {
      throw new Error("❌ tr 要素が空です。HTML構造が変更された可能性があります。");
    }

    const matches: any[] = [];

    rows.each((_, el) => {
      const cols = $(el).find("td");
      if (cols.length < 10) return;

      const matchdayText = $(cols[0]).text().trim();
      const matchday = parseInt(matchdayText, 10) || 0;

      const dateStr = $(cols[1]).text().trim().replace(/[年月]/g, "/").replace("日", "");
      const timeStr = $(cols[2]).text().trim().replace("：", ":");
      const opponent = $(cols[6]).text().trim().replace(/\(.*?\)/g, "").trim();
      const scoreText = $(cols[9]).text().trim().replace(/\s/g, "");

      if (!dateStr || !timeStr || !opponent) return;

      const kickoff = new Date(`${dateStr} ${timeStr}:00 GMT+0900`);
      if (isNaN(kickoff.getTime())) return;

      let fullTimeHome: number | null = null;
      let fullTimeAway: number | null = null;
      let winner: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null = null;

      const scoreMatch = scoreText.match(/(\d+):(\d+)/);
      if (scoreMatch) {
        fullTimeHome = parseInt(scoreMatch[1], 10);
        fullTimeAway = parseInt(scoreMatch[2], 10);

        if (!isNaN(fullTimeHome) && !isNaN(fullTimeAway)) {
          if (fullTimeHome > fullTimeAway) winner = "HOME_TEAM";
          else if (fullTimeHome < fullTimeAway) winner = "AWAY_TEAM";
          else winner = "DRAW";
        }
      }

      const status = (fullTimeHome !== null && fullTimeAway !== null) ? "FINISHED" : "SCHEDULED";

      matches.push({
        matchId: `CELTIC_${kickoff.toISOString()}_vs_${opponent}`,
        utcDate: kickoff.toISOString(),
        matchday,
        league: "スコットランド",
        season: {
          startDate: `${saisonId}-07-01`,
          endDate: `${saisonId + 1}-06-30`,
          currentMatchday: matchday
        },
        status,
        score: {
          winner,
          duration: "REGULAR",
          fullTime: { home: fullTimeHome, away: fullTimeAway },
          halfTime: { home: null, away: null }
        },
        homeTeam: {
          id: null,
          name: "セルティックFC",
          crest: "",
          shortName: "セルティック",
          tla: "CEL"
        },
        awayTeam: {
          id: null,
          name: opponent,
          crest: "",
          shortName: opponent,
          tla: ""
        },
        area: {
          id: 2072,
          name: "Scotland",
          code: "SCO",
          flag: ""
        },
        competition: {
          id: 9000,
          name: "スコティッシュ・プレミアシップ",
          code: "SPL",
          type: "LEAGUE",
          emblem: ""
        },
        lineupStatus: "未発表"
      });
    });

    await browser.close();

    const seasonLabel = getSeasonLabel();
    const ref = db.collection("leagues").doc("celtic").collection("seasons").doc(seasonLabel).collection("matches");
    const batch = db.batch();
    matches.forEach((match) => {
      batch.set(ref.doc(match.matchId), match, { merge: true });
    });
    await batch.commit();

    const outputPath = path.resolve(__dirname, "../src/data/current_month_matches_celtic.json");
    fs.writeFileSync(outputPath, JSON.stringify(matches, null, 2), "utf-8");

    console.log(`✅ ${matches.length} 件のセルティック試合を保存しました`);
    updateTimestamp("updateCelticSchedule");

    await sendDiscordMessage(
      `✅ セルティック試合 ${matches.length} 件を Firestore に保存しました`,
      webhookUrl!
    );
  } catch (err) {
    console.error("❌ エラー:", err);
    await sendDiscordMessage(
      `❌ セルティック日程取得エラー: ${(err as Error).message}`,
      webhookUrl!
    );
    process.exit(1);
  }
};

main();
