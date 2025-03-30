import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// ESモジュール用 __dirname の代替
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../.env.local') });

console.log('✅ .env.local 読み込みました！');

console.log('All environment variables: ', process.env);

const json = process.env.FIREBASE_PRIVATE_KEY_JSON;
console.log('FIREBASE_PRIVATE_KEY_JSON 環境変数: ', json);

try {
  const parsed = JSON.parse(json ?? '{}');
  console.log('✅ JSON パース成功！内容:', parsed);
} catch (error) {
  console.error('❌ JSON パースエラー:', error);
}
