import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/* ------------------------------------------------------------------ *
 * Condition trees (per category)
 * ------------------------------------------------------------------ */

const PHONE_CONDITIONS = [
  {
    key: "cosmetic", kind: "COSMETIC", label: "Cosmetic condition",
    helper: "Look at the screen and body in good light. Pick the closest match.",
    options: [
      { key: "flawless", label: "Flawless — like new", helper: "No scratches at arm's length.", multiplier: 1.0 },
      { key: "good", label: "Good — light wear", helper: "Minor scuffs, no cracks.", multiplier: 0.88 },
      { key: "fair", label: "Fair — visible scratches/dents", helper: "Noticeable wear, glass intact.", multiplier: 0.7 },
      { key: "cracked", label: "Cracked glass or housing", helper: "Any crack front or back.", multiplier: 0.45 },
    ],
  },
  {
    key: "functional", kind: "FUNCTIONAL", label: "Does it power on and work?",
    helper: "Power it on and check the screen, buttons and cameras.",
    options: [
      { key: "fully_working", label: "Fully working", helper: null, multiplier: 1.0 },
      { key: "minor_issues", label: "Minor issues", helper: "e.g. a dead pixel, weak speaker.", multiplier: 0.8 },
      { key: "wont_power", label: "Won't power on / major fault", helper: "No display, won't boot, water damage.", multiplier: 0.35 },
    ],
  },
  {
    key: "battery", kind: "BATTERY", label: "Battery health",
    helper: "Settings → Battery → Battery Health.",
    options: [
      { key: "ge_90", label: "90% or higher", helper: null, multiplier: 1.0 },
      { key: "ge_80", label: "80–89%", helper: null, multiplier: 0.95 },
      { key: "lt_80", label: "Below 80% / needs service", helper: null, multiplier: 0.85 },
    ],
  },
  {
    key: "accessories", kind: "ACCESSORIES", label: "Charger included?",
    helper: "Original charging cable in the box adds value.",
    options: [
      { key: "with_charger", label: "Yes, original charger", helper: null, multiplier: 1.02 },
      { key: "no_charger", label: "No charger", helper: null, multiplier: 1.0 },
    ],
  },
  {
    key: "carrier_lock", kind: "CARRIER_LOCK", label: "Carrier & lock status",
    helper: "Unlocked devices are worth the most. Activation Lock must be off before you ship.",
    options: [
      { key: "unlocked", label: "Unlocked", helper: "Best value.", multiplier: 1.0 },
      { key: "att", label: "AT&T", helper: null, multiplier: 0.92 },
      { key: "verizon", label: "Verizon", helper: null, multiplier: 0.92 },
      { key: "tmobile", label: "T-Mobile", helper: null, multiplier: 0.92 },
      { key: "other", label: "Other carrier", helper: null, multiplier: 0.9 },
      { key: "financed", label: "Still financed / on a plan", helper: "Not eligible until paid off.", multiplier: 0.6 },
    ],
  },
];

const LAPTOP_CONDITIONS = [
  {
    key: "cosmetic", kind: "COSMETIC", label: "Cosmetic condition",
    helper: "Check the lid, deck and screen in good light.",
    options: [
      { key: "flawless", label: "Flawless — like new", helper: null, multiplier: 1.0 },
      { key: "good", label: "Good — light wear", helper: null, multiplier: 0.87 },
      { key: "fair", label: "Fair — visible wear/dents", helper: null, multiplier: 0.68 },
      { key: "cracked", label: "Cracked screen or housing", helper: null, multiplier: 0.4 },
    ],
  },
  {
    key: "functional", kind: "FUNCTIONAL", label: "Keyboard, trackpad & ports",
    helper: "Test the keys, trackpad and every port.",
    options: [
      { key: "fully_working", label: "Everything works", helper: null, multiplier: 1.0 },
      { key: "minor_issues", label: "Minor issues", helper: "e.g. a sticky key, one dead port.", multiplier: 0.82 },
      { key: "wont_boot", label: "Won't boot / major fault", helper: null, multiplier: 0.35 },
    ],
  },
  {
    key: "battery", kind: "BATTERY", label: "Battery health / cycles",
    helper: "About → System Report → Power.",
    options: [
      { key: "healthy", label: "Healthy (low cycles)", helper: null, multiplier: 1.0 },
      { key: "worn", label: "Worn (high cycles)", helper: null, multiplier: 0.9 },
      { key: "service", label: "Needs service / swelling", helper: null, multiplier: 0.78 },
    ],
  },
  {
    key: "accessories", kind: "ACCESSORIES", label: "Charger included?",
    helper: "The original power adapter adds value.",
    options: [
      { key: "with_charger", label: "Yes, original charger", helper: null, multiplier: 1.03 },
      { key: "no_charger", label: "No charger", helper: null, multiplier: 1.0 },
    ],
  },
];

const TABLET_CONDITIONS = [
  {
    key: "cosmetic", kind: "COSMETIC", label: "Cosmetic condition",
    helper: "Check the screen and back in good light.",
    options: [
      { key: "flawless", label: "Flawless — like new", helper: null, multiplier: 1.0 },
      { key: "good", label: "Good — light wear", helper: null, multiplier: 0.88 },
      { key: "fair", label: "Fair — visible scratches", helper: null, multiplier: 0.7 },
      { key: "cracked", label: "Cracked glass", helper: null, multiplier: 0.45 },
    ],
  },
  {
    key: "functional", kind: "FUNCTIONAL", label: "Does it power on and work?",
    helper: "Check display, touch, buttons and cameras.",
    options: [
      { key: "fully_working", label: "Fully working", helper: null, multiplier: 1.0 },
      { key: "minor_issues", label: "Minor issues", helper: null, multiplier: 0.8 },
      { key: "wont_power", label: "Won't power on / major fault", helper: null, multiplier: 0.35 },
    ],
  },
  {
    key: "battery", kind: "BATTERY", label: "Battery health",
    helper: "Settings → Battery.",
    options: [
      { key: "ge_90", label: "90% or higher", helper: null, multiplier: 1.0 },
      { key: "ge_80", label: "80–89%", helper: null, multiplier: 0.95 },
      { key: "lt_80", label: "Below 80%", helper: null, multiplier: 0.85 },
    ],
  },
  {
    key: "accessories", kind: "ACCESSORIES", label: "Charger / accessories included?",
    helper: "Original cable, adapter, or band add value.",
    options: [
      { key: "with_charger", label: "Yes", helper: null, multiplier: 1.02 },
      { key: "no_charger", label: "No", helper: null, multiplier: 1.0 },
    ],
  },
];

// Mac mini / desktop — no battery question.
const DESKTOP_CONDITIONS = [
  {
    key: "cosmetic", kind: "COSMETIC", label: "Cosmetic condition",
    helper: "Check the chassis for scuffs and dents.",
    options: [
      { key: "flawless", label: "Flawless — like new", helper: null, multiplier: 1.0 },
      { key: "good", label: "Good — light wear", helper: null, multiplier: 0.9 },
      { key: "fair", label: "Fair — visible wear", helper: null, multiplier: 0.75 },
      { key: "damaged", label: "Dented / damaged", helper: null, multiplier: 0.55 },
    ],
  },
  {
    key: "functional", kind: "FUNCTIONAL", label: "Boots & all ports work?",
    helper: "Power on and test every port.",
    options: [
      { key: "fully_working", label: "Boots, everything works", helper: null, multiplier: 1.0 },
      { key: "minor_issues", label: "Minor issues", helper: "e.g. one dead port.", multiplier: 0.82 },
      { key: "wont_boot", label: "Won't boot / major fault", helper: null, multiplier: 0.35 },
    ],
  },
  {
    key: "accessories", kind: "ACCESSORIES", label: "Power cable included?",
    helper: null,
    options: [
      { key: "with_charger", label: "Yes", helper: null, multiplier: 1.02 },
      { key: "no_charger", label: "No", helper: null, multiplier: 1.0 },
    ],
  },
];

/* ------------------------------------------------------------------ *
 * Catalog builders + data (Apple-only, 2018–2026)
 * Variants cover the price-bearing configurations (storage / RAM / size).
 * ------------------------------------------------------------------ */

type Cfg = { label: string; attributes: Record<string, string>; base: number; floor: number; ceiling: number };
type SeedModel = { slug: string; name: string; image: string | null; variants: Cfg[]; feed?: number };

const tier = (b: number) => ({ floor: Math.max(15, Math.round(b * 0.18)), ceiling: Math.round(b * 1.06) });
const feedForYear = (y: number) => Math.round(Math.max(0.92, Math.min(1.06, 1 + (y - 2022) * 0.015)) * 1000) / 1000;

// storage-tier device (iPhone / iPad)
function storageModel(slug: string, name: string, year: number, storages: string[], base: number, step: number, extra: Record<string, string> = {}): SeedModel {
  return {
    slug, name, image: null, feed: feedForYear(year),
    variants: storages.map((s, i) => { const b = base + i * step; return { label: s, attributes: { storage: s, ...extra }, base: b, ...tier(b) }; }),
  };
}
// RAM/storage device (MacBook / Mac mini)
function macModel(slug: string, name: string, year: number, chip: string, combos: { ram: string; storage: string; base: number }[]): SeedModel {
  return {
    slug, name, image: null, feed: feedForYear(year),
    variants: combos.map((c) => ({ label: `${c.ram} / ${c.storage}`, attributes: { chip, ram: c.ram, storage: c.storage, year: String(year) }, base: c.base, ...tier(c.base) })),
  };
}
// size × connectivity device (Apple Watch)
function watchModel(slug: string, name: string, year: number, sizes: { size: string; base: number }[], conns: { label: string; add: number }[]): SeedModel {
  const variants: Cfg[] = [];
  for (const s of sizes) for (const c of conns) {
    const b = s.base + c.add;
    variants.push({ label: `${s.size} · ${c.label}`, attributes: { size: s.size, connectivity: c.label, year: String(year) }, base: b, ...tier(b) });
  }
  return { slug, name, image: null, feed: feedForYear(year), variants };
}

const IPHONES: SeedModel[] = [
  storageModel("iphone-xr", "iPhone XR", 2018, ["64GB", "128GB", "256GB"], 90, 25),
  storageModel("iphone-xs", "iPhone XS", 2018, ["64GB", "256GB", "512GB"], 100, 35),
  storageModel("iphone-xs-max", "iPhone XS Max", 2018, ["64GB", "256GB", "512GB"], 120, 40),
  storageModel("iphone-11", "iPhone 11", 2019, ["64GB", "128GB", "256GB"], 150, 30),
  storageModel("iphone-11-pro", "iPhone 11 Pro", 2019, ["64GB", "256GB", "512GB"], 190, 45),
  storageModel("iphone-11-pro-max", "iPhone 11 Pro Max", 2019, ["64GB", "256GB", "512GB"], 220, 50),
  storageModel("iphone-12-mini", "iPhone 12 mini", 2020, ["64GB", "128GB", "256GB"], 170, 30),
  storageModel("iphone-12", "iPhone 12", 2020, ["64GB", "128GB", "256GB"], 210, 35),
  storageModel("iphone-12-pro", "iPhone 12 Pro", 2020, ["128GB", "256GB", "512GB"], 270, 55),
  storageModel("iphone-12-pro-max", "iPhone 12 Pro Max", 2020, ["128GB", "256GB", "512GB"], 320, 60),
  storageModel("iphone-13-mini", "iPhone 13 mini", 2021, ["128GB", "256GB", "512GB"], 250, 45),
  storageModel("iphone-13", "iPhone 13", 2021, ["128GB", "256GB", "512GB"], 320, 50),
  storageModel("iphone-13-pro", "iPhone 13 Pro", 2021, ["128GB", "256GB", "512GB", "1TB"], 380, 60),
  storageModel("iphone-13-pro-max", "iPhone 13 Pro Max", 2021, ["128GB", "256GB", "512GB", "1TB"], 440, 65),
  storageModel("iphone-14", "iPhone 14", 2022, ["128GB", "256GB", "512GB"], 400, 55),
  storageModel("iphone-14-plus", "iPhone 14 Plus", 2022, ["128GB", "256GB", "512GB"], 440, 55),
  storageModel("iphone-14-pro", "iPhone 14 Pro", 2022, ["128GB", "256GB", "512GB", "1TB"], 520, 70),
  storageModel("iphone-14-pro-max", "iPhone 14 Pro Max", 2022, ["128GB", "256GB", "512GB", "1TB"], 600, 75),
  storageModel("iphone-15", "iPhone 15", 2023, ["128GB", "256GB", "512GB"], 540, 60),
  storageModel("iphone-15-plus", "iPhone 15 Plus", 2023, ["128GB", "256GB", "512GB"], 580, 60),
  storageModel("iphone-15-pro", "iPhone 15 Pro", 2023, ["128GB", "256GB", "512GB", "1TB"], 700, 80),
  storageModel("iphone-15-pro-max", "iPhone 15 Pro Max", 2023, ["256GB", "512GB", "1TB"], 820, 90),
  storageModel("iphone-16", "iPhone 16", 2024, ["128GB", "256GB", "512GB"], 620, 65),
  storageModel("iphone-16-plus", "iPhone 16 Plus", 2024, ["128GB", "256GB", "512GB"], 670, 65),
  storageModel("iphone-16-pro", "iPhone 16 Pro", 2024, ["128GB", "256GB", "512GB", "1TB"], 820, 90),
  storageModel("iphone-16-pro-max", "iPhone 16 Pro Max", 2024, ["256GB", "512GB", "1TB"], 950, 100),
  storageModel("iphone-16e", "iPhone 16e", 2025, ["128GB", "256GB", "512GB"], 430, 55),
  storageModel("iphone-17", "iPhone 17", 2025, ["256GB", "512GB"], 730, 90),
  storageModel("iphone-air", "iPhone Air", 2025, ["256GB", "512GB", "1TB"], 800, 100),
  storageModel("iphone-17-pro", "iPhone 17 Pro", 2025, ["256GB", "512GB", "1TB"], 1000, 110),
  storageModel("iphone-17-pro-max", "iPhone 17 Pro Max", 2025, ["256GB", "512GB", "1TB", "2TB"], 1120, 120),
  storageModel("iphone-17e", "iPhone 17e", 2026, ["128GB", "256GB"], 540, 70),
  storageModel("iphone-se-2", "iPhone SE (2nd gen)", 2020, ["64GB", "128GB", "256GB"], 90, 25),
  storageModel("iphone-se-3", "iPhone SE (3rd gen)", 2022, ["64GB", "128GB", "256GB"], 130, 30),
];

const WIFI = { connectivity: "Wi-Fi" };
const IPADS: SeedModel[] = [
  storageModel("ipad-pro-11-m1", 'iPad Pro 11" (3rd gen, M1)', 2021, ["128GB", "256GB", "512GB"], 360, 80, WIFI),
  storageModel("ipad-pro-129-m1", 'iPad Pro 12.9" (5th gen, M1)', 2021, ["128GB", "256GB", "512GB"], 520, 100, WIFI),
  storageModel("ipad-pro-11-m2", 'iPad Pro 11" (4th gen, M2)', 2022, ["128GB", "256GB", "512GB"], 480, 90, WIFI),
  storageModel("ipad-pro-129-m2", 'iPad Pro 12.9" (6th gen, M2)', 2022, ["128GB", "256GB", "512GB"], 640, 110, WIFI),
  storageModel("ipad-pro-11-m4", 'iPad Pro 11" (M4)', 2024, ["256GB", "512GB", "1TB"], 700, 120, WIFI),
  storageModel("ipad-pro-13-m4", 'iPad Pro 13" (M4)', 2024, ["256GB", "512GB", "1TB"], 850, 140, WIFI),
  storageModel("ipad-air-4", "iPad Air (4th gen)", 2020, ["64GB", "256GB"], 230, 70, WIFI),
  storageModel("ipad-air-5-m1", "iPad Air (5th gen, M1)", 2022, ["64GB", "256GB"], 330, 90, WIFI),
  storageModel("ipad-air-11-m2", 'iPad Air 11" (M2)', 2024, ["128GB", "256GB", "512GB"], 440, 80, WIFI),
  storageModel("ipad-air-13-m2", 'iPad Air 13" (M2)', 2024, ["128GB", "256GB", "512GB"], 560, 90, WIFI),
  storageModel("ipad-air-11-m3", 'iPad Air 11" (M3)', 2025, ["128GB", "256GB", "512GB"], 500, 85, WIFI),
  storageModel("ipad-7", "iPad (7th gen)", 2019, ["32GB", "128GB"], 120, 40, WIFI),
  storageModel("ipad-8", "iPad (8th gen)", 2020, ["32GB", "128GB"], 150, 45, WIFI),
  storageModel("ipad-9", "iPad (9th gen)", 2021, ["64GB", "256GB"], 180, 50, WIFI),
  storageModel("ipad-10", "iPad (10th gen)", 2022, ["64GB", "256GB"], 230, 55, WIFI),
  storageModel("ipad-a16", "iPad (A16)", 2025, ["128GB", "256GB"], 280, 60, WIFI),
  storageModel("ipad-mini-5", "iPad mini (5th gen)", 2019, ["64GB", "256GB"], 160, 50, WIFI),
  storageModel("ipad-mini-6", "iPad mini (6th gen)", 2021, ["64GB", "256GB"], 260, 70, WIFI),
  storageModel("ipad-mini-a17", "iPad mini (A17 Pro)", 2024, ["128GB", "256GB", "512GB"], 350, 70, WIFI),
];

const MACBOOKS: SeedModel[] = [
  macModel("macbook-air-13-2018", 'MacBook Air 13" (2018)', 2018, "Intel i5", [{ ram: "8GB", storage: "128GB", base: 160 }, { ram: "8GB", storage: "256GB", base: 200 }, { ram: "16GB", storage: "512GB", base: 260 }]),
  macModel("macbook-air-13-2019", 'MacBook Air 13" (2019)', 2019, "Intel i5", [{ ram: "8GB", storage: "128GB", base: 180 }, { ram: "8GB", storage: "256GB", base: 220 }, { ram: "16GB", storage: "512GB", base: 290 }]),
  macModel("macbook-air-13-2020-intel", 'MacBook Air 13" (2020, Intel)', 2020, "Intel i3", [{ ram: "8GB", storage: "256GB", base: 260 }, { ram: "8GB", storage: "512GB", base: 320 }, { ram: "16GB", storage: "512GB", base: 380 }]),
  macModel("macbook-air-13-m1", 'MacBook Air 13" (M1, 2020)', 2020, "M1", [{ ram: "8GB", storage: "256GB", base: 420 }, { ram: "8GB", storage: "512GB", base: 500 }, { ram: "16GB", storage: "512GB", base: 560 }]),
  macModel("macbook-air-13-m2", 'MacBook Air 13" (M2, 2022)', 2022, "M2", [{ ram: "8GB", storage: "256GB", base: 560 }, { ram: "8GB", storage: "512GB", base: 650 }, { ram: "16GB", storage: "512GB", base: 720 }, { ram: "16GB", storage: "1TB", base: 820 }]),
  macModel("macbook-air-13-m3", 'MacBook Air 13" (M3, 2024)', 2024, "M3", [{ ram: "8GB", storage: "256GB", base: 740 }, { ram: "16GB", storage: "512GB", base: 940 }, { ram: "24GB", storage: "1TB", base: 1100 }]),
  macModel("macbook-air-15-m3", 'MacBook Air 15" (M3, 2024)', 2024, "M3", [{ ram: "8GB", storage: "256GB", base: 840 }, { ram: "16GB", storage: "512GB", base: 1040 }]),
  macModel("macbook-air-13-m4", 'MacBook Air 13" (M4, 2025)', 2025, "M4", [{ ram: "16GB", storage: "256GB", base: 860 }, { ram: "16GB", storage: "512GB", base: 980 }, { ram: "24GB", storage: "1TB", base: 1150 }]),
  macModel("macbook-air-15-m4", 'MacBook Air 15" (M4, 2025)', 2025, "M4", [{ ram: "16GB", storage: "256GB", base: 960 }, { ram: "16GB", storage: "512GB", base: 1100 }]),
  macModel("macbook-air-13-m5", 'MacBook Air 13" (M5, 2026)', 2026, "M5", [{ ram: "16GB", storage: "512GB", base: 1050 }, { ram: "24GB", storage: "1TB", base: 1250 }]),
  macModel("macbook-air-15-m5", 'MacBook Air 15" (M5, 2026)', 2026, "M5", [{ ram: "16GB", storage: "512GB", base: 1180 }, { ram: "24GB", storage: "1TB", base: 1380 }]),
  macModel("macbook-pro-14-m2-pro", 'MacBook Pro 14" (M2 Pro, 2023)', 2023, "M2 Pro", [{ ram: "16GB", storage: "512GB", base: 1150 }, { ram: "32GB", storage: "1TB", base: 1450 }]),
  macModel("macbook-pro-14-m3", 'MacBook Pro 14" (M3, 2023)', 2023, "M3", [{ ram: "8GB", storage: "512GB", base: 1100 }, { ram: "18GB", storage: "512GB", base: 1300 }]),
  macModel("macbook-pro-16-m3-pro", 'MacBook Pro 16" (M3 Pro, 2023)', 2023, "M3 Pro", [{ ram: "18GB", storage: "512GB", base: 1600 }, { ram: "36GB", storage: "1TB", base: 2000 }]),
  macModel("macbook-pro-14-m4", 'MacBook Pro 14" (M4, 2024)', 2024, "M4", [{ ram: "16GB", storage: "512GB", base: 1300 }, { ram: "24GB", storage: "1TB", base: 1600 }]),
];

const MAC_MINIS: SeedModel[] = [
  macModel("mac-mini-2018", "Mac mini (2018)", 2018, "Intel i5", [{ ram: "8GB", storage: "128GB", base: 180 }, { ram: "8GB", storage: "256GB", base: 230 }, { ram: "16GB", storage: "512GB", base: 300 }]),
  macModel("mac-mini-m1", "Mac mini (M1, 2020)", 2020, "M1", [{ ram: "8GB", storage: "256GB", base: 320 }, { ram: "16GB", storage: "512GB", base: 430 }]),
  macModel("mac-mini-m2", "Mac mini (M2, 2023)", 2023, "M2", [{ ram: "8GB", storage: "256GB", base: 420 }, { ram: "16GB", storage: "512GB", base: 560 }]),
  macModel("mac-mini-m2-pro", "Mac mini (M2 Pro, 2023)", 2023, "M2 Pro", [{ ram: "16GB", storage: "512GB", base: 720 }, { ram: "32GB", storage: "1TB", base: 950 }]),
  macModel("mac-mini-m4", "Mac mini (M4, 2024)", 2024, "M4", [{ ram: "16GB", storage: "256GB", base: 500 }, { ram: "24GB", storage: "512GB", base: 680 }]),
  macModel("mac-mini-m4-pro", "Mac mini (M4 Pro, 2024)", 2024, "M4 Pro", [{ ram: "24GB", storage: "512GB", base: 950 }, { ram: "48GB", storage: "1TB", base: 1300 }]),
];

const GPS = [{ label: "GPS", add: 0 }, { label: "GPS + Cellular", add: 40 }];
const WATCHES: SeedModel[] = [
  watchModel("apple-watch-se-2", "Apple Watch SE (2nd gen)", 2022, [{ size: "40mm", base: 110 }, { size: "44mm", base: 130 }], GPS),
  watchModel("apple-watch-series-9", "Apple Watch Series 9", 2023, [{ size: "41mm", base: 190 }, { size: "45mm", base: 220 }], GPS),
  watchModel("apple-watch-series-10", "Apple Watch Series 10", 2024, [{ size: "42mm", base: 260 }, { size: "46mm", base: 290 }], GPS),
  watchModel("apple-watch-ultra-2", "Apple Watch Ultra 2", 2023, [{ size: "49mm Titanium", base: 480 }], [{ label: "Cellular", add: 0 }]),
  watchModel("apple-watch-ultra-3", "Apple Watch Ultra 3", 2025, [{ size: "49mm Titanium", base: 620 }], [{ label: "Cellular", add: 0 }]),
];

const PROMOS = [
  { code: "APPLE5", kind: "BUYBACK_BONUS", valueType: "PERCENT", value: 5, scope: "ALL" },
  { code: "IPHONE10", kind: "BUYBACK_BONUS", valueType: "PERCENT", value: 10, scope: "category:iphone" },
  { code: "MACBONUS", kind: "BUYBACK_BONUS", valueType: "FIXED", value: 25, scope: "category:macbook" },
  { code: "WELCOME10", kind: "RESALE_DISCOUNT", valueType: "PERCENT", value: 10, scope: "ALL" },
];

/* ------------------------------------------------------------------ *
 * Seeding
 * ------------------------------------------------------------------ */

type SeedCondition = {
  key: string; kind: string; label: string; helper: string | null;
  options: { key: string; label: string; helper: string | null; multiplier: number }[];
};

async function seedCategory(opts: { slug: string; name: string; targetMargin: number; conditions: SeedCondition[]; brandSlug: string; models: SeedModel[] }) {
  const category = await prisma.category.create({ data: { slug: opts.slug, name: opts.name, targetMargin: opts.targetMargin } });
  const brand = await prisma.brand.create({ data: { slug: opts.brandSlug, name: "Apple", categoryId: category.id } });

  for (const m of opts.models) {
    const model = await prisma.model.create({ data: { slug: m.slug, name: m.name, imageUrl: m.image, categoryId: category.id, brandId: brand.id } });
    for (let ai = 0; ai < opts.conditions.length; ai++) {
      const a = opts.conditions[ai];
      await prisma.conditionAttribute.create({
        data: {
          modelId: model.id, key: a.key, kind: a.kind, label: a.label, helper: a.helper, sortOrder: ai,
          options: { create: a.options.map((o, oi) => ({ key: o.key, label: o.label, helper: o.helper, multiplier: o.multiplier, sortOrder: oi })) },
        },
      });
    }
    for (const v of m.variants) {
      const variant = await prisma.variant.create({ data: { modelId: model.id, label: v.label, attributes: v.attributes } });
      await prisma.priceBase.create({ data: { variantId: variant.id, baseValue: v.base, floor: v.floor, ceiling: v.ceiling } });
    }
    if (m.feed !== undefined) await prisma.marketFeed.create({ data: { modelId: model.id, factor: m.feed } });
  }
  const variantTotal = opts.models.reduce((n, m) => n + m.variants.length, 0);
  console.log(`  ${opts.name}: ${opts.models.length} models, ${variantTotal} variants`);
}

async function main() {
  console.log("Resetting data…");
  await prisma.user.deleteMany();
  await prisma.affiliateConversion.deleteMany();
  await prisma.affiliate.deleteMany();
  await prisma.priceWatch.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.bulkDevice.deleteMany();
  await prisma.bulkBatch.deleteMany();
  await prisma.b2BAccount.deleteMany();
  await prisma.saleItem.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.orderEvent.deleteMany();
  await prisma.inspection.deleteMany();
  await prisma.device.deleteMany();
  await prisma.payout.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.quote.deleteMany();
  await prisma.priceBase.deleteMany();
  await prisma.marketFeed.deleteMany();
  await prisma.conditionOption.deleteMany();
  await prisma.conditionAttribute.deleteMany();
  await prisma.variant.deleteMany();
  await prisma.model.deleteMany();
  await prisma.brand.deleteMany();
  await prisma.category.deleteMany();
  await prisma.promoCode.deleteMany();

  console.log("Seeding Apple catalog…");
  await seedCategory({ slug: "iphone", name: "iPhone", targetMargin: 0.28, conditions: PHONE_CONDITIONS, brandSlug: "apple-iphone", models: IPHONES });
  await seedCategory({ slug: "ipad", name: "iPad", targetMargin: 0.24, conditions: TABLET_CONDITIONS, brandSlug: "apple-ipad", models: IPADS });
  await seedCategory({ slug: "macbook", name: "MacBook", targetMargin: 0.22, conditions: LAPTOP_CONDITIONS, brandSlug: "apple-macbook", models: MACBOOKS });
  await seedCategory({ slug: "mac-mini", name: "Mac mini", targetMargin: 0.2, conditions: DESKTOP_CONDITIONS, brandSlug: "apple-macmini", models: MAC_MINIS });
  await seedCategory({ slug: "apple-watch", name: "Apple Watch", targetMargin: 0.26, conditions: TABLET_CONDITIONS, brandSlug: "apple-watch", models: WATCHES });

  for (const p of PROMOS) await prisma.promoCode.create({ data: p });
  console.log(`  seeded ${PROMOS.length} promo codes`);

  for (const a of [
    { code: "CREATOR10", name: "TechCreator", email: "creator@example.com", ratePct: 5 },
    { code: "GADGETBLOG", name: "Gadget Blog", email: "blog@example.com", ratePct: 7 },
  ]) await prisma.affiliate.create({ data: a });
  console.log("  seeded 2 affiliates");

  await prisma.user.create({ data: { email: "owner@justmac.test", name: "JustMac Owner", role: "ADMIN", passwordHash: await bcrypt.hash("owner1234", 10) } });
  await prisma.user.create({ data: { email: "staff@justmac.test", name: "Ops Staff", role: "OPS_STAFF", passwordHash: await bcrypt.hash("staff1234", 10) } });
  console.log("  seeded users: owner@justmac.test/owner1234 (ADMIN), staff@justmac.test/staff1234 (OPS_STAFF)");

  const models = await prisma.model.count();
  const variants = await prisma.variant.count();
  console.log(`Seed complete — ${models} models, ${variants} variants.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
