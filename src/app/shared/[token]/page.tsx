import { createClient } from '@/lib/supabase/server';
import { SharedTripView } from '@/components/features/trip-view/SharedTripView';
import { getTripByShareToken } from '@/lib/services/trip.service';
import Link from 'next/link';

export default async function SharedTripPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();

  const result = await getTripByShareToken(supabase, token);

  if (!result) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold">공유된 여행을 찾을 수 없습니다</h1>
          <p className="mt-2 text-[var(--color-muted)]">링크가 만료되었거나 삭제되었습니다.</p>
          <Link href="/dashboard" className="mt-4 inline-block text-[var(--color-primary)] hover:underline">
            대시보드로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  return <SharedTripView trip={result.trip} items={result.items} />;
}
