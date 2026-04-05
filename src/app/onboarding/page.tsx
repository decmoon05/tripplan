'use client';

import { ProfileForm } from '@/components/features/profile/ProfileForm';

export default function OnboardingPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white p-6 flex flex-col items-center justify-center">
      <div className="max-w-2xl w-full">
        <ProfileForm />
      </div>
    </main>
  );
}
