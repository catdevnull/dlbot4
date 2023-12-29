package youtube

import (
	"log"
	"net/http"
	"net/url"
	"strings"

	"nulo.in/dlbot/common"
)

type YouTube struct {
	http.Client
}

var Responder *YouTube = &YouTube{}

func (r *YouTube) Respond(url *url.URL) (*common.Uploadable, common.Error) {
	if url.Hostname() != "youtube.com" &&
		url.Hostname() != "www.youtube.com" &&
		url.Hostname() != "youtu.be" {
		return nil, common.NotValid
	}
	if !strings.HasPrefix(url.Path, "/shorts") {
		return nil, common.NotValid
	}

	urlString := url.String()

	cobalt := common.CobaltClient{Client: &r.Client}

	lookup, err := cobalt.Lookup(urlString)
	if err != nil {
		log.Println(err)
		return nil, common.HadError
	}

	return lookup, common.OK
}
