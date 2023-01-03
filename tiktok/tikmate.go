package main

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
)

type LookupResponse struct {
	AuthorAvatar string `json:"author_avatar"`
	AuthorID     string `json:"author_id"`
	AuthorName   string `json:"author_name"`
	CommentCount int    `json:"comment_count"`
	CreateTime   string `json:"create_time"`
	ID           string `json:"id"`
	LikeCount    int    `json:"like_count"`
	ShareCount   int    `json:"share_count"`
	Success      bool   `json:"success"`
	Message      string `json:"message"`
	Token        string `json:"token"`
}

func Lookup(urlS string) (string, error) {
	resp, err := http.PostForm(
		"https://api.tikmate.app/api/lookup",
		url.Values{"url": {urlS}},
	)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)

	var lookup LookupResponse
	err = json.Unmarshal(body, &lookup)
	if err != nil {
		return "", err
	}
	if !lookup.Success {
		return "", errors.New(lookup.Message)
	}
	return "https://tikmate.app/download/" + lookup.Token + "/" + lookup.ID + ".mp4?hd=1", nil
}
