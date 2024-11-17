import TelegramBot from "node-telegram-bot-api";
import { Readable, type Stream } from "stream";
import { z } from "zod";
import { askCobalt, CobaltResult } from "./cobalt";
import { askFxtwitter } from "./fxtwitter";

// https://github.com/yagop/node-telegram-bot-api/blob/master/doc/usage.md#file-options-metadata
process.env.NTBA_FIX_350 = "false";

const botParams = {
  polling: true,
  baseApiUrl: process.env.TELEGRAM_API_URL,
};

class Bot {
  private bot: TelegramBot;
  constructor(token: string) {
    this.bot = new TelegramBot(token, botParams);
    this.bot.getMe().then((me) => {
      console.log("Bot initialized as", me.username);
    });

    this.bot.on("message", (msg: TelegramBot.Message) => {
      this.handleMessage(msg).catch((error: Error) => {
        console.error("Error al manejar el mensaje:", error);
        this.bot.sendMessage(
          msg.chat.id,
          `Hubo un error al manejar el mensaje.`,
          { reply_to_message_id: msg.message_id }
        );
      });
    });
  }

  async handleMessage(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    if (!msg.text) return;
    const isExplicit =
      msg.text.startsWith("/dl") || msg.chat.type === "private";
    let searchMsg =
      isExplicit && msg.reply_to_message ? msg.reply_to_message : msg;
    if (!searchMsg.text) return;
    const entities = searchMsg.entities || [];

    let hasDownloadables = false;

    for (const entity of entities) {
      if (entity.type !== "url") continue;

      const urlText = searchMsg.text.slice(
        entity.offset,
        entity.offset + entity.length
      );
      let parsedUrl;
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

      console.log(`Descargando ${parsedUrl.href}`);

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
        await this.sendSingular(chatId, parsedUrl.href, cobaltResult, {
          replyToMessageId: msg.message_id,
        });
        hasDownloadables = true;
      } else if (cobaltResult.status === "picker") {
        const mediaGroup: TelegramBot.InputMedia[] = cobaltResult.picker.map(
          (item) => ({
            type: item.type === "gif" ? "photo" : item.type,
            media: item.url,
            thumb: item.thumb,
          })
        );
        await this.bot.sendMediaGroup(chatId, mediaGroup, {
          reply_to_message_id: msg.message_id,
        });
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
    let downloadFrom: string | Stream = downloadUrl;
    let contentType: string | undefined;
    if (downloadUrl.includes("cdninstagram.com")) {
      // proxy instead because Telegram blocks instagram.com domains
      const res = await fetch(downloadUrl);
      downloadFrom = res.body ? Readable.fromWeb(res.body as any) : downloadUrl;
      contentType = res.headers.get("content-type") ?? undefined;
    }
    try {
      await this.bot.sendVideo(
        chatId,
        downloadFrom,
        {
          reply_to_message_id: options.replyToMessageId,
          caption: cobaltResult.filename,
        },
        {
          filename: cobaltResult.filename,
          contentType,
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

const token = process.env.TELEGRAM_TOKEN;
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
