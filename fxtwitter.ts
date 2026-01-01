import { z } from "zod";
import { USER_AGENT } from "./consts";

export const FxtwitterResult = z.object({
	code: z.number(),
	message: z.string(),
	tweet: z.object({
		url: z.string(),
		text: z.string(),
		created_at: z.string(),
		created_timestamp: z.number(),
		author: z.object({
			name: z.string(),
			screen_name: z.string(),
			avatar_url: z.string(),
			avatar_color: z.string().nullable(),
			banner_url: z.string(),
		}),
		replies: z.number(),
		retweets: z.number(),
		likes: z.number(),
		views: z.number(),
		color: z.string().nullable(),
		twitter_card: z.string().optional(),
		lang: z.string(),
		source: z.string(),
		replying_to: z.any(),
		replying_to_status: z.any(),
		quote: z
			.object({
				text: z.string(),
				author: z.object({
					name: z.string(),
					screen_name: z.string(),
				}),
			})
			.optional(),
		media: z
			.object({
				all: z
					.array(
						z.object({
							type: z.enum(["video", "gif", "photo"]),
							url: z.string(),
							thumbnail_url: z.string().optional(),
							width: z.number(),
							height: z.number(),
							duration: z.number().optional(),
							format: z.string().optional(),
						}),
					)
					.optional(),
				external: z
					.object({
						type: z.literal("video"),
						url: z.string(),
						height: z.number(),
						width: z.number(),
						duration: z.number(),
					})
					.optional(),
				photos: z
					.array(
						z.object({
							type: z.literal("photo"),
							url: z.string(),
							width: z.number(),
							height: z.number(),
						}),
					)
					.optional(),
				videos: z
					.array(
						z.object({
							type: z.enum(["video", "gif"]),
							url: z.string(),
							thumbnail_url: z.string(),
							width: z.number(),
							height: z.number(),
							duration: z.number(),
							format: z.string(),
						}),
					)
					.optional(),
				mosaic: z
					.object({
						type: z.literal("mosaic_photo"),
						width: z.number().optional(),
						height: z.number().optional(),
						formats: z.object({
							webp: z.string(),
							jpeg: z.string(),
						}),
					})
					.optional(),
			})
			.optional(),
	}),
});

export async function askFxtwitter(
	screenName: string,
	id: string,
	translateTo?: string,
) {
	const url = `https://api.fxtwitter.com/${screenName}/status/${id}/${translateTo}`;
	const response = await fetch(url, {
		headers: {
			"User-Agent": USER_AGENT,
		},
	});
	const json = await response.json();
	console.debug("fxtwitter res", JSON.stringify(json));
	if (response.status !== 200) {
		throw new Error(`Fxtwitter returned status ${response.status}`);
	}
	return FxtwitterResult.parse(json);
}
