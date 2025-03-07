import * as cheerio from "cheerio";
import { FAKE_USER_AGENT } from "./consts";
import { fetch } from "bun";

export async function getDescription(url: string) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": FAKE_USER_AGENT },
      proxy: process.env.PROXY_URL,
    } as any);
    const html = await res.text();
    const $ = cheerio.load(html);
    return $("meta[name='description']").attr("content") || null;
  } catch (e) {
    console.warn(`Failed to get description for ${url}:`, e);
    return null;
  }
}
