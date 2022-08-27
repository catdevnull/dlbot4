package main

import (
	"encoding/json"
	"io"
	"log"
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

func (lookup LookupResponse) NeedsUpload() bool { return true }
func (lookup LookupResponse) UploadData() (string, io.Reader, error) {
	resp, err := http.Get("https://tikmate.app/download/" + lookup.Token + "/" + lookup.ID + ".mp4?hd=1")
	if err != nil {
		return "", nil, err
	}
	return lookup.AuthorName, resp.Body, nil

}
func (lookup LookupResponse) SendData() string {
	log.Panicln("SendData called")
	return ""
}

func Lookup(urlS string) (*LookupResponse, error) {
	resp, err := http.PostForm(
		"https://api.tikmate.app/api/lookup",
		url.Values{"url": {urlS}},
	)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)

	var response LookupResponse
	err = json.Unmarshal(body, &response)
	if err != nil {
		return nil, err
	}
	return &response, nil
}
