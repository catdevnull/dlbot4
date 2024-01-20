Un bot para Telegram que permite descargar videos de distintos lugares.

[@dlthefourthbot](https://t.me/dlthefourthbot)

~~Es rápido ya que ni siquiera descarga el video, solo le pasa a Telegram la URL para descargarlos.~~ 2023-05-09: parece que Telegram bloquea urls de Instagram y TikMate con el error `Bad Request: wrong file identifier/HTTP URL specified`, tenemos que resubir manualmente :(

## TikTok

Previamente este bot descargaba directo de TikTok a través de distintas APIs internas, usando programas externos como yt-dlp. Lamentablemente TikTok seguía parcheando estas APIs internas, que hacía mantener un sideproject molesto. Por suerte, encontré [cobalt](https://cobalt.tools/) (antes usaba [TikMate](https://tikmate.app)) que es un sitio que los descarga por vos. Sus desarrollador(es?) que mantienen el sitio. Así, uso su API abierta y listo.

## Correr tu propio servidor de bot

El servidor de bots de Telegram por defecto (`https://api.telegram.org`) tiene un limite de subida de 50MB, y tenés que usar tu [propio servidor](https://github.com/tdlib/telegram-bot-api) para poder subir hasta 2000MB. Osea: no es necesario hacerlo, excepto que quieras que descargue videos bastante grandes.

En ./telegram-bot-api-container hay un Containerfile para hostear este servidor.

Cuando ya tengas tu propio servidor, empezá deslogeandote del oficial (no vas a poder volver a logearte por 10 minutos):

```
dlbot logout
```

Después, tenés que reiniciar dlbot con el endpoint especificado con este formato: `$endpoint/bot%s/%s"`. Un ejemplo en docker-compose:

```
  dlbot:
    image: gitea.nulo.in/nulo/dlbot4
    environment:
      TELEGRAM_TOKEN: "${DLBOT_TELEGRAM_TOKEN}"
      TELEGRAM_API_ENDPOINT: http://dlbot-telegram-bot-api:8081/bot%s/%s
    links:
      - dlbot-telegram-bot-api
  dlbot-telegram-bot-api:
    image: gitea.nulo.in/nulo/dlbot4/telegram-bot-api
    entrypoint: ["telegram-bot-api", "--api-id=$DLBOT_TELEGRAM_API_ID", "--api-hash=$DLBOT_TELEGRAM_API_HASH", "--local"]
```

~~Podés ver como está hecho en producción [en la repo de infra](https://gitea.nulo.in/Nulo/infra/commit/1067c632d203f7b7304fabd7bc4e818eb9d90386)~~ Por problemas de que se caía constantemente el coso este de telegram-bot-api, ahora no lo uso. De todas maneras ya no bajo videos en tan alta calidad así que el problema de tamaño casi nunca es un problema.
