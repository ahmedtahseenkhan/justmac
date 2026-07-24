import { Injectable, Logger } from "@nestjs/common";

/**
 * Fetches external marketplace pages. Back Market sits behind DataDome, so plain
 * requests from a datacenter IP get 403s — production routes through a scraping
 * proxy (ScraperAPI / Zyte / Bright Data style) configured via env:
 *
 *   SCRAPER_PROXY_URL="https://api.scraperapi.com/?api_key=KEY&url={{URL}}"
 *
 * `{{URL}}` is replaced with the url-encoded target. When unset we fetch directly
 * with browser-like headers — fine for local testing, expected to be blocked in
 * production; callers surface the failure as a FETCH_ERROR snapshot, never a crash.
 */
@Injectable()
export class ScrapeFetcherService {
  private readonly logger = new Logger(ScrapeFetcherService.name);

  /**
   * `direct: true` skips the proxy — for sites that serve bots fine (Shopify JSON
   * endpoints), so proxy credits are only spent where bot protection demands it.
   */
  async fetchPage(
    url: string,
    opts: { direct?: boolean } = {},
  ): Promise<{ ok: true; html: string } | { ok: false; error: string }> {
    const proxyTemplate = opts.direct ? undefined : process.env.SCRAPER_PROXY_URL;
    const target = proxyTemplate
      ? proxyTemplate.replace("{{URL}}", encodeURIComponent(url))
      : url;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);
    try {
      const res = await fetch(target, {
        signal: controller.signal,
        headers: proxyTemplate
          ? {}
          : {
              "User-Agent":
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
              Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
              "Accept-Language": "en-US,en;q=0.9",
            },
      });
      if (!res.ok) {
        return { ok: false, error: `HTTP ${res.status}${proxyTemplate ? " (via proxy)" : ""}` };
      }
      return { ok: true, html: await res.text() };
    } catch (e) {
      const message = e instanceof Error ? (e.name === "AbortError" ? "timeout" : e.message) : "fetch failed";
      this.logger.warn(`Fetch failed for ${url}: ${message}`);
      return { ok: false, error: message };
    } finally {
      clearTimeout(timeout);
    }
  }
}
