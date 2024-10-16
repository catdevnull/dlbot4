package main

import (
	"errors"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"unicode/utf16"

	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"
	"nulo.in/dlbot/common"
	"nulo.in/dlbot/instagram"
	"nulo.in/dlbot/pinterest"
	"nulo.in/dlbot/tiktok"
	"nulo.in/dlbot/youtube"
)

type Bot struct {
	Responders []common.Responder
	HTTPClient http.Client
}

type FileURL string

func (fu FileURL) NeedsUpload() bool {
	return true
}

func (fu FileURL) UploadData() (string, io.Reader, error) {
	res, err := http.Get(string(fu))
	if err != nil {
		return "", nil, errors.Join(errors.New("error while uploading FileURL"), err)
	}
	if res.StatusCode != http.StatusOK {
		return "", nil, errors.New("error while uploading FileURL: " + res.Status)
	}
	return "url.mp4", res.Body, nil
}

func (fu FileURL) SendData() string {
	panic("we")
}

func (bot Bot) handleMessage(tg *tgbotapi.BotAPI, update tgbotapi.Update) {
	var explicit bool

	send := func(c tgbotapi.Chattable) {
		_, err := tg.Send(c)
		if err != nil {
			log.Println("No pude enviar un mensaje porque", err)
		}
	}

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
		if !e.IsURL() {
			continue
		}

		// ugh https://github.com/go-telegram-bot-api/telegram-bot-api/issues/231
		text := searchMsg.Text
		utfEncodedString := utf16.Encode([]rune(text))
		runeString := utf16.Decode(utfEncodedString[e.Offset : e.Offset+e.Length])
		text = string(runeString)

		url, err := url.Parse(text)
		if err != nil {
			if explicit {
				tg.Send(respondWithMany(msg, "No se pudo detectar la URL %s.", text))
			}
			continue
		}

		log.Printf("Downloading %s", url.String())

		var uploadable *common.Uploadable
		var érror common.Error
		for _, responder := range bot.Responders {
			uploadable, érror = responder.Respond(url)
			if érror != common.NotValid {
				break
			}
		}

		if uploadable != nil {
			if uploadable.ImagesWithAudio != nil {
				var files []interface{}
				for _, u := range uploadable.ImagesWithAudio.ImageUrls {
					files = append(files,
						tgbotapi.NewInputMediaPhoto(tgbotapi.FileURL(u)),
					)
				}
				log.Println(files)
				mediaGroup := tgbotapi.NewMediaGroup(update.Message.Chat.ID, files)
				mediaGroup.ReplyToMessageID = update.Message.MessageID

				msgs, err := tg.SendMediaGroup(mediaGroup)
				if err != nil {
					log.Println("Error subiendo", url.String(), err)
					tg.Send(respondWithMany(update.Message, "Hubo un error al descargar ", url.String(), "."))
				}
				res := tgbotapi.NewAudio(update.Message.Chat.ID, FileURL(uploadable.AudioUrl))
				res.ReplyToMessageID = msgs[0].MessageID
				_, err = tg.Send(res)
				if err != nil {
					log.Println("Error subiendo", url.String(), err)
					tg.Send(respondWithMany(update.Message, "Hubo un error al descargar ", url.String(), "."))
				}
			} else {

				headResp, err := bot.HTTPClient.Head(uploadable.MediaUrl)
				if err != nil {
					log.Println("Error subiendo", url.String(), err)
					tg.Send(respondWithMany(update.Message, "Hubo un error al descargar ", url.String(), "."))
				}

				if strings.Index(headResp.Header.Get("content-type"), "image/") == 0 {
					res := tgbotapi.NewPhoto(update.Message.Chat.ID, FileURL(uploadable.MediaUrl))
					res.ReplyToMessageID = update.Message.MessageID
					res.Caption = uploadable.Caption
					_, err = tg.Send(res)
				} else {
					res := tgbotapi.NewVideo(update.Message.Chat.ID, FileURL(uploadable.MediaUrl))
					res.ReplyToMessageID = update.Message.MessageID
					res.Caption = uploadable.Caption
					_, err = tg.Send(res)
				}
				if err != nil {
					log.Println("Error subiendo", url.String(), err)
					tg.Send(respondWithMany(update.Message, uploadable.MediaUrl, " (hubo un error al descargar ", url.String(), ", pero quizás lo puedas ver con este enlace)"))
				}
			}
		}

		if explicit && érror == common.NotValid {
			tg.Send(respondWithMany(msg, "La URL ", url.String(), " no es compatible con este bot."))
			continue
		}

		if érror == common.HadError || érror == common.OK {
			hasDownloadables = true
		}

		if érror == common.HadError {
			send(respondWithMany(update.Message, "Hubo un error al descargar ", url.String(), "."))
			continue
		}
	}
	if !hasDownloadables && explicit {
		tg.Send(respondWithMany(msg, "No encontré URLs descargables en ese mensaje."))
	}
}

func main() {
	config := Bot{
		Responders: []common.Responder{
			instagram.Responder,
			tiktok.Responder,
			youtube.Responder,
			pinterest.Responder,
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

	apiEndpoint := os.Getenv("TELEGRAM_API_ENDPOINT")
	var bot *tgbotapi.BotAPI
	var err error
	if apiEndpoint == "" {
		bot, err = tgbotapi.NewBotAPI(token)
	} else {
		log.Printf("Setting endpoint to %s", apiEndpoint)
		bot, err = tgbotapi.NewBotAPIWithAPIEndpoint(token, apiEndpoint)
	}
	if err != nil {
		log.Panic(err)
	}

	bot.Debug = debug

	log.Printf("Authorized on account %s", bot.Self.UserName)

	if len(os.Args) > 1 && os.Args[1] == "logout" {
		logout := tgbotapi.LogOutConfig{}
		bot.Send(logout)
		log.Println("Logged out.")
		return
	}

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
	return res
}

func respondWithMany(msg *tgbotapi.Message, s ...string) tgbotapi.MessageConfig {
	var res strings.Builder
	for _, v := range s {
		res.WriteString(v)
	}
	return respondWith(msg, res.String())
}
