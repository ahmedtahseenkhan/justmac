"use client";

import { useState } from "react";

const SHOTS = [
  { key: "front", label: "Front (screen on)" },
  { key: "back", label: "Back" },
  { key: "screen", label: "Screen close-up" },
];

/**
 * Guided photo capture. In this MVP the images stay client-side (object URLs);
 * production uploads to object storage and attaches them to the Device record.
 */
export function PhotoCapture() {
  const [photos, setPhotos] = useState<Record<string, string>>({});

  function onPick(key: string, file?: File) {
    if (!file) return;
    setPhotos((p) => ({ ...p, [key]: URL.createObjectURL(file) }));
  }

  return (
    <div className="grid grid-cols-3 gap-3">
      {SHOTS.map((shot) => (
        <label
          key={shot.key}
          className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 overflow-hidden rounded-xl border-2 border-dashed border-gray-300 text-center text-xs text-ink-500 hover:border-brand-500"
        >
          {photos[shot.key] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photos[shot.key]} alt={shot.label} className="h-full w-full object-cover" />
          ) : (
            <>
              <span className="text-2xl">📷</span>
              <span className="px-1">{shot.label}</span>
            </>
          )}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => onPick(shot.key, e.target.files?.[0])}
          />
        </label>
      ))}
    </div>
  );
}
