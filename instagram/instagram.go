package instagram

import (
	"encoding/json"
	"errors"
	"io"
	"net/url"
	"path"
)

type queryResponse struct {
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

type lookupResponse struct {
	VideoUrl string
	Author   string
	Text     string
}

func (r *Instagram) lookup(urlSrc string) (lookupResponse, error) {
	urlSrcParsed, err := url.Parse(urlSrc)
	if err != nil {
		return lookupResponse{}, err
	}

	url, _ := url.Parse("https://www.instagram.com/graphql/query/?query_hash=b3055c01b4b222b8a47dc12b090e4e64")
	query := url.Query()
	query.Add("variables", "{\"shortcode\":\""+path.Base(urlSrcParsed.Path)+"\",\"child_comment_count\":3,\"fetch_comment_count\":40,\"parent_comment_count\":24,\"has_threaded_comments\":true}")
	url.RawQuery = query.Encode()

	resp, err := r.Client.Get(url.String())
	if err != nil {
		return lookupResponse{}, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)

	var response queryResponse
	err = json.Unmarshal(body, &response)
	if err != nil {
		return lookupResponse{}, err
	}
	if response.Data.ShortcodeMedia == nil {
		return lookupResponse{}, errors.New("No encontré el video.")
	}
	if response.Data.ShortcodeMedia.Type != "GraphVideo" {
		return lookupResponse{}, errors.New("Esto no es un video.")
	}
	var text string
	if len(response.Data.ShortcodeMedia.EdgeMediaToCaption.Edges) > 0 {
		text = response.Data.ShortcodeMedia.EdgeMediaToCaption.Edges[0].Node.Text
	}
	return lookupResponse{
		VideoUrl: response.Data.ShortcodeMedia.VideoUrl,
		Author:   response.Data.ShortcodeMedia.Owner.Username,
		Text:     text,
	}, nil
}
