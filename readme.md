Un bot para Telegram que permite descargar videos de distintos lugares.

[@dlthefourthbot](https://t.me/dlthefourthbot)

Son rápidos ya que ni siquiera descargan el video, solo le pasan a Telegram la URL para descargarlos.

## TikTok

Previamente este bot descargaba directo de TikTok a través de distintas APIs internas, usando programas externos como yt-dlp. Lamentablemente TikTok seguía parcheando estas APIs internas, que hacía mantener un sideproject molesto. Por suerte, encontré [TikMate](https://tikmate.app) que es un sitio que los descarga por vos. Asumo que tiene desarrollador(es?) que mantienen el sitio. Así, uso su API interna (muy simple) y listo.
