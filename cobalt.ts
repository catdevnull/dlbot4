import { z } from "zod";
import { USER_AGENT } from "./consts";

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
  }
) {
  const response = await fetch(`https://dorsiblancoapicobalt.nulo.in/`, {
    method: "POST",
    body: JSON.stringify({ url, ...options }),
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": USER_AGENT,
    },
  });
  const data = await response.json();
  return CobaltResult.parse(data);
}
