package main

import (
	"log"
	"net/url"
	"os"
	"strings"

	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"
	"nulo.in/dlbot/common"
	"nulo.in/dlbot/instagram"
	"nulo.in/dlbot/tiktok"
)

type Config struct {
	Responders []common.Responder
}

func (config Config) handleMessage(bot *tgbotapi.BotAPI, update tgbotapi.Update) {
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
			continue
		}

		log.Printf("Downloading %s", url.String())

		var uploadable *common.Uploadable
		var érror common.Error
		for _, responder := range config.Responders {
			uploadable, érror = responder.Respond(url)
			if érror != common.NotValid {
				break
			}
		}

		if uploadable != nil {
			res := tgbotapi.NewVideo(update.Message.Chat.ID, tgbotapi.FileURL(uploadable.Url))
			res.ReplyToMessageID = update.Message.MessageID
			res.Caption = uploadable.Caption
			_, err := bot.Send(res)
			if err != nil {
				log.Println("Error subiendo", url.String(), err)
			}
		}

		if explicit && érror == common.NotValid {
			bot.Send(respondWithMany(msg, "La URL ", urlString, " no es compatible con este bot."))
			continue
		}

		if érror == common.HadError || érror == common.OK {
			hasDownloadables = true
		}

		if érror == common.HadError {
			bot.Send(respondWithMany(update.Message, "Hubo un error al descargar ", urlString, "."))
			continue
		}
	}
	if !hasDownloadables && explicit {
		bot.Send(respondWithMany(msg, "No encontré URLs descargables en ese mensaje."))
	}
}

func main() {
	config := Config{
		Responders: []common.Responder{
			instagram.Responder,
			tiktok.Responder,
		},
	}

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

		go config.handleMessage(bot, update)
	}
}

func respondWith(msg *tgbotapi.Message, str string) tgbotapi.MessageConfig {
	res := tgbotapi.NewMessage(msg.Chat.ID, str)
	res.ReplyToMessageID = msg.MessageID
	res.DisableWebPagePreview = true
	res.ParseMode = "markdown"
	return res
}

func respondWithMany(msg *tgbotapi.Message, s ...string) tgbotapi.MessageConfig {
	var res strings.Builder
	for _, v := range s {
		res.WriteString(v)
	}
	return respondWith(msg, res.String())
}
