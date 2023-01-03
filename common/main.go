package common

import (
	"log"
	"net/url"
	"os"
	"strings"

	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"
)

type Config struct {
	Respond func(bot *tgbotapi.BotAPI, update tgbotapi.Update, url *url.URL) Result
}
type Result uint8

const (
	NotValid Result = iota
	HadError
	Uploaded
)

func Main(config Config) {
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

func RespondWithMany(msg *tgbotapi.Message, s ...string) tgbotapi.MessageConfig {
	var res strings.Builder
	for _, v := range s {
		res.WriteString(v)
	}
	return respondWith(msg, res.String())
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
				bot.Send(RespondWithMany(msg, "No se pudo detectar la URL ", urlString, "."))
			}
			continue
		}

		result := config.Respond(bot, update, url)

		if explicit && result == NotValid {
			bot.Send(RespondWithMany(msg, "La URL ", urlString, " no es compatible con este bot."))
			continue
		}

		if result == HadError || result == Uploaded {
			hasDownloadables = true
		}

		if result == HadError {
			bot.Send(RespondWithMany(update.Message, "Hubo un error al descargar ", urlString, "."))
			continue
		}
	}
	if !hasDownloadables && explicit {
		bot.Send(RespondWithMany(msg, "No encontré URLs descargables en ese mensaje."))
	}
}
