# Изображения с пустым alt на утверждение

Дата проверки: 24 июня 2026  
Источник: production build `dist` после удаления технических страниц.

После шаблонных правок осталось 32 изображения с `alt=""`. Все они относятся к avatar-изображениям внутри кейсов. Нужно решить: если аватар дублирует рядом стоящее имя участника, оставляем `alt=""`; если изображение несет самостоятельный смысл, добавляем текст.

| URL | Изображение | Рекомендация |
| --- | ----------- | ------------ |
| `/cases/alfacase-amocrm-rbs/` | `/cases/alfacase-amocrm-rbs/avatar-max.jpg` | Утвердить: декоративное или `Фото участника проекта` |
| `/cases/alfacase-amocrm-rbs/` | `/cases/alfacase-amocrm-rbs/avatar-serg.jpg` | Утвердить: декоративное или `Фото участника проекта` |
| `/cases/el-rey-digitalization/` | `/cases/el-rey-digitalization/avatar-sasha.jpg` | Утвердить: декоративное или `Фото участника проекта` |
| `/cases/el-rey-digitalization/` | `/cases/el-rey-digitalization/avatar-oleg.jpg` | Утвердить: декоративное или `Фото участника проекта` |
| `/cases/el-rey-digitalization/` | `/cases/el-rey-digitalization/avatar-serg.jpg` | Утвердить: декоративное или `Фото участника проекта` |
| `/cases/el-rey-digitalization/` | `/cases/el-rey-digitalization/avatar-serg.jpg` | Дубликат изображения; утвердить один подход |
| `/cases/el-rey-digitalization/` | `/cases/el-rey-digitalization/avatar-yarik.jpg` | Утвердить: декоративное или `Фото участника проекта` |
| `/cases/gallery-automation/` | `/cases/gallery-automation/avatar-max.jpg` | Утвердить: декоративное или `Фото участника проекта` |
| `/cases/gravelon-digitalization/` | `/cases/gravelon-digitalization/avatar-sasha.jpg` | Утвердить: декоративное или `Фото участника проекта` |
| `/cases/gravelon-digitalization/` | `/cases/gravelon-digitalization/avatar-oleg.jpg` | Утвердить: декоративное или `Фото участника проекта` |
| `/cases/gravelon-digitalization/` | `/cases/gravelon-digitalization/avatar-serg.jpg` | Утвердить: декоративное или `Фото участника проекта` |
| `/cases/gravelon-digitalization/` | `/cases/gravelon-digitalization/avatar-anton.jpg` | Утвердить: декоративное или `Фото участника проекта` |
| `/cases/gravelon-digitalization/` | `/cases/gravelon-digitalization/avatar-yarik.jpg` | Утвердить: декоративное или `Фото участника проекта` |
| `/cases/home-assist-service-crm/` | `/cases/home-assist/avatar-max.jpg` | Утвердить: декоративное или `Фото участника проекта` |
| `/cases/home-assist-service-crm/` | `/cases/home-assist/avatar-antonio.png` | Утвердить: декоративное или `Фото участника проекта` |
| `/cases/home-assist-service-crm/` | `/cases/home-assist/avatar-serg.jpg` | Утвердить: декоративное или `Фото участника проекта` |
| `/cases/home-assist-service-crm/` | `/cases/home-assist/avatar-yarik.jpg` | Утвердить: декоративное или `Фото участника проекта` |
| `/cases/novogodnee-predskazanie-2024/` | `/cases/skazki-sna-frontend/avatar-max.jpg` | Утвердить: декоративное или `Фото участника проекта` |
| `/cases/novogodnee-predskazanie-2024/` | `/cases/skazki-sna-frontend/avatar-yarik.jpg` | Утвердить: декоративное или `Фото участника проекта` |
| `/cases/novogodnee-predskazanie-2024/` | `/team-avatar-placeholder.png` | Лучше оставить декоративным, если рядом есть имя |
| `/cases/novogodnee-predskazanie-2024/` | `/cases/skazki-sna-frontend/avatar-serg.jpg` | Утвердить: декоративное или `Фото участника проекта` |
| `/cases/novogodnee-predskazanie-2024/` | `/cases/berkut/avatar-artem.png` | Утвердить: декоративное или `Фото участника проекта` |
| `/cases/perola-crm/` | `/cases/perola-crm/avatar-max.jpg` | Утвердить: декоративное или `Фото участника проекта` |
| `/cases/perola-crm/` | `/cases/perola-crm/avatar-max.jpg` | Дубликат изображения; утвердить один подход |
| `/cases/perola-crm/` | `/cases/perola-crm/avatar-serg.jpg` | Утвердить: декоративное или `Фото участника проекта` |
| `/cases/perola-crm/` | `/cases/perola-crm/avatar-yarik.jpg` | Утвердить: декоративное или `Фото участника проекта` |
| `/cases/photoreal-3d-crm/` | `/cases/photoreal-3d-crm/avatar-max.jpg` | Утвердить: декоративное или `Фото участника проекта` |
| `/cases/photoreal-3d-crm/` | `/cases/photoreal-3d-crm/avatar-oleg.jpg` | Утвердить: декоративное или `Фото участника проекта` |
| `/cases/skazki-sna-frontend/` | `/cases/skazki-sna-frontend/avatar-max.jpg` | Утвердить: декоративное или `Фото участника проекта` |
| `/cases/skazki-sna-frontend/` | `/cases/skazki-sna-frontend/avatar-goga.jpg` | Утвердить: декоративное или `Фото участника проекта` |
| `/cases/skazki-sna-frontend/` | `/cases/skazki-sna-frontend/avatar-serg.jpg` | Утвердить: декоративное или `Фото участника проекта` |
| `/cases/skazki-sna-frontend/` | `/cases/skazki-sna-frontend/avatar-yarik.jpg` | Утвердить: декоративное или `Фото участника проекта` |
