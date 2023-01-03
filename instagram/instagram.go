package main

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"path"
)

type QueryResponse struct {
	Data struct {
		ShortcodeMedia *struct {
			Type     string `json:"__typename"`
			VideoUrl string `json:"video_url"`
			Owner    struct {
				Username string `json:"username"`
			} `json:"owner"`

			EdgeMediaToCaption struct {
				Edges []struct {
					Node struct {
						Text string `json:"text"`
					} `json:"node"`
				} `json:"edges"`
			} `json:"edge_media_to_caption"`
		} `json:"shortcode_media"`
	} `json:"data"`
}

type Response struct {
	VideoUrl string
	Author   string
	Text     string
}

func Lookup(urlSrc string) (Response, error) {
	urlSrcParsed, err := url.Parse(urlSrc)
	if err != nil {
		return Response{}, err
	}

	url, _ := url.Parse("https://www.instagram.com/graphql/query/?query_hash=b3055c01b4b222b8a47dc12b090e4e64")
	query := url.Query()
	query.Add("variables", "{\"shortcode\":\""+path.Base(urlSrcParsed.Path)+"\",\"child_comment_count\":3,\"fetch_comment_count\":40,\"parent_comment_count\":24,\"has_threaded_comments\":true}")
	url.RawQuery = query.Encode()

	resp, err := http.Get(url.String())
	if err != nil {
		return Response{}, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)

	var response QueryResponse
	err = json.Unmarshal(body, &response)
	if err != nil {
		return Response{}, err
	}
	if response.Data.ShortcodeMedia == nil {
		return Response{}, errors.New("No encontré el video.")
	}
	if response.Data.ShortcodeMedia.Type != "GraphVideo" {
		return Response{}, errors.New("Esto no es un video.")
	}
	return Response{
		VideoUrl: response.Data.ShortcodeMedia.VideoUrl,
		Author:   response.Data.ShortcodeMedia.Owner.Username,
		Text:     response.Data.ShortcodeMedia.EdgeMediaToCaption.Edges[0].Node.Text,
	}, nil
}
