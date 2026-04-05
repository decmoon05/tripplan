import { TripDetailView } from '@/components/features/trip-view/TripDetailView';

export default async function TripDetailPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;

  return <TripDetailView tripId={tripId} />;
}
