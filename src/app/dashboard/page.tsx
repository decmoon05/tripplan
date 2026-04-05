'use client';

import { motion, AnimatePresence } from 'motion/react';
import { Plus, Users, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useTrips } from '@/hooks/useTrips';
import { useDeleteTrip } from '@/hooks/useTripMutations';
import { TripCard } from '@/components/features/dashboard/TripCard';

export default function DashboardPage() {
  const { data: trips, isLoading, error } = useTrips();
  const deleteTrip = useDeleteTrip();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
        <p className="text-red-400">{error.message}</p>
      </div>
    );
  }

  const sorted = [...(trips || [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white selection:bg-orange-500/30">
      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* Welcome Section */}
        <section className="mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-5xl font-light tracking-tight mb-4">
              Hello, <span className="font-serif italic">traveler</span>
            </h2>
            <p className="text-white/40 text-lg max-w-2xl">
              You have {sorted.length} saved {sorted.length === 1 ? 'journey' : 'journeys'}.
              Where will your next adventure take you?
            </p>
          </motion.div>
        </section>

        {/* Trips Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* New Trip Card */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Link
              href="/trips/new"
              className="group relative aspect-[4/3] rounded-[2rem] border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-white/20 hover:bg-white/5 transition-all"
            >
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors">
                <Plus className="w-8 h-8 text-white/40 group-hover:text-white transition-colors" />
              </div>
              <div className="text-center">
                <p className="font-medium text-lg">Plan New Trip</p>
                <p className="text-white/40 text-sm">AI-powered personalization</p>
              </div>
            </Link>
          </motion.div>

          {/* Create Room Card */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Link
              href="/rooms/new"
              className="group relative aspect-[4/3] rounded-[2rem] border-2 border-dashed border-orange-500/30 flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-orange-500/50 hover:bg-orange-500/5 transition-all"
            >
              <div className="w-16 h-16 rounded-full bg-orange-500/10 flex items-center justify-center group-hover:bg-orange-500/20 transition-colors">
                <Users className="w-8 h-8 text-orange-500/70 group-hover:text-orange-500 transition-colors" />
              </div>
              <div className="text-center">
                <p className="font-medium text-lg text-orange-50">여행방 만들기</p>
                <p className="text-orange-500/60 text-sm">친구들과 함께 일정 짜기</p>
              </div>
            </Link>
          </motion.div>

          {/* Trip Cards */}
          <AnimatePresence mode="popLayout">
            {sorted.map((trip, index) => (
              <motion.div
                key={trip.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
              >
                <TripCard
                  trip={trip}
                  onDelete={(tripId) => deleteTrip.mutate(tripId)}
                  isDeleting={deleteTrip.isPending}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </main>

      {/* Floating Action Button for Mobile */}
      <Link
        href="/trips/new"
        className="fixed bottom-8 right-8 sm:hidden w-14 h-14 bg-white text-black rounded-full shadow-2xl flex items-center justify-center z-50 active:scale-95 transition-transform"
      >
        <Plus className="w-6 h-6" />
      </Link>
    </div>
  );
}
