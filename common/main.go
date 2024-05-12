package common

import (
	"net/url"
)

type Responder interface {
	Respond(url *url.URL) (*Uploadable, Error)
}
type Uploadable struct {
	MediaUrl string
	*ImagesWithAudio
	Caption string
}
type ImagesWithAudio struct {
	ImageUrls []string
	AudioUrl  string
}

type Error uint8

const (
	OK Error = iota
	NotValid
	HadError
)
