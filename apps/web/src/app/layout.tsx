import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";
import { RefCapture } from "@/components/RefCapture";

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-archivo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "JustMac — Trade in your tech for cash",
  description:
    "Get an instant, transparent cash quote for your phone or laptop, ship it free, and get paid fast. Smart tech. Smarter savings.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={archivo.variable}>
      <body className="overflow-x-hidden font-sans">
        <RefCapture />
        {children}
      </body>
    </html>
  );
}
