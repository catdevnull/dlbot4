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

export const COBALT_TIMEOUT = process.env["COBALT_TIMEOUT"]
  ? Number.parseInt(process.env["COBALT_TIMEOUT"])
  : 10000;

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
  retryWithP?: number,
  retryCount: number = 0
) {
  const maxRetries = 3;
  const retryWith = retryWithP ?? 0;
  const cobaltUrl = `${COBALT_INSTANCES[retryWith % COBALT_INSTANCES.length]}/`;
  const body = { url, ...options, alwaysProxy: true };
  
  const isTikTok = url.includes("tiktok.com") || url.includes("tiktok");
  const maxAttempts = isTikTok ? maxRetries : 1;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), COBALT_TIMEOUT);
      const response = await fetch(cobaltUrl, {
        method: "POST",
        body: JSON.stringify(body),
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent": USER_AGENT,
        },
        signal: controller.signal,
      });
      
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
      const result = CobaltResult.parse(data);
      
      // For TikTok, check if we got a valid result
      if (isTikTok && result.status === "error") {
        const errorCode = result.error.code;
        // Retry on specific error codes that might be temporary
        const retryableErrors = [
          "error.api.fetch.empty",
          "error.api.fetch.timeout",
          "error.api.fetch.server_error",
          "error.api.fetch.forbidden"
        ];
        
        if (retryableErrors.some(error => errorCode.includes(error)) && attempt < maxAttempts - 1) {
          console.log(`TikTok download failed with ${errorCode}, retrying (attempt ${attempt + 2}/${maxAttempts})`);
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1))); // Exponential backoff
          continue;
        }
      }
      
      return result;
    } catch (error) {
      console.log(
        `Error while fetching ${cobaltUrl} with body ${JSON.stringify(body)} (attempt ${attempt + 1}/${maxAttempts})`
      );
      
      // If this is the last attempt for this instance, try next instance
      if (attempt === maxAttempts - 1 && retryWith < COBALT_INSTANCES.length - 1) {
        console.warn(error, `, retrying with ${COBALT_INSTANCES[retryWith + 1]}`);
        return askCobalt(url, options, retryWith + 1, 0);
      }
      
      // If we have more attempts left for this instance, continue
      if (attempt < maxAttempts - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1))); // Exponential backoff
        continue;
      }
      
      // If we've exhausted all retries for all instances, throw the error
      throw error;
    }
  }
  
  throw new Error("Max retries exceeded");
}
