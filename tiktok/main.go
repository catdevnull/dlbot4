package main

import (
	"log"
	"net/url"

	"nulo.in/dlbot/common"

	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"
)

// Gracias a https://github.com/Xenzi-XN1/Tiktok-Download
// por enseñarme tikmate.app

func respond(bot *tgbotapi.BotAPI, update tgbotapi.Update, url *url.URL) common.Result {
	if url.Hostname() != "vm.tiktok.com" && url.Hostname() != "tiktok.com" {
		return common.NotValid
	}
	urlString := url.String()

	// tikmate no entiende tiktok.com
	url.Host = "vm.tiktok.com"

	log.Printf("Downloading %s", urlString)
	lookup, err := Lookup(url.String())
	if err != nil {
		log.Println(err)
		return common.HadError
	}
	log.Println(lookup)

	res := tgbotapi.NewVideo(update.Message.Chat.ID, tgbotapi.FileURL(lookup))
	res.ReplyToMessageID = update.Message.MessageID
	bot.Send(res)
	return common.Uploaded
}

func main() {
	common.Main(common.Config{Respond: respond})
}
