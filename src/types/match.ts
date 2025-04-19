export interface Match {
  matchId: string;
  league: {
    en: string;
    jp: string;
  };
  kickoffTime: string;
  matchday: number;
  homeTeam: {
    id: number;
    name: {
      en: string;
      jp: string;
    };
    logo: string;
    players: string[];
    englishplayers: string[];
  };
  awayTeam: {
    id: number;
    name: {
      en: string;
      jp: string;
    };
    logo: string;
    players: string[];
    englishplayers: string[];
  };
  lineupStatus: string;
  score: {
    winner: string | null;
    duration: string;
    fullTime: {
      home: number | null;
      away: number | null;
    };
    halfTime: {
      home: number | null;
      away: number | null;
    };
  };

  // 🔽 スタメン・サブ・ベンチ外（home/away対応 + 旧形式との互換も確保）
  startingMembers?: {
    home?: string[];
    away?: string[];
  } | string[];

  substitutes?: {
    home?: string[];
    away?: string[];
  } | string[];

  outOfSquad?: {
    home?: string[];
    away?: string[];
  } | string[];
}
