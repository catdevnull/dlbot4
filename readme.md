Un bot para Telegram que permite descargar videos de distintos lugares.

[@dlthefourthbot](https://t.me/dlthefourthbot)

~~Es rápido ya que ni siquiera descarga el video, solo le pasa a Telegram la URL para descargarlos.~~ 2023-05-09: parece que Telegram bloquea urls de Instagram y TikMate con el error `Bad Request: wrong file identifier/HTTP URL specified`, tenemos que resubir manualmente :(

## TikTok

Previamente este bot descargaba directo de TikTok a través de distintas APIs internas, usando programas externos como yt-dlp. Lamentablemente TikTok seguía parcheando estas APIs internas, que hacía mantener un sideproject molesto. Por suerte, encontré [TikMate](https://tikmate.app) que es un sitio que los descarga por vos. Asumo que tiene desarrollador(es?) que mantienen el sitio. Así, uso su API interna (muy simple) y listo.
