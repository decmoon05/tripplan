'use client';

import { useState, useCallback } from 'react';
import { generateAiItemsStream, type StreamEvent } from '@/lib/api/trips';
import type { TripItem, PlacePreference } from '@/types/database';
import type { FullProfileInput } from '@/lib/validators/profile';

export interface GroundingSource {
  title: string;
  url: string;
}

interface StreamGenerateState {
  status: 'idle' | 'streaming' | 'validating' | 'complete' | 'error';
  progress: string[];
  groundingSources: GroundingSource[];
  partialItems: { placeNameSnapshot: string; dayNumber: number }[];
  error: string | null;
}

export function useStreamGenerate() {
  const [state, setState] = useState<StreamGenerateState>({
    status: 'idle',
    progress: [],
    groundingSources: [],
    partialItems: [],
    error: null,
  });

  const reset = useCallback(() => {
    setState({
      status: 'idle',
      progress: [],
      groundingSources: [],
      partialItems: [],
      error: null,
    });
  }, []);

  const generate = useCallback(async (
    tripId: string,
    profile: FullProfileInput,
    tripInput: { destination: string; startDate: string; endDate: string },
    placePreferences?: { placeName: string; preference: PlacePreference }[],
  ): Promise<TripItem[]> => {
    setState(prev => ({ ...prev, status: 'streaming', error: null, progress: [], groundingSources: [], partialItems: [] }));

    try {
      const items = await generateAiItemsStream(
        tripId, profile, tripInput, placePreferences,
        (event: StreamEvent) => {
          switch (event.type) {
            case 'progress':
              setState(prev => ({
                ...prev,
                progress: [...prev.progress, event.data.message as string],
                status: (event.data.message as string).includes('검증') ? 'validating' : prev.status,
              }));
              break;
            case 'grounding':
              setState(prev => ({
                ...prev,
                groundingSources: [
                  ...prev.groundingSources,
                  ...(event.data.sources as GroundingSource[]),
                ],
              }));
              break;
            case 'item':
              setState(prev => ({
                ...prev,
                partialItems: [
                  ...prev.partialItems,
                  { placeNameSnapshot: event.data.placeNameSnapshot as string, dayNumber: event.data.dayNumber as number },
                ],
              }));
              break;
            case 'complete':
              setState(prev => ({ ...prev, status: 'complete' }));
              break;
          }
        },
      );

      setState(prev => ({ ...prev, status: 'complete' }));
      return items;
    } catch (err) {
      const message = err instanceof Error ? err.message : '일정 생성 실패';
      setState(prev => ({ ...prev, status: 'error', error: message }));
      throw err;
    }
  }, []);

  return {
    ...state,
    generate,
    reset,
    isStreaming: state.status === 'streaming' || state.status === 'validating',
  };
}
