'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Match } from '@/types/match';

interface TeamInfo {
  teamId: number;
  team: string;
  englishName: string;
  players: string[];
  logo: string;
}

interface TeamLeagueNames {
  teams: TeamInfo[];
  leagues: { en: string; jp: string }[];
}

interface MatchListProps {
  matches: Match[];
  onFetchLineups: () => Promise<void>;
  lineupUpdateResults: { matchId: string; message: string }[];
  teamLeagueNames: TeamLeagueNames;
}

const MatchList = ({
  matches,
  onFetchLineups,
  lineupUpdateResults,
  teamLeagueNames,
}: MatchListProps) => {
  const [selectedLeagues, setSelectedLeagues] = useState<string[]>(Array.from(new Set(matches.map((m) => m.league.jp))));
  const [showCurrent, setShowCurrent] = useState(true);
  const [showPrevious, setShowPrevious] = useState(true);
  const [showNext, setShowNext] = useState(true);
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatCountdown = (kickoff: Date) => {
    const diff = kickoff.getTime() - now.getTime();
    if (diff <= 0) return '';
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${days}日 ${hours}時間 ${minutes}分`;
  };

  const formatMatchTimeStatus = (kickoff: Date) => {
    const elapsed = now.getTime() - kickoff.getTime();
    if (elapsed < 0) return '';
    const minutes = Math.floor(elapsed / (1000 * 60));
    if (minutes < 47) return `前半:${Math.min(minutes, 45)}分`;
    if (minutes >= 47 && minutes < 62) return 'ハーフタイム';
    const secondHalfMinutes = minutes - 62 + 1;
    if (secondHalfMinutes <= 45) return `後半:${secondHalfMinutes}分`;
    return '（試合終了）';
  };

  const leagueMatchdaysToShow = new Set<string>();
  const currentMatchdayMap = new Map<string, number>();

  const groupedByLeague = new Map<string, Match[]>();
  matches.forEach((match) => {
    if (!groupedByLeague.has(match.league.jp)) {
      groupedByLeague.set(match.league.jp, []);
    }
    groupedByLeague.get(match.league.jp)!.push(match);
  });

  const nowStart = new Date(now);
  nowStart.setDate(nowStart.getDate() - nowStart.getDay() + 1);
  nowStart.setHours(0, 0, 0, 0);
  const nowEnd = new Date(nowStart);
  nowEnd.setDate(nowStart.getDate() + 6);
  nowEnd.setHours(23, 59, 59, 999);

  const nextWeekStart = new Date(nowEnd);
  nextWeekStart.setDate(nextWeekStart.getDate() + 1);
  nextWeekStart.setHours(0, 0, 0, 0);
  const nextWeekEnd = new Date(nextWeekStart);
  nextWeekEnd.setDate(nextWeekStart.getDate() + 6);
  nextWeekEnd.setHours(23, 59, 59, 999);

  for (const [league, leagueMatches] of groupedByLeague.entries()) {
    const isCup = league === "Jリーグカップ";
    if (isCup) {
      for (const match of leagueMatches) {
        const kickoff = new Date(match.kickoffTime);
        const key = `${league}-${match.matchId}`;
        if (showCurrent && kickoff >= nowStart && kickoff <= nowEnd) leagueMatchdaysToShow.add(key);
        else if (showPrevious && kickoff < nowStart) leagueMatchdaysToShow.add(key);
        else if (showNext && kickoff >= nextWeekStart) leagueMatchdaysToShow.add(key);
      }
    } else {
      const groupedByMatchday = new Map<number, Match[]>();
      leagueMatches.forEach((m) => {
        if (!groupedByMatchday.has(m.matchday)) groupedByMatchday.set(m.matchday, []);
        groupedByMatchday.get(m.matchday)!.push(m);
      });

      const matchdayCenters = Array.from(groupedByMatchday.entries()).map(([md, games]) => ({
        matchday: md,
        center: games.map((m) => new Date(m.kickoffTime).getTime()).sort((a, b) => a - b)[Math.floor(games.length / 2)],
      }));

      matchdayCenters.sort((a, b) => Math.abs(a.center - now.getTime()) - Math.abs(b.center - now.getTime()));
      const currentMatchday = matchdayCenters[0]?.matchday;
      currentMatchdayMap.set(league, currentMatchday);

      if (showPrevious) leagueMatchdaysToShow.add(`${league}-${currentMatchday - 1}`);
      if (showCurrent) leagueMatchdaysToShow.add(`${league}-${currentMatchday}`);
      if (showNext) leagueMatchdaysToShow.add(`${league}-${currentMatchday + 1}`);
    }
  }

  const filteredMatches = matches.filter((match) => {
    const key = match.matchday === 0 && match.league.jp === "Jリーグカップ"
      ? `${match.league.jp}-${match.matchId}`
      : `${match.league.jp}-${match.matchday}`;
    return selectedLeagues.includes(match.league.jp) && leagueMatchdaysToShow.has(key);
  });

  const sortedMatches = [...filteredMatches].sort((a, b) => new Date(a.kickoffTime).getTime() - new Date(b.kickoffTime).getTime());

  const toggleLeague = (league: string) => {
    setSelectedLeagues((prev) =>
      prev.includes(league) ? prev.filter((l) => l !== league) : [...prev, league]
    );
  };

  const toggleAllLeagues = (on: boolean) => {
    setSelectedLeagues(on ? Array.from(new Set(matches.map((m) => m.league.jp))) : []);
  };

  const getPlayerStatus = (player: string, homePlayers: string[], awayPlayers: string[]): string => {
    if (homePlayers?.includes(player)) return 'スタメン';
    if (awayPlayers?.includes(player)) return 'スタメン';
    return '';
  };

  const getJapanesePlayerStatusText = (team: any, side: 'home' | 'away', match: Match) => {
    const players = team.players || [];
    const starters = (match.startingMembers as any)?.[side] ?? [];
    const subs = (match.substitutes as any)?.[side] ?? [];
    const outs = (match.outOfSquad as any)?.[side] ?? [];

    return players.map((name: string) => {
      const status = starters.includes(name)
        ? 'スタメン'
        : subs.includes(name)
        ? 'ベンチ'
        : outs.includes(name)
        ? 'ベンチ外'
        : '';
      return `🇯🇵 ${name}：${status}`;
    }).join(' / ');
  };

  return (
    <div className="w-full p-4">
      <div className="flex gap-2 mb-4 items-center flex-wrap">
        <span className="font-bold">表示設定:</span>
        <button onClick={() => setShowPrevious(!showPrevious)} className={`w-24 text-center px-3 py-1 rounded border ${showPrevious ? 'bg-blue-500 text-white' : 'bg-gray-300'}`}>前節</button>
        <button onClick={() => setShowCurrent(!showCurrent)} className={`w-24 text-center px-3 py-1 rounded border ${showCurrent ? 'bg-blue-500 text-white' : 'bg-gray-300'}`}>今節</button>
        <button onClick={() => setShowNext(!showNext)} className={`w-24 text-center px-3 py-1 rounded border ${showNext ? 'bg-blue-500 text-white' : 'bg-gray-300'}`}>次節</button>
        <button onClick={() => toggleAllLeagues(true)} className="w-24 text-center px-3 py-1 rounded border bg-green-100 text-green-800">すべてオン</button>
        <button onClick={() => toggleAllLeagues(false)} className="w-24 text-center px-3 py-1 rounded border bg-red-100 text-red-800">すべてオフ</button>
      </div>

      <div className="flex gap-2 flex-wrap mb-4">
        {Array.from(new Set(matches.map((m) => m.league.jp))).map((league) => (
          <button
            key={league}
            onClick={() => toggleLeague(league)}
            className={`w-36 text-center px-3 py-1 rounded border ${selectedLeagues.includes(league) ? 'bg-blue-600 text-white' : 'bg-gray-200 text-black'}`}
          >
            {league}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sortedMatches.map((match) => {
          const kickoff = new Date(match.kickoffTime);
          const matchStatus = now < kickoff ? `キックオフまで: ${formatCountdown(kickoff)}` : formatMatchTimeStatus(kickoff);
          const fullTimeHome = match.score?.fullTime?.home;
          const fullTimeAway = match.score?.fullTime?.away;
          const pkHome = match.score?.halfTime?.home;
          const pkAway = match.score?.halfTime?.away;
          const isScored = Number.isFinite(fullTimeHome) && Number.isFinite(fullTimeAway);
          const isPk = match.league.jp === "Jリーグカップ" && Number.isFinite(pkHome) && Number.isFinite(pkAway);

          return (
            <Card key={match.matchId} className="p-4">
              <CardContent>
                <div className="text-sm text-gray-500 mb-1">
                  {match.league.jp}（第{match.matchday}節）
                </div>
                <div className="text-sm text-gray-600 mb-2">
                  {kickoff.toLocaleString("ja-JP", {
                    year: "numeric", month: "2-digit", day: "2-digit",
                    hour: "2-digit", minute: "2-digit", weekday: "short", hour12: false
                  })}
                  {matchStatus && <span className="text-blue-600 text-xs ml-2">{matchStatus}</span>}
                </div>

                <div className="flex justify-between items-center text-center">
                  {/* ホームチーム */}
                  <div className="w-1/3 flex flex-col items-center">
                    <div className="flex items-center justify-center gap-2">
                      {match.homeTeam.logo && <img src={match.homeTeam.logo} alt="home" className="h-6 w-6" />}
                      <div className="font-bold text-lg whitespace-nowrap overflow-hidden text-ellipsis">
                        {match.homeTeam.name.jp || '未定'}
                      </div>
                    </div>
                    <div className="text-xs text-gray-600 text-center mt-1">
                      {getJapanesePlayerStatusText(match.homeTeam, 'home', match)}
                    </div>
                  </div>

                  {/* スコア or vs */}
                  <div className="text-gray-500 w-1/3 text-sm text-center">
                    {isScored ? (
                      <>
                        {fullTimeHome} - {fullTimeAway}
                        {isPk && <div className="text-xs text-gray-600">(PK {pkHome}-{pkAway})</div>}
                      </>
                    ) : "vs"}
                  </div>

                  {/* アウェイチーム */}
                  <div className="w-1/3 flex flex-col items-center">
                    <div className="flex items-center justify-center gap-2">
                      {match.awayTeam.logo && <img src={match.awayTeam.logo} alt="away" className="h-6 w-6" />}
                      <div className="font-bold text-lg whitespace-nowrap overflow-hidden text-ellipsis">
                        {match.awayTeam.name.jp || '未定'}
                      </div>
                    </div>
                    <div className="text-xs text-gray-600 text-center mt-1">
                      {getJapanesePlayerStatusText(match.awayTeam, 'away', match)}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default MatchList;
