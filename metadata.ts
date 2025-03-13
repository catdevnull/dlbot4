import * as cheerio from "cheerio";
import { fetch, ProxyAgent } from "undici";

const PROXY_URL = process.env["PROXY_URL"];

export async function getDescription(url: string) {
  let client: ProxyAgent | undefined;
  if (PROXY_URL) {
    client = new ProxyAgent(PROXY_URL);
  }
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; bingbot/2.0 +http://www.bing.com/bingbot.htm)",
      },
      dispatcher: client,
    });
    const html = await res.text();
    const $ = cheerio.load(html);
    return $("meta[name='description']").attr("content") || null;
  } catch (e) {
    console.warn(`Failed to get description for ${url}:`, e);
    return null;
  }
}
