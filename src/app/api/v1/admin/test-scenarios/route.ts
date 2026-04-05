/**
 * 테스트 시나리오 목록/개별 조회 API
 * GET /api/v1/admin/test-scenarios          → 전체 목록
 * GET /api/v1/admin/test-scenarios?id=xxx   → 개별 시나리오
 */
import { NextRequest, NextResponse } from 'next/server';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

const SCENARIOS_DIR = join(process.cwd(), 'test', 'scenarios');

export async function GET(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get('id');

    if (id) {
      // 개별 시나리오
      const filePath = join(SCENARIOS_DIR, `${id}.json`);
      const content = await readFile(filePath, 'utf-8');
      return NextResponse.json({ success: true, data: JSON.parse(content), error: null });
    }

    // 전체 목록
    const files = await readdir(SCENARIOS_DIR);
    const scenarios = [];

    for (const file of files.filter(f => f.endsWith('.json')).sort()) {
      const content = await readFile(join(SCENARIOS_DIR, file), 'utf-8');
      const data = JSON.parse(content);
      scenarios.push({
        id: data.id,
        name: data.name,
        description: data.description,
        destination: data.tripInput?.destination,
        days: data.validationConfig?.expectedDayCount,
      });
    }

    return NextResponse.json({ success: true, data: scenarios, error: null });
  } catch (error) {
    return NextResponse.json(
      { success: false, data: null, error: { message: error instanceof Error ? error.message : 'Unknown error' } },
      { status: 500 },
    );
  }
}
