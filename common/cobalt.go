package common

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
)

// https://github.com/wukko/cobalt/blob/current/docs/api.md

type jsonRequest struct {
	Url string `json:"url"`
}

type jsonResponse struct {
	Status     string `json:"status"`
	Text       string `json:"text"`
	Url        string `json:"url"`
	PickerType string `json:"pickerType"`
	Picker     []struct {
		Url string `json:"url"`
	} `json:"picker"`
	AudioUrl string `json:"audio"`
}

type CobaltClient struct {
	*http.Client
}

func (c *CobaltClient) Lookup(urlS string) (*Uploadable, error) {
	jsonReq := jsonRequest{
		Url: urlS,
	}
	reqByt, err := json.Marshal(jsonReq)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest(
		"POST",
		"https://co.wuk.sh/api/json",
		bytes.NewReader(reqByt),
	)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	resp, err := c.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var jsonRes jsonResponse
	err = json.NewDecoder(resp.Body).Decode(&jsonRes)
	if err != nil {
		return nil, err
	}

	if jsonRes.Status == "error" {
		return nil, errors.New("cobalt error: " + jsonRes.Text)
	}

	if len(jsonRes.Url) > 0 {
		return &Uploadable{
			VideoUrl: jsonRes.Url,
		}, nil
	}
	if len(jsonRes.AudioUrl) > 0 && jsonRes.PickerType == "images" && len(jsonRes.Picker) > 0 {
		var imageUrls []string
		for _, i := range jsonRes.Picker {
			imageUrls = append(imageUrls, i.Url)
		}

		return &Uploadable{
			ImagesWithAudio: &ImagesWithAudio{
				AudioUrl:  jsonRes.AudioUrl,
				ImageUrls: imageUrls,
			},
		}, nil
	}

	return nil, errors.New("Faltan datos de cobalt")
}
