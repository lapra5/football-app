import { NextResponse } from 'next/server';
import path from 'path';
import { promises as fs } from 'fs';

// GET メソッド
export async function GET() {
  try {
    // JSONファイルの正しいパス
    const filePath = path.join(process.cwd(), 'src', 'data', 'current_month_matches.json');

    // ファイル読み込み
    const fileContents = await fs.readFile(filePath, 'utf-8');

    // JSONパースしてレスポンス
    const jsonData = JSON.parse(fileContents);
    return NextResponse.json(jsonData);
  } catch (error) {
    console.error('❌ JSON読み込みエラー:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
