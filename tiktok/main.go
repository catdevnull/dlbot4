package tiktok

import (
	"log"
	"net/http"
	"net/url"

	"nulo.in/dlbot/common"
)

// Gracias a https://github.com/Xenzi-XN1/Tiktok-Download
// por enseñarme tikmate.app

type TikTok struct {
	http.Client
}

var Responder *TikTok = &TikTok{}

func (r *TikTok) Respond(url *url.URL) (*common.Uploadable, common.Error) {
	if url.Hostname() != "vm.tiktok.com" &&
		url.Hostname() != "tiktok.com" &&
		url.Hostname() != "www.tiktok.com" {
		return nil, common.NotValid
	}
	// tikmate no entiende tiktok.com
	url.Host = "vm.tiktok.com"

	urlString := url.String()

	lookup, err := r.lookup(urlString)
	if err != nil {
		log.Println(err)
		return nil, common.HadError
	}

	return &common.Uploadable{Url: lookup}, common.OK
}
