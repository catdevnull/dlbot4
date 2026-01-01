import * as cheerio from "cheerio";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const PROXY_URL = process.env["PROXY_URL"];

export interface DescriptionResult {
  description: string | null;
  aiDescription?: string | null;
}

export async function getDescription(url: string): Promise<DescriptionResult> {
  try {
    const proxyArgs = PROXY_URL ? ["-x", PROXY_URL] : [];
    // https://perishablepress.com/list-all-user-agents-top-search-engines/
    let userAgent =
      "Mozilla/5.0 (compatible; bingbot/2.0 +http://www.bing.com/bingbot.htm)";
    if (url.includes("tiktok.com")) {
      userAgent = "facebookexternalhit/1.1";
    }

    const userAgentArgs = ["-A", userAgent];
    const html = await execFileAsync(
      "curl",
      ["-s", ...proxyArgs, ...userAgentArgs, url],
      {
        maxBuffer: 1024 * 1024 * 10,
      },
    );

    const $ = cheerio.load(html.stdout);

    // For Instagram, extract the caption from og:title since the description
    // meta tag contains AI-generated summaries instead of the actual caption
    if (url.includes("instagram.com")) {
      const ogTitle = $("meta[property='og:title']").attr("content");
      // og:title format: "Username on Instagram: "caption"" (note: uses curly quotes)
      const match = ogTitle?.match(/on Instagram: [""](.*)[""]$/s);
      const aiDescription =
        $("meta[name='description']").attr("content") || null;
      if (match) {
        return { description: match[1] || null, aiDescription };
      }
      return { description: null, aiDescription };
    }

    // For TikTok, extract from og:description since there's no standard description meta tag
    if (url.includes("tiktok.com")) {
      return {
        description:
          $("meta[property='og:description']").attr("content") || null,
      };
    }

    return {
      description: $("meta[name='description']").attr("content") || null,
    };
  } catch (e) {
    console.warn(`Failed to get description for ${url}:`, e);
    return { description: null };
  }
}
