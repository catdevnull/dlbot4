package instagram

import (
	"log"
	"net/url"
	"strings"

	"nulo.in/dlbot/common"

	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"
)

func Respond(bot *tgbotapi.BotAPI, update tgbotapi.Update, url *url.URL) common.Result {
	if url.Hostname() != "instagram.com" && url.Hostname() != "www.instagram.com" {
		return common.NotValid
	}
	if strings.Index(url.Path, "/reel/") != 0 {
		return common.NotValid
	}

	log.Printf("Downloading %s", url.String())
	lookup, err := lookup(url.String())
	if err != nil {
		log.Println(err)
		return common.HadError
	}
	log.Println(lookup)

	res := tgbotapi.NewVideo(update.Message.Chat.ID, tgbotapi.FileURL(lookup.VideoUrl))
	res.ReplyToMessageID = update.Message.MessageID
	res.Caption = "@" + lookup.Author
	bot.Send(res)
	return common.Uploaded
}
