package main

import (
	"log"
	"net/url"
	"os"
	"strings"

	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"
)

// Gracias a https://github.com/Xenzi-XN1/Tiktok-Download
// por enseñarme tikmate.app

func respondWith(msg *tgbotapi.Message, str string) tgbotapi.MessageConfig {
	res := tgbotapi.NewMessage(msg.Chat.ID, str)
	res.ReplyToMessageID = msg.MessageID
	res.DisableWebPagePreview = true
	return res
}

func respondWithMany(msg *tgbotapi.Message, s ...string) tgbotapi.MessageConfig {
	var res strings.Builder
	for _, v := range s {
		res.WriteString(v)
	}
	return respondWith(msg, res.String())
}

func handleMessage(bot *tgbotapi.BotAPI, update tgbotapi.Update) {
	var explicit bool

	msg := update.Message
	if strings.HasPrefix(msg.Text, "/dl") || msg.Chat.IsPrivate() {
		explicit = true
	}

	searchMsg := msg
	if msg.ReplyToMessage != nil && explicit {
		searchMsg = msg.ReplyToMessage
	}

	hasDownloadables := false

	for i := 0; i < len(searchMsg.Entities); i++ {
		e := searchMsg.Entities[i]
		if e.Type != "url" {
			continue
		}

		urlString := searchMsg.Text[e.Offset : e.Offset+e.Length]
		url, err := url.Parse(urlString)
		if err != nil {
			if explicit {
				bot.Send(respondWithMany(msg, "No se pudo detectar la URL ", urlString, "."))
			}
			return
		}

		if url.Hostname() != "vm.tiktok.com" {
			if explicit {
				bot.Send(respondWithMany(msg, "La URL ", urlString, " no es de TikTok."))
			}
			return
		}
		hasDownloadables = true

		log.Printf("Downloading %s", urlString)
		lookup, err := Lookup(urlString)
		if err != nil {
			bot.Send(respondWithMany(msg, "Hubo un error al descargar ", urlString, "."))
			return
		}
		log.Println(lookup)

		res := tgbotapi.NewVideo(msg.Chat.ID, *lookup)
		res.ReplyToMessageID = msg.MessageID

		// if info, err := readInfoFile(&infoPath); err != nil {
		// 	res.Caption = "Hubo un error consiguiendo el titulo de este video."
		// 	log.Println("error reading info file", err)
		// } else {
		// 	res.Caption = info.Title
		// }

		bot.Send(res)
	}
	if !hasDownloadables && explicit {
		bot.Send(respondWithMany(msg, "No encontré URLs descargables en ese mensaje."))
	}
}

func main() {
	token := os.Getenv("TELEGRAM_TOKEN")
	if token == "" {
		log.Panic("No telegram token")
	}

	var debug bool
	if os.Getenv("DEBUG") != "" {
		debug = true
	}

	bot, err := tgbotapi.NewBotAPI(token)
	if err != nil {
		log.Panic(err)
	}

	bot.Debug = debug

	log.Printf("Authorized on account %s", bot.Self.UserName)

	u := tgbotapi.NewUpdate(0)
	u.Timeout = 60

	updates := bot.GetUpdatesChan(u)

	for update := range updates {
		if update.Message == nil {
			continue
		}

		go handleMessage(bot, update)
	}
}
