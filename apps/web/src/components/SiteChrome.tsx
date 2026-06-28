import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

/** Customer-facing chrome: header + footer. `fullBleed` skips the centered container (home). */
export function SiteChrome({ children, fullBleed = false }: { children: React.ReactNode; fullBleed?: boolean }) {
  return (
    <>
      <Header />
      <main className={fullBleed ? "" : "mx-auto min-h-[60vh] max-w-page px-5 py-10 sm:px-8"}>{children}</main>
      <Footer />
    </>
  );
}
