'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Camera, Upload, X, ZoomIn, Image as ImageIcon } from 'lucide-react';

interface TripPhoto {
  id: string;
  tripId: string;
  storagePath: string;
  publicUrl: string;
  caption: string | null;
  dayNumber: number | null;
  createdAt: string;
}

interface PhotoGalleryProps {
  tripId: string;
  dayCount: number;
}

export function PhotoGallery({ tripId, dayCount }: PhotoGalleryProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [uploadCaption, setUploadCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const { data: photos = [], isLoading } = useQuery<TripPhoto[]>({
    queryKey: ['trips', tripId, 'photos', selectedDay],
    queryFn: async () => {
      const url = selectedDay
        ? `/api/v1/trips/${tripId}/photos?dayNumber=${selectedDay}`
        : `/api/v1/trips/${tripId}/photos`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('사진을 불러오는데 실패했습니다');
      const json = await res.json();
      return json.data ?? [];
    },
  });

  const deletePhoto = useMutation({
    mutationFn: async (photoId: string) => {
      // Note: actual storage deletion would require a separate API call
      // For now, we just remove the DB record
      const res = await fetch(`/api/v1/trips/${tripId}/photos/${photoId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('삭제 실패');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'photos'] });
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      // 1. Get signed upload URL
      const initRes = await fetch(`/api/v1/trips/${tripId}/photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          dayNumber: selectedDay,
          caption: uploadCaption || null,
        }),
      });

      if (!initRes.ok) {
        const err = await initRes.json();
        throw new Error(err.error?.message || '업로드 URL 생성 실패');
      }

      const { data: { uploadUrl, storagePath } } = await initRes.json();

      // 2. Upload to Supabase Storage
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });

      if (!uploadRes.ok) throw new Error('파일 업로드 실패');

      // 3. Confirm upload — save to DB
      const confirmRes = await fetch(`/api/v1/trips/${tripId}/photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'confirm',
          storagePath,
          caption: uploadCaption || null,
          dayNumber: selectedDay,
        }),
      });

      if (!confirmRes.ok) throw new Error('사진 저장 실패');

      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'photos'] });
      setUploadCaption('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : '업로드 실패');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header + Upload */}
      <div className="bg-white rounded-2xl p-4 border border-black/5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-orange-500" />
            <h3 className="font-semibold text-sm">사진 갤러리</h3>
          </div>
          <p className="text-xs text-black/30">
            * Supabase Storage &apos;trip-photos&apos; 버킷 필요
          </p>
        </div>

        {/* Day filter */}
        <div className="flex gap-2 mb-3 flex-wrap">
          <button
            type="button"
            onClick={() => setSelectedDay(null)}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
              selectedDay === null ? 'bg-black text-white' : 'bg-black/5 text-black/60 hover:bg-black/10'
            }`}
          >
            전체
          </button>
          {Array.from({ length: dayCount }, (_, i) => i + 1).map((day) => (
            <button
              key={day}
              type="button"
              onClick={() => setSelectedDay(day)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                selectedDay === day ? 'bg-black text-white' : 'bg-black/5 text-black/60 hover:bg-black/10'
              }`}
            >
              Day {day}
            </button>
          ))}
        </div>

        {/* Upload area */}
        <div className="flex gap-2">
          <input
            type="text"
            value={uploadCaption}
            onChange={(e) => setUploadCaption(e.target.value)}
            placeholder="사진 설명 (선택)"
            className="flex-1 text-sm px-3 py-2 border border-black/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/30 bg-[#f5f5f5]"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-1.5 px-4 py-2 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600 transition-colors disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            {isUploading ? '업로드 중...' : '사진 추가'}
          </button>
        </div>
        {uploadError && (
          <p className="text-xs text-red-500 mt-2">{uploadError}</p>
        )}
      </div>

      {/* Photos grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : photos.length === 0 ? (
        <div className="text-center py-12 text-black/30">
          <ImageIcon className="w-8 h-8 mx-auto mb-3 text-black/20" />
          <p className="text-sm">아직 사진이 없어요</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {photos.map((photo) => (
            <div key={photo.id} className="relative group aspect-square rounded-2xl overflow-hidden bg-black/5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.publicUrl}
                alt={photo.caption ?? '여행 사진'}
                className="w-full h-full object-cover"
              />
              {/* Overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => setLightboxUrl(photo.publicUrl)}
                  className="opacity-0 group-hover:opacity-100 p-2 bg-white/90 rounded-full transition-opacity"
                >
                  <ZoomIn className="w-4 h-4 text-black" />
                </button>
              </div>
              {/* Caption */}
              {photo.caption && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                  <p className="text-xs text-white truncate">{photo.caption}</p>
                </div>
              )}
              {/* Day badge */}
              {photo.dayNumber && (
                <div className="absolute top-2 left-2 bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  Day {photo.dayNumber}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxUrl}
            alt="사진"
            className="max-w-full max-h-full object-contain rounded-xl"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            onClick={() => setLightboxUrl(null)}
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}
