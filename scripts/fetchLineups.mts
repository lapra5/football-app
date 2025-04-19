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

const serviceAccount = JSON.parse(Buffer.from(FIREBASE_KEY, 'base64').toString());
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const getSeasonYear = (date: Date): string => {
  const year = date.getFullYear();
  return date.getMonth() >= 6 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
};

const fetchLineupForMatch = async (matchId: string) => {
  const url = `${API_BASE_URL}/${matchId}`;
  const res = await fetch(url, { headers: { 'X-Auth-Token': API_KEY } });
  if (!res.ok) throw new Error(`❌ ${matchId} の取得に失敗: ${res.status}`);
  return await res.json();
};

// 📌 リーグ名 → ID のマップを作成
const leagueMapRaw = fs.readFileSync(path.resolve(__dirname, '../src/data/team_league_names.json'), 'utf-8');
const leagueMapJson = JSON.parse(leagueMapRaw);
const leagueNameToId: Record<string, string> = Object.fromEntries(
  (leagueMapJson.leagues || []).map((l: any) => [l.jp, String(l.leaguesId)])
);

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
    let updatedCount = 0;

    for (let i = 0; i < targets.length; i += 9) {
      const group = targets.slice(i, i + 9);

      const results = await Promise.allSettled(
        group.map(async (match) => {
          const detail = await fetchLineupForMatch(match.matchId);

          const homePlayers = detail.match?.homeTeam?.lineup?.map((p: any) => p.name) || [];
          const awayPlayers = detail.match?.awayTeam?.lineup?.map((p: any) => p.name) || [];
          const homeSubs = detail.match?.homeTeam?.substitutes?.map((p: any) => p.name) || [];
          const awaySubs = detail.match?.awayTeam?.substitutes?.map((p: any) => p.name) || [];
          const homeOut = detail.match?.homeTeam?.outOfSquad?.map((p: any) => p.name) || [];
          const awayOut = detail.match?.awayTeam?.outOfSquad?.map((p: any) => p.name) || [];

          const season = getSeasonYear(new Date(match.kickoffTime));
          const leagueId = leagueNameToId[match.league.jp];
          if (!leagueId) throw new Error(`❌ ${match.league.jp} の leagueId が見つかりません`);

          const docRef = db
            .collection('leagues')
            .doc(leagueId)
            .collection('seasons')
            .doc(season)
            .collection('matches')
            .doc(match.matchId);

          await docRef.set(
            {
              lineupStatus: '取得済み',
              startingMembers: { home: homePlayers, away: awayPlayers },
              substitutes: { home: homeSubs, away: awaySubs },
              outOfSquad: { home: homeOut, away: awayOut },
            },
            { merge: true }
          );

          updatedCount++;
        })
      );

      console.log(`✅ ${results.length}件処理済み (${i + 1}〜${i + group.length})`);
      if (i + 9 < targets.length) await delay(3000);
    }

    updateTimestamp('fetchLineups');
    await sendDiscordMessage(`✅ スタメンデータを ${updatedCount} 件更新しました（Firestore書き込み）`, DISCORD_WEBHOOK);
  } catch (err) {
    console.error('❌ エラー:', err);
    await sendDiscordMessage(
      `❌ スタメン取得中にエラー発生: ${err instanceof Error ? err.message : String(err)}`,
      DISCORD_WEBHOOK
    );
  }
};

main();
