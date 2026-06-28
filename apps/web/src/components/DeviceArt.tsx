/**
 * Renders a real product photo when `imageUrl` is set, otherwise the clean SVG art.
 * Real images are owner-supplied (Catalog Manager → Image URL) — we don't ship
 * copyrighted manufacturer photos.
 */
export function DeviceVisual({
  imageUrl,
  kind,
  tint,
  imgClassName = "max-h-full max-w-full object-contain",
}: {
  imageUrl?: string | null;
  kind: DeviceKind;
  tint: string;
  imgClassName?: string;
}) {
  if (imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={imageUrl} alt="" className={imgClassName} loading="lazy" />;
  }
  return <DeviceArt kind={kind} tint={tint} />;
}

export type DeviceKind = "phone" | "laptop" | "tablet" | "watch" | "desktop";

/** Map a category name (e.g. "iPhone", "MacBook", "iPad", "Mac mini", "Apple Watch") to an art kind. */
export function deviceKind(category: string): DeviceKind {
  const c = category.toLowerCase();
  if (c.includes("macbook") || c.includes("laptop")) return "laptop";
  if (c.includes("mini") || c.includes("desktop") || c.includes("imac") || c.includes("mac")) return "desktop";
  if (c.includes("ipad") || c.includes("tablet")) return "tablet";
  if (c.includes("watch") || c.includes("wear")) return "watch";
  return "phone";
}

export function DeviceArt({ kind, tint }: { kind: DeviceKind; tint: string }) {
  if (kind === "laptop") {
    return (
      <svg width={108} height={86} viewBox="0 0 80 60" fill="none" aria-hidden="true">
        <rect x="15" y="8" width="50" height="33" rx="3" fill="#0B1410" />
        <rect x="18" y="11" width="44" height="27" rx="1.5" fill={tint} />
        <rect x="21" y="14" width="19" height="3" rx="1.5" fill="rgba(255,255,255,.55)" />
        <path d="M9 44h62l5 9H4z" fill="#0B1410" />
        <rect x="34" y="46" width="12" height="2.4" rx="1.2" fill="rgba(255,255,255,.25)" />
      </svg>
    );
  }
  if (kind === "tablet") {
    return (
      <svg width={84} height={104} viewBox="0 0 52 64" fill="none" aria-hidden="true">
        <rect x="8" y="3" width="36" height="58" rx="4" fill="#0B1410" />
        <rect x="11" y="7" width="30" height="50" rx="2" fill={tint} />
        <rect x="15" y="10" width="13" height="3" rx="1.5" fill="rgba(255,255,255,.5)" />
        <circle cx="26" cy="59.5" r="1.4" fill="#3A4A44" />
      </svg>
    );
  }
  if (kind === "desktop") {
    return (
      <svg width={104} height={88} viewBox="0 0 72 60" fill="none" aria-hidden="true">
        <rect x="12" y="14" width="48" height="32" rx="6" fill="#0B1410" />
        <rect x="16" y="18" width="40" height="24" rx="3" fill={tint} />
        <circle cx="36" cy="40" r="2" fill="rgba(255,255,255,.35)" />
        <rect x="22" y="48" width="28" height="3" rx="1.5" fill="#0B1410" />
      </svg>
    );
  }
  if (kind === "watch") {
    return (
      <svg width={70} height={96} viewBox="0 0 44 60" fill="none" aria-hidden="true">
        <path d="M15 2h14l-2 8H17z" fill="#0B1410" />
        <path d="M15 58h14l-2-8H17z" fill="#0B1410" />
        <rect x="10" y="14" width="24" height="32" rx="8" fill="#0B1410" />
        <rect x="13" y="17" width="18" height="26" rx="5" fill={tint} />
        <circle cx="34" cy="26" r="1.6" fill="#0B1410" />
      </svg>
    );
  }
  return (
    <svg width={80} height={92} viewBox="0 0 50 64" fill="none" aria-hidden="true">
      <rect x="13" y="3" width="24" height="58" rx="6" fill="#0B1410" />
      <rect x="16" y="8" width="18" height="44" rx="2" fill={tint} />
      <rect x="19" y="11" width="9" height="2.6" rx="1.3" fill="rgba(255,255,255,.55)" />
      <circle cx="25" cy="56" r="1.8" fill="#3A4A44" />
    </svg>
  );
}
