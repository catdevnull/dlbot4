package instagram

import (
	"log"
	"net/http"
	"net/url"
	"strings"

	"nulo.in/dlbot/common"
)

type Instagram struct {
	http.Client
}

var Responder *Instagram = &Instagram{}

func (r *Instagram) Respond(url *url.URL) (*common.Uploadable, common.Error) {
	if url.Hostname() != "instagram.com" && url.Hostname() != "www.instagram.com" {
		return nil, common.NotValid
	}
	if strings.Index(url.Path, "/reel/") != 0 && strings.Index(url.Path, "/p/") != 0 {
		return nil, common.NotValid
	}

	lookup, err := r.lookup(url.String())
	if err != nil {
		log.Println(err)
		if strings.Index(url.Path, "/p/") == 0 {
			return nil, common.NotValid
		}
		return nil, common.HadError
	}

	return &common.Uploadable{
		Url:     lookup.VideoUrl,
		Caption: "instagram.com/" + lookup.Author,
	}, common.OK
}
