package common

import (
	"net/url"
	"strings"

	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"
)

type Result uint8
type Responder interface {
	Respond(bot *tgbotapi.BotAPI, update tgbotapi.Update, url *url.URL) Result
}

const (
	NotValid Result = iota
	HadError
	Uploaded
)

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
