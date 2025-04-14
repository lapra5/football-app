import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { sendDiscordMessage } from '../src/utils/discordNotify.ts';
import { updateTimestamp } from "../src/utils/updateLog.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const targetPath = path.resolve(__dirname, '../src/data/current_month_matches.json');

const API_BASE_URL = 'https://api.football-data.org/v4/matches';
const API_KEY = process.env.FOOTBALL_DATA_API_KEY;
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK_LINEUPS || "";

if (!API_KEY) throw new Error('❌ FOOTBALL_DATA_API_KEY が設定されていません');

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchLineupForMatch = async (matchId: string) => {
  const url = `${API_BASE_URL}/${matchId}`;
  const res = await fetch(url, {
    headers: { 'X-Auth-Token': API_KEY },
  });
  if (!res.ok) throw new Error(`❌ ${matchId} の取得に失敗: ${res.status}`);
  const data = await res.json();
  return data;
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

          match.lineupStatus = '取得済み';
          match.startingMembers = detail.match?.homeTeam?.lineup || [];
          match.substitutes = detail.match?.homeTeam?.substitutes || [];
          match.outOfSquad = detail.match?.homeTeam?.outOfSquad || [];

          return match;
        })
      );

      console.log(`✅ ${results.length}件処理済み (${i + 1}〜${i + group.length})`);

      if (i + 9 < targets.length) await delay(3000);
    }

    fs.writeFileSync(targetPath, JSON.stringify(matches, null, 2), 'utf-8');
    console.log('📝 current_month_matches.json を更新しました');
    updateTimestamp("updateCurrentMonthMatch"); // ← 追加！

    await sendDiscordMessage(`✅ スタメンデータを ${targets.length} 件更新しました`, DISCORD_WEBHOOK);
  } catch (err) {
    console.error('❌ エラー:', err);
    await sendDiscordMessage(`❌ スタメン取得中にエラー発生: ${err instanceof Error ? err.message : String(err)}`, DISCORD_WEBHOOK);
  }
};

main();
