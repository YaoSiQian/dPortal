'use client';

import dynamic from 'next/dynamic';
import { HUD } from '@/components/ui/HUD';
import { LandingExperience } from '@/components/landing/LandingExperience';
import { Navigator } from '@/components/navigator/Navigator';
import { JourneyPreview } from '@/components/navigator/JourneyPreview';
import { JourneyController } from '@/components/navigator/JourneyController';
import { JourneySummary } from '@/components/navigator/JourneySummary';
import { JourneyFocusIndicator } from '@/components/navigator/JourneyFocusIndicator';
import { AnimeDetailCard } from '@/components/anime/AnimeDetailCard';
import { SceneStoreProvider } from '@/lib/sceneStore';

const Scene = dynamic(
  () => import('@/components/space/Scene').then((m) => m.Scene),
  {
    ssr: false,
    loading: () => null
  }
);

export default function Page() {
  return (
    <SceneStoreProvider>
      <main className="fixed inset-0 overflow-hidden bg-deep">
        <Scene />
        <HUD />
        <JourneyFocusIndicator />
        <JourneyController />
        <Navigator />
        <JourneyPreview />
        <JourneySummary />
        <AnimeDetailCard />
        <LandingExperience />
      </main>
    </SceneStoreProvider>
  );
}
