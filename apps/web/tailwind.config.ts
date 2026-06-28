import type { Config } from "tailwindcss";

// JustMac palette — blue trade-in brand on a cool off-white canvas.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#E3F2FB",
          100: "#D3E8F8",
          200: "#BBDDF3",
          400: "#5BC2EF",
          500: "#1CA0DD",
          600: "#1C5FB6", // primary
          700: "#15498F",
          900: "#07223D", // dark sections
        },
        ink: {
          900: "#0B1410",
          700: "#33433D",
          600: "#4A5A53",
          500: "#5C6B65",
          400: "#7A8983",
          300: "#9AA8A2",
        },
        canvas: "#F2F6FC",
        line: "#ECEFED",
      },
      fontFamily: {
        sans: ["var(--font-archivo)", "system-ui", "sans-serif"],
        display: ["var(--font-archivo)", "system-ui", "sans-serif"],
      },
      maxWidth: {
        page: "1200px",
      },
      keyframes: {
        floaty: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-14px)" } },
        glowmove: {
          "0%,100%": { transform: "translate(0,0) scale(1)" },
          "50%": { transform: "translate(26px,-22px) scale(1.14)" },
        },
        aurora: {
          "0%": { transform: "translate(-8%,-5%) rotate(0deg)" },
          "50%": { transform: "translate(8%,5%) rotate(7deg)" },
          "100%": { transform: "translate(-8%,-5%) rotate(0deg)" },
        },
        marquee: { "0%": { transform: "translateX(0)" }, "100%": { transform: "translateX(-50%)" } },
        marqueeRev: { "0%": { transform: "translateX(-50%)" }, "100%": { transform: "translateX(0)" } },
        shine: { "0%": { backgroundPosition: "200% 0" }, "100%": { backgroundPosition: "-200% 0" } },
        screenShine: { "0%": { backgroundPosition: "130% 0" }, "55%,100%": { backgroundPosition: "-50% 0" } },
        gradslide: { "0%": { backgroundPosition: "0% 50%" }, "100%": { backgroundPosition: "200% 50%" } },
        btnPulse: {
          "0%,100%": { boxShadow: "0 12px 24px -10px rgba(28,95,182,.65)" },
          "50%": { boxShadow: "0 18px 34px -8px rgba(28,95,182,.9)" },
        },
        pulsering: {
          "0%": { boxShadow: "0 0 0 0 rgba(28,95,182,.5)" },
          "70%": { boxShadow: "0 0 0 14px rgba(28,95,182,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(28,95,182,0)" },
        },
        coinA: {
          "0%,100%": { transform: "translateY(0) rotate(-8deg)" },
          "50%": { transform: "translateY(-22px) rotate(8deg)" },
        },
        coinB: {
          "0%,100%": { transform: "translateY(0) rotate(9deg)" },
          "50%": { transform: "translateY(-28px) rotate(-7deg)" },
        },
        coinC: {
          "0%,100%": { transform: "translateY(0) rotate(0deg)" },
          "50%": { transform: "translateY(-17px) rotate(12deg)" },
        },
        shimmerSweep: {
          "0%": { transform: "translateX(-140%) skewX(-18deg)" },
          "100%": { transform: "translateX(260%) skewX(-18deg)" },
        },
        noteFloat: {
          "0%,100%": { transform: "translateY(0) rotate(var(--rot,0deg))" },
          "50%": { transform: "translateY(-12px) rotate(var(--rot,0deg))" },
        },
      },
      animation: {
        floaty: "floaty 7s ease-in-out infinite",
        glowmove: "glowmove 12s ease-in-out infinite",
        aurora: "aurora 20s ease-in-out infinite",
        marquee: "marquee 26s linear infinite",
        marqueeRev: "marqueeRev 32s linear infinite",
        gradslide: "gradslide 4.5s linear infinite",
        screenShine: "screenShine 4.8s ease-in-out infinite",
        btnPulse: "btnPulse 2.6s ease-in-out infinite",
        pulsering: "pulsering 2.2s infinite",
        coinA: "coinA 6s ease-in-out infinite",
        coinB: "coinB 7s ease-in-out infinite .4s",
        coinC: "coinC 5.5s ease-in-out infinite .2s",
        shimmer: "shimmerSweep 4.2s ease-in-out infinite",
        noteFloat: "noteFloat 6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
