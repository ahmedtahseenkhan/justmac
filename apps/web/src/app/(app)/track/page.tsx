"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function TrackLookupPage() {
  const router = useRouter();
  const [id, setId] = useState("");

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-3xl font-extrabold tracking-tight">Track your trade-in</h1>
      <p className="mt-2 text-ink-500">Enter the tracking ID from your confirmation email.</p>
      <form
        className="mt-6 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (id.trim()) router.push(`/track/${id.trim().toUpperCase()}`);
        }}
      >
        <input
          className="input"
          placeholder="e.g. AB23CD45"
          value={id}
          onChange={(e) => setId(e.target.value)}
        />
        <button className="btn-primary" type="submit">Track</button>
      </form>
    </div>
  );
}
