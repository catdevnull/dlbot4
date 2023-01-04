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

type Responder func(bot *tgbotapi.BotAPI, update tgbotapi.Update, url *url.URL) common.Result
type Config struct {
	Responders []Responder
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
				bot.Send(common.RespondWithMany(msg, "No se pudo detectar la URL ", urlString, "."))
			}
			continue
		}

		var result common.Result
		for _, respond := range config.Responders {
			result = respond(bot, update, url)
			if result != common.NotValid {
				break
			}
		}

		if explicit && result == common.NotValid {
			bot.Send(common.RespondWithMany(msg, "La URL ", urlString, " no es compatible con este bot."))
			continue
		}

		if result == common.HadError || result == common.Uploaded {
			hasDownloadables = true
		}

		if result == common.HadError {
			bot.Send(common.RespondWithMany(update.Message, "Hubo un error al descargar ", urlString, "."))
			continue
		}
	}
	if !hasDownloadables && explicit {
		bot.Send(common.RespondWithMany(msg, "No encontré URLs descargables en ese mensaje."))
	}
}

func main() {
	config := Config{
		Responders: []Responder{
			instagram.Respond,
			tiktok.Respond,
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
