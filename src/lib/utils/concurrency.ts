/**
 * 배치 병렬 실행 유틸
 *
 * 외부 API 호출 시 rate limit을 준수하면서 병렬 처리.
 * 예: Overpass 5개씩 병렬 + 배치 간 1초 딜레이
 */

/**
 * items를 concurrency개씩 병렬 실행하고, 배치 간 delay를 둔다.
 *
 * @param items - 처리할 아이템 배열
 * @param handler - 각 아이템에 대한 비동기 핸들러
 * @param concurrency - 동시 실행 수
 * @param delayBetweenBatchesMs - 배치 간 대기 시간 (ms)
 * @returns 결과 배열 (실패한 건은 null)
 */
export async function batchedConcurrency<T, R>(
  items: T[],
  handler: (item: T, index: number) => Promise<R>,
  concurrency: number = 5,
  delayBetweenBatchesMs: number = 1000,
): Promise<(R | null)[]> {
  const results: (R | null)[] = [];

  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(
      batch.map((item, idx) => handler(item, i + idx)),
    );

    for (const r of batchResults) {
      results.push(r.status === 'fulfilled' ? r.value : null);
    }

    // 마지막 배치가 아니면 딜레이
    if (i + concurrency < items.length && delayBetweenBatchesMs > 0) {
      await new Promise(r => setTimeout(r, delayBetweenBatchesMs));
    }
  }

  return results;
}
