import TelegramBot from "node-telegram-bot-api";
import { z } from "zod";
import { Readable } from "node:stream";

// https://github.com/yagop/node-telegram-bot-api/blob/master/doc/usage.md#file-options-metadata
process.env.NTBA_FIX_350 = "false";

const CobaltResult = z.discriminatedUnion("status", [
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
type CobaltResult = z.infer<typeof CobaltResult>;
type VideoQuality =
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
async function askCobalt(
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
    },
  });
  const data = await response.json();
  return CobaltResult.parse(data);
}

class Bot {
  private bot: TelegramBot;
  constructor(token: string) {
    this.bot = new TelegramBot(token, { polling: true });
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

      const cobaltResult = await askCobalt(parsedUrl.href);
      console.log(JSON.stringify(cobaltResult));
      if (cobaltResult.status === "error") {
        if (cobaltResult.error.code === "error.api.link.invalid") {
          await this.bot.sendMessage(
            chatId,
            `No puedo descargar URLs como ${parsedUrl.href}.`,
            { reply_to_message_id: msg.message_id }
          );
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
    let downloadFrom: string | Readable = downloadUrl;
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
    }
  }
}

const token = process.env.TELEGRAM_TOKEN;
if (!token) {
  console.error("No hay token de Telegram");
  process.exit(1);
}

if (process.argv[2] === "logout") {
  const bot = new TelegramBot(token, {
    polling: true,
    baseApiUrl: process.env.TELEGRAM_API_URL,
  });
  await bot.logOut();
}

new Bot(token);
