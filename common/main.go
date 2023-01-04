package common

import (
	"net/url"
)

type Responder interface {
	Respond(url *url.URL) (*Uploadable, Error)
}
type Uploadable struct {
	Url     string
	Caption string
}

type Error uint8

const (
	OK Error = iota
	NotValid
	HadError
)
