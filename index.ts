import TelegramBot, {
  type InlineQueryResult,
  type MessageEntity,
} from "node-telegram-bot-api";
import { Readable } from "node:stream";
import { askCobalt, type CobaltResult, getRealUrl } from "./cobalt";
import { askFxtwitter } from "./fxtwitter";
import { nanoid } from "nanoid";
import pAll from "p-all";
import { USER_AGENT } from "./consts";
import { sniff } from "./sniff";
import { getDescription } from "./metadata";

// https://github.com/yagop/node-telegram-bot-api/blob/master/doc/usage.md#file-options-metadata
process.env["NTBA_FIX_350"] = "false";

const botParams = {
  polling: true,
  baseApiUrl: process.env["TELEGRAM_API_URL"],
};

async function dumpStreamFromUrl(url: string) {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok)
    throw new Error(`Failed to fetch media: ${res.status} ${res.statusText}`);
  if (!res.body) throw new Error("No body");
  return Readable.fromWeb(res.body as any);
}

class Bot {
  private bot: TelegramBot;
  private inlineQueryIdCache: Map<string, string> = new Map();
  constructor(token: string) {
    this.bot = new TelegramBot(token, botParams);
    this.bot.getMe().then((me) => {
      console.log("Bot initialized as", me.username);
    });

    this.bot.on("message", (msg: TelegramBot.Message) => {
      this.handleMessage(msg)
        .catch((error: Error) => {
          console.error("Error al manejar el mensaje:", error);
          this.bot.sendMessage(
            msg.chat.id,
            "Hubo un error al manejar el mensaje.",
            { reply_to_message_id: msg.message_id }
          );
        })
        .finally(() => Bun.gc(true));
    });
    this.bot.on("inline_query", async (query: TelegramBot.InlineQuery) => {
      try {
        if (query.query.trim() === "") {
          return await this.bot.answerInlineQuery(query.id, [
            {
              type: "article",
              id: "1",
              title: "Pega un enlace de TikTok o Instagram para descargarlo",
              description:
                "Pega un enlace de TikTok o Instagram para descargarlo",
              input_message_content: {
                message_text:
                  "Pega un enlace de TikTok o Instagram para descargarlo",
              },
            },
          ]);
        }
        const result = await askCobalt(query.query);
        console.log(JSON.stringify(result));

        if (result.status === "tunnel" || result.status === "redirect") {
          await this.bot.answerInlineQuery(query.id, [
            {
              type: "video",
              id: "1",
              video_url: result.url,
              title: result.filename,
              mime_type: "video/mp4",
              thumb_url: result.url,
            },
          ]);
        } else if (result.status === "picker") {
          const results: InlineQueryResult[] = [];

          if (result.audio) {
            results.push({
              type: "audio",
              id: Math.random().toString(),
              audio_url: result.audio,
              title: result.audioFilename || "Audio",
            });
          }

          for (const item of result.picker) {
            if (item.type === "video") {
              results.push({
                type: "video",
                id: Math.random().toString(),
                video_url: item.url,
                title: item.type,
                mime_type: "video/mp4",
                thumb_url: item.thumb || item.url,
              });
            } else {
              results.push({
                type: "photo",
                id: Math.random().toString(),
                photo_url: item.url,
                thumb_url: item.thumb || item.url,
                title: item.type,
              });
            }
          }

          console.log("Answering with results", results);

          const queryId = nanoid();
          this.inlineQueryIdCache.set(queryId, query.query);

          await this.bot.answerInlineQuery(query.id, results, {
            cache_time: 0,
            is_personal: true,
            switch_pm_text: "Descargar todo junto",
            switch_pm_parameter: queryId,
          });
        }
      } catch (error) {
        console.error("Error al manejar la consulta:", error);
      }
    });
  }

  async handleMessage(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    if (!msg.text) return;
    const isExplicit =
      msg.text.startsWith("/dl") || msg.chat.type === "private";
    const searchMsg =
      isExplicit && msg.reply_to_message ? msg.reply_to_message : msg;
    if (!searchMsg.text) return;
    const entities: (MessageEntity & { urlText?: string })[] =
      searchMsg.entities || [];

    if (searchMsg.text.startsWith("/start ")) {
      const parts = searchMsg.text.split(" ");
      const cached = this.inlineQueryIdCache.get(parts[1]);
      if (cached) {
        entities.push({
          type: "url",
          length: cached.length,
          offset: 0,
          urlText: cached,
        });
        await this.bot.sendMessage(chatId, `Descargando ${cached}...`, {
          reply_to_message_id: msg.message_id,
        });
      }
    }

    let hasDownloadables = false;

    for (const entity of entities) {
      if (entity.type !== "url") continue;

      const urlText =
        entity.urlText ||
        searchMsg.text.slice(entity.offset, entity.offset + entity.length);
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(urlText);
      } catch (error) {
        try {
          parsedUrl = new URL(`https://${urlText}`);
        } catch (error) {
          console.error(`Failed to parse URL: ${urlText}`);
          continue;
        }
      }

      const realUrl = getRealUrl(parsedUrl.href);

      // Skip non-allowed domains silently for non-explicit requests
      if (!realUrl) {
        if (isExplicit) {
          await this.bot.sendMessage(
            chatId,
            `Lo siento, pero no puedo descargar de ${parsedUrl.hostname}. Solo soporto TikTok, Instagram, Twitter/X y YouTube.`,
            { reply_to_message_id: msg.message_id }
          );
          hasDownloadables = true;
        }
        continue;
      }
      console.log(
        `Descargando ${parsedUrl.href}${
          parsedUrl.href === realUrl ? "" : ` -> ${realUrl}`
        }`
      );

      this.bot.sendChatAction(chatId, "typing");

      if (
        parsedUrl.hostname === "twitter.com" ||
        parsedUrl.hostname === "x.com"
      ) {
        try {
          const pathParts = parsedUrl.pathname.split("/");
          const statusIndex = pathParts.indexOf("status");
          if (statusIndex !== -1 && statusIndex + 1 < pathParts.length) {
            const screenName = pathParts[1];
            const tweetId = pathParts[statusIndex + 1];
            const fxResult = await askFxtwitter(screenName, tweetId);
            hasDownloadables = true;
            await this.bot.sendMessage(
              chatId,
              `${fxResult.tweet.author.name} (@${
                fxResult.tweet.author.screen_name
              }):\n<blockquote>${fxResult.tweet.text}${
                fxResult.tweet.quote
                  ? `</blockquote>\nQuoting: ${fxResult.tweet.quote.author.name} (@${fxResult.tweet.quote.author.screen_name}):\n<blockquote>${fxResult.tweet.quote.text}`
                  : ""
              }</blockquote>\nhttps://fxtwitter.com/${screenName}/status/${tweetId}`,
              { reply_to_message_id: msg.message_id, parse_mode: "HTML" }
            );
            if (fxResult.tweet.media?.all?.length) {
              await this.bot.sendMediaGroup(
                chatId,
                fxResult.tweet.media?.all?.map((media) => ({
                  type: media.type === "gif" ? "photo" : media.type,
                  media: media.url,
                  thumb: media.thumbnail_url,
                })) ?? [],
                {
                  reply_to_message_id: msg.message_id,
                }
              );
            }
            continue;
          }
        } catch (error) {
          console.error("Failed to fetch from fxtwitter:", error);
        }
      }

      const cobaltResult = await askCobalt(parsedUrl.href);
      console.log(JSON.stringify(cobaltResult));
      if (cobaltResult.status === "error") {
        if (
          // no soportamos ese servicio
          cobaltResult.error.code === "error.api.link.invalid" ||
          // no soportamos este tipo de link
          cobaltResult.error.code === "error.api.link.unsupported" ||
          // no hay nada en este link
          cobaltResult.error.code === "error.api.fetch.empty"
        ) {
          continue;
        }

        await this.bot.sendMessage(
          chatId,
          `Hubo un error al descargar ${parsedUrl.href}.`,
          { reply_to_message_id: msg.message_id }
        );
        hasDownloadables = true;
      } else if (
        cobaltResult.status === "tunnel" ||
        cobaltResult.status === "redirect"
      ) {
        this.bot.sendChatAction(chatId, "upload_video");
        await this.sendSingular(chatId, parsedUrl.href, cobaltResult, {
          replyToMessageId: msg.message_id,
        });
        hasDownloadables = true;
      } else if (cobaltResult.status === "picker") {
        this.bot.sendChatAction(chatId, "upload_photo");
        if (cobaltResult.audio) {
          await this.bot.sendAudio(
            chatId,
            await dumpStreamFromUrl(cobaltResult.audio),
            {
              reply_to_message_id: msg.message_id,
            }
          );
        }
        const description = await getDescription(parsedUrl.href);
        const mediaItems: TelegramBot.InputMedia[] = await pAll(
          cobaltResult.picker.map((item) => async () => {
            const media = (await dumpStreamFromUrl(item.url)) as any;
            if (item.type === "video")
              return { type: "video", media } as TelegramBot.InputMedia;
            if (item.type === "photo" || item.type === "gif")
              return { type: "photo", media } as TelegramBot.InputMedia;
            throw new Error(`Unsupported media type: ${item.type}`);
          }),
          { concurrency: 4 }
        );
        const mediaGroups: TelegramBot.InputMedia[][] = [];
        for (let i = 0; i < mediaItems.length; i += 10) {
          mediaGroups.push(mediaItems.slice(i, i + 10));
        }
        if (description)
          await this.bot.sendMessage(chatId, description ?? "", {
            reply_to_message_id: msg.message_id,
          });
        for (let i = 0; i < Math.min(mediaGroups.length, 15); i++) {
          await this.bot.sendMediaGroup(chatId, mediaGroups[i], {
            reply_to_message_id: i === 0 ? msg.message_id : undefined,
          });
        }
        hasDownloadables = true;
      }
    }

    if (!hasDownloadables && isExplicit) {
      await this.bot.sendMessage(
        chatId,
        "No encontré URLs descargables en ese mensaje.",
        { reply_to_message_id: msg.message_id }
      );
    }
  }

  async sendSingular(
    chatId: number,
    url: string,
    cobaltResult: CobaltResult & { status: "tunnel" | "redirect" },
    options: {
      replyToMessageId?: number;
      alreadyLowQuality?: boolean;
    }
  ): Promise<void> {
    const downloadUrl = cobaltResult.url;

    const isImage =
      cobaltResult.filename.endsWith(".jpg") ||
      cobaltResult.filename.endsWith(".png") ||
      cobaltResult.filename.endsWith(".gif");

    const [sniffedRes, description, res] = await Promise.all([
      sniff(downloadUrl),
      getDescription(url),
      fetch(downloadUrl, {
        headers: { "User-Agent": USER_AGENT },
      }),
    ]);

    if (!res.ok)
      throw new Error(`Failed to fetch media: ${res.status} ${res.statusText}`);
    try {
      await this.bot[isImage ? "sendPhoto" : "sendVideo"](
        chatId,
        Readable.fromWeb(res.body as any),
        {
          reply_to_message_id: options.replyToMessageId,
          caption: description ?? cobaltResult.filename,
          width: sniffedRes?.width,
          height: sniffedRes?.height,
        },
        {
          filename: cobaltResult.filename,
          contentType: res.headers.get("Content-Type") ?? "",
        }
      );
    } catch (e) {
      if (!options.alreadyLowQuality) {
        console.log("retrying with low quality video");
        const newCobaltResult = await askCobalt(url, {
          videoQuality: "144",
        });
        console.log(JSON.stringify(newCobaltResult));
        if (
          newCobaltResult.status === "tunnel" ||
          newCobaltResult.status === "redirect"
        ) {
          return await this.sendSingular(chatId, url, newCobaltResult, {
            ...options,
            alreadyLowQuality: true,
          });
        }
      }
      console.error(`Error al enviar el video ${downloadUrl}:`, e);
      throw e;
    } finally {
      Bun.gc(true);
    }
  }
}

const token = process.env["TELEGRAM_TOKEN"];
if (!token) {
  console.error("No hay token de Telegram");
  process.exit(1);
}

if (process.argv[2] === "logout") {
  const bot = new TelegramBot(token, botParams);
  await bot.logOut();
  process.exit(0);
}

new Bot(token);
