// proxy.js (for Next.js API routes)
import fetch from 'node-fetch';

export default async function handler(req, res) {
  try {
    // 本物のURL（でも絶対にユーザーに見せない）
    const REAL_URL = 'https://novatrail.vercel.app';

    // 本物URLにリクエスト送る
    const response = await fetch(REAL_URL, {
      method: req.method,
      headers: {
        // 必要ならリクエストヘッダーも中継
        ...req.headers,
        host: undefined, // hostヘッダーだけは消す（重要）
      },
      body: req.method === 'GET' ? undefined : req.body,
    });

    // 本物サーバーからきたレスポンスをそのまま返す
    const data = await response.text(); // ここを .json() にしてもよい
    res.status(response.status).send(data);

  } catch (error) {
    console.error('Proxy Error:', error);
    res.status(500).json({ error: 'Proxy server error' });
  }
}
