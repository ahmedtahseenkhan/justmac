import { SiteChrome } from "@/components/SiteChrome";

// Customer-facing functional pages: header + centered container + footer.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <SiteChrome>{children}</SiteChrome>;
}
