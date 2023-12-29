package tiktok

import (
	"encoding/json"
	"errors"
	"io"
	"net/url"
)

// alternativa: https://github.com/Evil0ctal/Douyin_TikTok_Download_API

type lookupResponse struct {
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

func (r *TikTok) lookup(urlS string) (string, error) {
	resp, err := r.Client.PostForm(
		"https://api.tikmate.app/api/lookup",
		url.Values{"url": {urlS}},
	)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)

	var lookup lookupResponse
	err = json.Unmarshal(body, &lookup)
	if err != nil {
		return "", err
	}
	if !lookup.Success {
		return "", errors.New(lookup.Message)
	}
	return "https://tikmate.app/download/" + lookup.Token + "/" + lookup.ID + ".mp4", nil
}
