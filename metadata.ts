import * as cheerio from "cheerio";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const PROXY_URL = process.env["PROXY_URL"];

export async function getDescription(url: string) {
  try {
    const proxyArgs = PROXY_URL ? ["-x", PROXY_URL] : [];
    // https://perishablepress.com/list-all-user-agents-top-search-engines/
    let userAgent =
      "Mozilla/5.0 (compatible; bingbot/2.0 +http://www.bing.com/bingbot.htm)";
    if (url.includes("tiktok.com")) {
      userAgent =
        "Mozilla/5.0 (iPhone; CPU iPhone OS 8_1 like Mac OS X) AppleWebKit/600.1.4 (KHTML, like Gecko) Version/8.0 Mobile/12B411 Safari/600.1.4 (compatible; YandexBot/3.0; +http://yandex.com/bots)";
    }

    const userAgentArgs = ["-A", userAgent];
    const html = await execFileAsync("curl", [
      "-s",
      ...proxyArgs,
      ...userAgentArgs,
        url,
      ],
      {
        maxBuffer: 1024 * 1024 * 10,
      }
    );

    const $ = cheerio.load(html.stdout);
    return $("meta[name='description']").attr("content") || null;
  } catch (e) {
    console.warn(`Failed to get description for ${url}:`, e);
    return null;
  }
}
