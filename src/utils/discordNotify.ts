export const sendDiscordMessage = async (
  message: string,
  type: 'matches' | 'matchday' | 'lineups' | 'scores' = 'matches'
) => {
  const webhookMap = {
    matches: process.env.DISCORD_WEBHOOK_MATCHES,
    matchday: process.env.DISCORD_WEBHOOK_MATCHDAY,
    lineups: process.env.DISCORD_WEBHOOK_LINEUPS,
    scores: process.env.DISCORD_WEBHOOK_SCORES,
  };

  const url = webhookMap[type];
  if (!url) {
    console.warn(`⚠️ Webhook URL for ${type} is not defined.`);
    return;
  }

  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: message }),
    });
    console.log(`✅ Discord通知送信成功（${type}）`);
  } catch (error) {
    console.error(`❌ Discord通知送信失敗（${type}）`, error);
  }
};
