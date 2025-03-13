import { $ } from "bun";
import { USER_AGENT } from "./consts";

export async function sniff(url: string) {
  try {
    const controller = new AbortController();
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch: ${response.status} ${response.statusText}`
      );
    }

    // Read only the first 512KB
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("Failed to get reader from response");
    }

    const chunks: Uint8Array[] = [];
    let bytesRead = 0;
    const MAX_SIZE = 512 * 1024; // 512KB

    try {
      while (bytesRead < MAX_SIZE) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        bytesRead += value.length;

        if (bytesRead >= MAX_SIZE) {
          // We've read enough, cancel the fetch
          controller.abort();
          break;
        }
      }
    } finally {
      reader.releaseLock();
    }

    const concatenated = new Uint8Array(bytesRead);
    let offset = 0;
    for (const chunk of chunks) {
      concatenated.set(chunk, offset);
      offset += chunk.length;
    }

    const result = await $`ffmpeg -i - -f null - < ${concatenated}`;

    const output = result.stderr.toString();
    const videoStreamMatch = output.match(/Stream #.*Video:.*, (\d+)x(\d+)/);

    if (videoStreamMatch) {
      const width = Number.parseInt(videoStreamMatch[1], 10);
      const height = Number.parseInt(videoStreamMatch[2], 10);
      return { width, height };
    }
    return null;
  } catch {
    return null;
  }
}
