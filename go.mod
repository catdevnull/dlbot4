module nulo.in/dlbot

go 1.21

require (
	github.com/go-telegram-bot-api/telegram-bot-api/v5 v5.5.1
	nulo.in/dlbot/common v0.0.0-00010101000000-000000000000
	nulo.in/dlbot/instagram v0.0.0-00010101000000-000000000000
	nulo.in/dlbot/tiktok v0.0.0-00010101000000-000000000000
	nulo.in/dlbot/youtube v0.0.0-00010101000000-000000000000
	nulo.in/dlbot/pinterest v0.0.0-00010101000000-000000000000
)

replace nulo.in/dlbot/common => ./common

replace nulo.in/dlbot/instagram => ./instagram

replace nulo.in/dlbot/tiktok => ./tiktok

replace nulo.in/dlbot/youtube => ./youtube

replace nulo.in/dlbot/pinterest => ./pinterest
