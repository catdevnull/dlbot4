package pinterest

import (
	"log"
	"net/http"
	"net/url"

	"nulo.in/dlbot/common"
)

type Pinterest struct {
	http.Client
}

var Responder *Pinterest = &Pinterest{}

func (r *Pinterest) Respond(url *url.URL) (*common.Uploadable, common.Error) {
	if url.Hostname() != "pin.it" {
		return nil, common.NotValid
	}
	urlString := url.String()

	cobalt := common.CobaltClient{
		Client:   &r.Client,
		Endpoint: "https://apicobalt.nulo.in"}

	lookup, err := cobalt.Lookup(urlString)
	if err != nil {
		log.Println(err)
		return nil, common.HadError
	}

	return lookup, common.OK
}
