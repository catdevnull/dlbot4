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
		log.Println(err, ";falling back to cobalt")
		if strings.Index(url.Path, "/p/") == 0 {
			return nil, common.NotValid
		}
		cobalt := common.CobaltClient{
			Client:   &r.Client,
			Endpoint: "https://apicobalt.nulo.in"}

		uploadable, err := cobalt.Lookup(url.String())
		if err != nil {
			log.Println("cobalt error", err)
			return nil, common.HadError
		}
		return uploadable, common.OK
	}

	return &common.Uploadable{
		MediaUrl: lookup.VideoUrl,
		Caption:  "instagram.com/" + lookup.Author,
	}, common.OK
}
