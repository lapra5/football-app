import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { sendDiscordMessage } from '../src/utils/discordNotify.ts';
import { updateTimestamp } from '../src/utils/updateLog.ts';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const targetPath = path.resolve(__dirname, '../src/data/current_month_matches.json');
const API_BASE_URL = 'https://api.football-data.org/v4/matches';
const API_KEY = process.env.FOOTBALL_DATA_API_KEY;
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK_LINEUPS || '';
const FIREBASE_KEY = process.env.FIREBASE_PRIVATE_KEY_JSON_BASE64;

if (!API_KEY) throw new Error('❌ FOOTBALL_DATA_API_KEY が設定されていません');
if (!FIREBASE_KEY) throw new Error('❌ FIREBASE_PRIVATE_KEY_JSON_BASE64 が設定されていません');

// Firebase 初期化
const serviceAccount = JSON.parse(Buffer.from(FIREBASE_KEY, 'base64').toString());
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchLineupForMatch = async (matchId: string) => {
  const url = `${API_BASE_URL}/${matchId}`;
  const res = await fetch(url, {
    headers: { 'X-Auth-Token': API_KEY },
  });
  if (!res.ok) throw new Error(`❌ ${matchId} の取得に失敗: ${res.status}`);
  return await res.json();
};

const main = async () => {
  try {
    const json = fs.readFileSync(targetPath, 'utf-8');
    const matches = JSON.parse(json);

    const now = new Date();
    const targets = matches.filter((match: any) => {
      const kickoff = new Date(match.kickoffTime);
      const diffMinutes = Math.floor((kickoff.getTime() - now.getTime()) / 60000);
      return [90, 60, 30].some((target) => Math.abs(diffMinutes - target) <= 1);
    });

    console.log(`🎯 対象試合数: ${targets.length}`);

    for (let i = 0; i < targets.length; i += 9) {
      const group = targets.slice(i, i + 9);

      const results = await Promise.allSettled(
        group.map(async (match) => {
          const detail = await fetchLineupForMatch(match.matchId);

          const updated = {
            ...match,
            lineupStatus: '取得済み',
            startingMembers: detail.match?.homeTeam?.lineup || [],
            substitutes: detail.match?.homeTeam?.substitutes || [],
            outOfSquad: detail.match?.homeTeam?.outOfSquad || [],
          };

          const leagueId = match.matchId.split('_')[0]; // 例: "2001" or "J1"
          const docRef = db.collection('leagues').doc(leagueId).collection('matches').doc(match.matchId);
          await docRef.set(updated, { merge: true });

          return updated;
        })
      );

      console.log(`✅ ${results.length}件処理済み (${i + 1}〜${i + group.length})`);
      if (i + 9 < targets.length) await delay(3000);
    }

    updateTimestamp('fetchLineups');
    await sendDiscordMessage(`✅ スタメンデータを ${targets.length} 件更新しました（Firestore書き込みのみ）`, DISCORD_WEBHOOK);
  } catch (err) {
    console.error('❌ エラー:', err);
    await sendDiscordMessage(
      `❌ スタメン取得中にエラー発生: ${err instanceof Error ? err.message : String(err)}`,
      DISCORD_WEBHOOK
    );
  }
};

main();
