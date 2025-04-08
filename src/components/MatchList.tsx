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
  const [sortOption, setSortOption] = useState<'kickoffTime' | 'league' | 'japaneseTeam'>('kickoffTime');
  const [selectedLeagues, setSelectedLeagues] = useState<string[]>(
    Array.from(new Set(matches.map((m) => m.league.jp)))
  );
  const [showCurrent, setShowCurrent] = useState(true);
  const [showPrevious, setShowPrevious] = useState(true);
  const [showNext, setShowNext] = useState(true);
  const [isFetchingLineups, setIsFetchingLineups] = useState(false);
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

  const groupedByLeague = new Map<string, Match[]>();
  matches.forEach((match) => {
    if (!groupedByLeague.has(match.league.jp)) {
      groupedByLeague.set(match.league.jp, []);
    }
    groupedByLeague.get(match.league.jp)!.push(match);
  });

  const leagueMatchdaysToShow = new Set<string>();
  const currentMatchdayMap = new Map<string, number>();

  for (const [league, leagueMatches] of groupedByLeague.entries()) {
    const sortedMatches = [...leagueMatches].sort((a, b) => new Date(a.kickoffTime).getTime() - new Date(b.kickoffTime).getTime());
    const groupedByMatchday = new Map<number, Match[]>();
    sortedMatches.forEach((m) => {
      if (!groupedByMatchday.has(m.matchday)) groupedByMatchday.set(m.matchday, []);
      groupedByMatchday.get(m.matchday)!.push(m);
    });

    const nowTime = now.getTime();
    const twoHours = 2 * 60 * 60 * 1000;
    let currentMatchday: number | undefined;

    for (const [matchday, matchesOfDay] of groupedByMatchday) {
      if (matchesOfDay.some((m) => {
        const kickoff = new Date(m.kickoffTime).getTime();
        return nowTime >= kickoff && nowTime <= kickoff + twoHours;
      })) {
        currentMatchday = matchday;
        break;
      }
    }

    if (currentMatchday === undefined) {
      for (const [matchday, matchesOfDay] of groupedByMatchday) {
        const allFinished = matchesOfDay.every((m) => {
          const kickoff = new Date(m.kickoffTime).getTime();
          return nowTime > kickoff + twoHours;
        });
        if (!allFinished) {
          currentMatchday = matchday;
          break;
        }
      }
    }

    if (currentMatchday === undefined) {
      const allDays = [...groupedByMatchday.keys()].sort((a, b) => b - a);
      currentMatchday = allDays[0];
    }

    currentMatchdayMap.set(league, currentMatchday);

    if (showPrevious) leagueMatchdaysToShow.add(`${league}-${currentMatchday - 1}`);
    if (showCurrent) leagueMatchdaysToShow.add(`${league}-${currentMatchday}`);
    if (showNext) leagueMatchdaysToShow.add(`${league}-${currentMatchday + 1}`);
  }

  const filteredMatches = matches.filter(
    (match) =>
      selectedLeagues.includes(match.league.jp) &&
      leagueMatchdaysToShow.has(`${match.league.jp}-${match.matchday}`)
  );

  const sortedMatches = [...filteredMatches].sort((a, b) => {
    const aKickoff = new Date(a.kickoffTime).getTime();
    const bKickoff = new Date(b.kickoffTime).getTime();
    const aNow = now.getTime();
    const bNow = now.getTime();
    const aInFuture = aKickoff > aNow;
    const bInFuture = bKickoff > bNow;
    if (a.matchday === currentMatchdayMap.get(a.league.jp) && b.matchday === currentMatchdayMap.get(b.league.jp)) {
      if (aInFuture && !bInFuture) return -1;
      if (!aInFuture && bInFuture) return 1;
    }
    return aKickoff - bKickoff;
  });

  const toggleLeague = (league: string) => {
    setSelectedLeagues((prev) =>
      prev.includes(league) ? prev.filter((l) => l !== league) : [...prev, league]
    );
  };

  const toggleAllLeagues = (on: boolean) => {
    if (on) {
      const all = Array.from(new Set(matches.map((m) => m.league.jp)));
      setSelectedLeagues(all);
    } else {
      setSelectedLeagues([]);
    }
  };

  return (
    <div className="w-full p-4">
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <h2 className="text-xl font-bold">試合一覧</h2>
      </div>

      <div className="flex gap-2 flex-wrap mb-4">
        <button onClick={() => toggleAllLeagues(true)} className="px-3 py-1 rounded border bg-green-100 text-green-800">すべてオン</button>
        <button onClick={() => toggleAllLeagues(false)} className="px-3 py-1 rounded border bg-red-100 text-red-800">すべてオフ</button>
        {[...new Set(matches.map((m) => m.league.jp))].map((league) => (
          <button
            key={league}
            onClick={() => toggleLeague(league)}
            className={`px-3 py-1 rounded border ${selectedLeagues.includes(league) ? 'bg-blue-600 text-white' : 'bg-gray-200 text-black'}`}
          >
            {league}
          </button>
        ))}
      </div>

      <div className="flex gap-2 mb-4">
        <button onClick={() => setShowPrevious((prev) => !prev)} className={`px-3 py-1 rounded border ${showPrevious ? 'bg-blue-500 text-white' : 'bg-gray-300'}`}>
          前節
        </button>
        <button onClick={() => setShowCurrent((prev) => !prev)} className={`px-3 py-1 rounded border ${showCurrent ? 'bg-blue-500 text-white' : 'bg-gray-300'}`}>
          今節
        </button>
        <button onClick={() => setShowNext((prev) => !prev)} className={`px-3 py-1 rounded border ${showNext ? 'bg-blue-500 text-white' : 'bg-gray-300'}`}>
          次節
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sortedMatches.map((match) => {
          const kickoff = new Date(match.kickoffTime);
          const currentMatchdayForLeague = currentMatchdayMap.get(match.league.jp);
          const isCurrentMatch = match.matchday === currentMatchdayForLeague;

          const playerText = (players: string[]) =>
            players.length > 0 ? players.map((p) => `🇯🇵 ${p}`).join(' / ') : '';

          const matchStatus = now < kickoff
            ? (isCurrentMatch ? `キックオフまで: ${formatCountdown(kickoff)}` : '')
            : formatMatchTimeStatus(kickoff);

          return (
            <Card key={match.matchId} className="p-4">
              <CardContent>
                <div className="text-sm text-gray-500 mb-1">
                  {match.league.jp}（第{match.matchday}節）
                </div>
                <div className="text-sm text-gray-600 mb-2">
                  {kickoff.toLocaleString('ja-JP', {
                    year: 'numeric', month: '2-digit', day: '2-digit',
                    hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false
                  })}
                  {matchStatus && (
                    <span className="text-blue-600 text-xs ml-2">
                      {matchStatus}
                    </span>
                  )}
                </div>
                <div className="flex justify-between text-center items-center">
                  <div className="w-1/3 flex flex-col items-center">
                    {match.homeTeam.logo && <img src={match.homeTeam.logo} alt="home" className="h-6 w-6 mb-1" />}
                    <div className="font-bold text-lg">{match.homeTeam.name.jp || '未定'}</div>
                    <div className="text-sm text-gray-600">{playerText(match.homeTeam.players)}</div>
                  </div>
                  <div className="text-gray-500 w-1/3">vs</div>
                  <div className="w-1/3 flex flex-col items-center">
                    {match.awayTeam.logo && <img src={match.awayTeam.logo} alt="away" className="h-6 w-6 mb-1" />}
                    <div className="font-bold text-lg">{match.awayTeam.name.jp || '未定'}</div>
                    <div className="text-sm text-gray-600">{playerText(match.awayTeam.players)}</div>
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
