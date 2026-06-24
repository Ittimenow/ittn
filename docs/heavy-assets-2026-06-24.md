# Тяжелые файлы в production build

Дата проверки: 24 июня 2026  
Порог: файлы от 500 KB в `dist`.

## Самые тяжелые файлы

| Размер | Файл |
| ------ | ---- |
| 28.8 MB | `cases/skazki-sna-frontend/main-skazki-sna-promo.mp4` |
| 14.7 MB | `cases/perola-crm/request-manager.webm` |
| 11.0 MB | `cases/perola-crm/video-perola-main.webm` |
| 10.3 MB | `cases/gravelon-digitalization/main-gravelon-2-high-720.mp4` |
| 9.7 MB | `cases/berkut/skberkut-video-1.webm` |
| 8.4 MB | `cases/gallery-automation/screencast-elohovsky.webm` |
| 5.8 MB | `cases/wakeupmoney/wum-mob-goals.webm` |
| 5.7 MB | `cases/novogodnee-predskazanie-2024/babushka-ai.webm` |
| 5.2 MB | `cases/skazki-sna-frontend/sc-pc-skazkisna-creators.mp4` |
| 4.9 MB | `cases/gravelon-digitalization/main-gravelon-2-low-720.mp4` |
| 4.9 MB | `cases/energy-depths/de-main-page-video-fast-2.webm` |
| 4.7 MB | `cases/skazki-sna-frontend/video-skazkisna-main.mp4` |
| 3.9 MB | `cases/perola-crm/manager-brief.webm` |
| 3.8 MB | `cases/ecocaravan/klient-zayavka-s-pk-cutted.webm` |
| 3.7 MB | `cases/perola-crm/client-choice.webm` |
| 2.8 MB | `cases/wakeupmoney/wum-mob-notes.webm` |
| 2.1 MB | `main-rbs.png` |
| 2.1 MB | `cases/perola-crm/client-brief.webm` |
| 2.0 MB | `main-b24-v2.png` |
| 2.0 MB | `cases/gravelon-digitalization/main-gravelon.png` |
| 2.0 MB | `main-b24.png` |
| 1.9 MB | `cases/home-assist/main-homeassit.png` |
| 1.9 MB | `cases/skazki-sna-frontend/sc-mob-skazkisna-effect-2.mp4` |
| 1.8 MB | `cases/el-rey-digitalization/elrey-main-video-2.mp4` |
| 1.8 MB | `cases/ecocaravan/bpmn-1-ecocaravan.png` |
| 1.8 MB | `cases/skazki-sna-frontend/sc-pc-skazkisna-effect.mp4` |
| 1.7 MB | `cases/wakeupmoney/wum-project.webm` |
| 1.6 MB | `cases/wakeupmoney/wum-mob-stocks.webm` |
| 1.6 MB | `cases/wakeupmoney/wum-mob-enter.webm` |
| 1.6 MB | `cases/wakeupmoney/wum-goals.webm` |
| 1.5 MB | `cases/el-rey-digitalization/elrey-skrol-otzyvov.mp4` |
| 1.5 MB | `cases/photoreal-3d-crm/img-photoreal3d-3.png` |
| 1.5 MB | `cases/photoreal-3d-crm/img-photoreal3d-1.png` |
| 1.5 MB | `posts/agile-waterfall-impact-engineering/agile-metod.png` |
| 1.4 MB | `cases/el-rey-digitalization/elrey-zapisatsya-na-osmotr.mp4` |
| 1.4 MB | `cases/el-rey-digitalization/elrey-vybor-serii-i-kuzova.mp4` |
| 1.4 MB | `cases/el-rey-digitalization/elrey-b24.jpg` |
| 1.3 MB | `cases/wakeupmoney/wum-stocks-edit.webm` |
| 1.2 MB | `cases/wakeupmoney/wum-mob-goals.mp4` |
| 1.1 MB | `posts/trendy-crm-2026/trendy-crm-2026.png` |
| 1.1 MB | `cases/alfacase-amocrm-rbs/img-alfacases-1.jpg` |
| 1.1 MB | `posts/vnedrenie-crm-pod-kljuch/img-ittn-article-crm.png` |
| 1.0 MB | `cases/aquatron-crm/main-image-aquatron.jpeg` |
| 1.0 MB | `cases/el-rey-digitalization/elrey-poisk-neispravnosti.mp4` |
| 1.0 MB | `cases/berkut/avatar-artem.png` |
| 1.0 MB | `cases/home-assist/avatar-antonio.png` |
| 1.0 MB | `team-avatar-placeholder.png` |

## Приоритет оптимизации

1. Видео больше 5 MB: перекодировать, проверить длительность, poster, lazy loading, мобильные версии.
2. Hero PNG около 2 MB: подготовить WebP/AVIF и responsive размеры.
3. Новые локальные cover-изображения блога больше 1 MB: сжать после утверждения качества.
4. Avatar-файлы около 1 MB: заменить на маленькие WebP/AVIF, потому что это миниатюры.
