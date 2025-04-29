import { NextResponse } from 'next/server';
import crypto from 'crypto';

export const runtime = 'nodejs';

const SECRET_KEY = process.env.SECRET_KEY;
const targetUrl = 'https://novatrail.vercel.app';

// 32バイトキー + 16バイトIVが必要
const key = crypto.createHash('sha256').update(String(SECRET_KEY)).digest('base64').substr(0, 32);
const iv = Buffer.alloc(16, 0); // 固定IVでも今回は可（必要ならランダムにしてもよい）

function encryptUrl(url) {
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(url, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  return encrypted;
}

function decryptUrl(encryptedUrl) {
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encryptedUrl, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const encryptedUrl = searchParams.get('encryptedUrl');

    if (!encryptedUrl) {
      const encrypted = encryptUrl(targetUrl);
      return NextResponse.json({ encryptedUrl: encrypted });
    }

    const decodedUrl = decryptUrl(encryptedUrl);

    const response = await fetch(decodedUrl);
    const text = await response.text();
    return new NextResponse(text);
    
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message || 'Error fetching the web page' }, { status: 500 });
  }
}
