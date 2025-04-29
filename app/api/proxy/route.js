// app/api/proxy/route.js
import { NextResponse } from 'next/server';
import crypto from 'crypto';

const SECRET_KEY = process.env.SECRET_KEY;
const targetUrl = 'https://novatrail.vercel.app';

function encryptUrl(url) {
  const cipher = crypto.createCipher('aes-256-cbc', SECRET_KEY);
  let encrypted = cipher.update(url, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

function decryptUrl(encryptedUrl) {
  const decipher = crypto.createDecipher('aes-256-cbc', SECRET_KEY);
  let decrypted = decipher.update(encryptedUrl, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const encryptedUrl = searchParams.get('encryptedUrl');

  if (!encryptedUrl) {
    const encrypted = encryptUrl(targetUrl);
    return NextResponse.json({ encryptedUrl: encrypted });
  }

  const decodedUrl = decryptUrl(encryptedUrl);

  try {
    const response = await fetch(decodedUrl);
    const text = await response.text();
    return new NextResponse(text);
  } catch (error) {
    return NextResponse.json({ error: 'Error fetching the web page' }, { status: 500 });
  }
}
