import { z } from "zod";
import { USER_AGENT } from "./consts";

export const COBALT_INSTANCES = (() => {
  const entries = process.env["COBALT_INSTANCES"]?.split(",") || [];

  const urls = entries.map((url) => url.trim()).filter((url) => url.length > 0);
  if (urls.length === 0) {
    return ["https://cobalt.izq.nulo.in"];
  }
  return urls;
})();

console.info(`Using cobalt instances: ${COBALT_INSTANCES.join(", ")}`);

// List of allowed domains for video downloads
const ALLOWED_DOMAINS = [
  "tiktok.com",
  "instagram.com",
  "twitter.com",
  "x.com",
  "youtube.com",
  "youtu.be",
  "bsky.app",
  "pin.it",
];
export function getRealUrl(url: string): string | null {
  let realUrl = url;
  realUrl = realUrl.replaceAll("ddinstagram", "instagram");
  realUrl = realUrl.replaceAll("fixupx.com", "x.com");
  realUrl = realUrl.replaceAll("fxtwitter.com", "x.com");

  try {
    const urlObj = new URL(realUrl);
    if (
      !ALLOWED_DOMAINS.some(
        (domain) =>
          urlObj.hostname === domain ||
          urlObj.hostname === `www.${domain}` ||
          urlObj.hostname.endsWith(`.${domain}`)
      )
    )
      return null;
    return realUrl;
  } catch {
    return null;
  }
}

export const CobaltResult = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("error"),
    error: z.object({
      code: z.string(),
      context: z
        .object({
          service: z.string().optional(),
          limit: z.number().optional(),
        })
        .optional(),
    }),
  }),
  z.object({
    status: z.literal("picker"),
    audio: z.string().optional(),
    audioFilename: z.string().optional(),
    picker: z.array(
      z.object({
        type: z.enum(["photo", "video", "gif"]),
        url: z.string(),
        thumb: z.string().optional(),
      })
    ),
  }),
  z.object({
    status: z.enum(["tunnel", "redirect"]),
    url: z.string(),
    filename: z.string(),
  }),
]);
export type CobaltResult = z.infer<typeof CobaltResult>;
export type VideoQuality =
  | "144"
  | "240"
  | "360"
  | "480"
  | "720"
  | "1080"
  | "1440"
  | "2160"
  | "4320"
  | "max";
export async function askCobalt(
  url: string,
  options?: {
    videoQuality?: VideoQuality;
  },
  retryWithP?: number
) {
  const retryWith = retryWithP ?? 0;

  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 10000);
    const response = await fetch(
      `${COBALT_INSTANCES[retryWith % COBALT_INSTANCES.length]}/`,
      {
        method: "POST",
        body: JSON.stringify({ url, ...options, alwaysProxy: true }),
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent": USER_AGENT,
        },
        signal: controller.signal,
      }
    );
    if (!response.ok) {
      if (response.status === 400)
        return CobaltResult.parse(await response.json());

      throw new Error(
        `Cobalt instance ${
          COBALT_INSTANCES[retryWith % COBALT_INSTANCES.length]
        } threw an error: ${response.status} (${await response.text()})`
      );
    }
    const data = await response.json();

    return CobaltResult.parse(data);
  } catch (error) {
    if (retryWith < COBALT_INSTANCES.length - 1) {
      console.warn(error, `, retrying with ${COBALT_INSTANCES[retryWith + 1]}`);
      return askCobalt(url, options, retryWith + 1);
    }
    throw error;
  }
}
