import Link from "next/link";
import type { ModelCardDto } from "@sellme/shared";
import { CountUp, Tilt } from "@/components/motion";
import { DeviceVisual, deviceKind } from "@/components/DeviceArt";

// Soft, on-brand panel gradients + device-art tints, varied by index.
const PANELS = [
  { bg: "linear-gradient(155deg,#E9F0FB,#F5F9FE)", tint: "#9DB8E0" },
  { bg: "linear-gradient(155deg,#EDF0FB,#F6F8FD)", tint: "#A9C6EE" },
  { bg: "linear-gradient(155deg,#ECEFF8,#F6F7FC)", tint: "#9FB3D8" },
  { bg: "linear-gradient(155deg,#EFF1F4,#F8F9FB)", tint: "#CDD3DA" },
];

export function DeviceTile({ model, index = 0 }: { model: ModelCardDto; index?: number }) {
  const panel = PANELS[index % PANELS.length];
  const kind = deviceKind(model.category);

  return (
    <Link href={`/sell/${model.slug}`} className="group block">
      <Tilt className="h-full rounded-[20px] border border-line bg-white p-[18px]">
        <div
          className="relative flex h-[160px] items-center justify-center overflow-hidden rounded-[14px]"
          style={{ background: panel.bg }}
        >
          <div className="relative z-[1] flex h-full w-full items-center justify-center p-3 transition-transform duration-500 group-hover:scale-105">
            <DeviceVisual imageUrl={model.imageUrl} kind={kind} tint={panel.tint} />
          </div>
          <div className="absolute bottom-0 left-0 top-0 z-[2] w-[42%] animate-shimmer bg-[linear-gradient(90deg,transparent,rgba(255,255,255,.7),transparent)]" />
        </div>

        <div className="mt-[18px] text-xs font-semibold uppercase tracking-[0.1em] text-ink-300">
          {model.brand}
        </div>
        <div className="mt-1.5 font-display text-[18px] font-bold leading-tight tracking-[-0.01em]">
          {model.name}
        </div>

        <div className="mt-3.5 flex items-end justify-between">
          <div>
            <div className="text-[13px] text-ink-400">Cash up to</div>
            <div className="font-display text-[30px] font-extrabold leading-none tracking-[-0.02em] text-brand-600">
              <CountUp value={model.cashUpTo} prefix="$" />
            </div>
          </div>
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-brand-600 transition-all duration-300 group-hover:bg-brand-600 group-hover:text-white">
            →
          </span>
        </div>
      </Tilt>
    </Link>
  );
}
