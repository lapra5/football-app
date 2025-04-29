import { NextResponse } from 'next/server';
import crypto from 'crypto';

export const runtime = 'nodejs'; // ← 追加！！！これだけでNode Runtimeになる

const SECRET_KEY = process.env.SECRET_KEY;
const targetUrl = 'https://novatrail.vercel.app';

function encryptUrl(url) {
  if (!SECRET_KEY) throw new Error('SECRET_KEY is not set');
  const cipher = crypto.createCipher('aes-256-cbc', SECRET_KEY);
  let encrypted = cipher.update(url, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

function decryptUrl(encryptedUrl) {
  if (!SECRET_KEY) throw new Error('SECRET_KEY is not set');
  const decipher = crypto.createDecipher('aes-256-cbc', SECRET_KEY);
  let decrypted = decipher.update(encryptedUrl, 'hex', 'utf8');
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
