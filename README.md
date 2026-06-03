# IT Time Now site

Astro-сайт IT Time Now: корпоративные страницы, услуги, кейсы, блог, лендинги Bitrix24 и РосБизнесСофт, дизайн-система и служебные страницы.

## Правило для ИИ-агентов

Если появляется новая страница, маршрут или новый content-файл, который создает публичную страницу, обязательно обновляйте этот README в этом же изменении.

Обновлять нужно:

- карту маршрутов в разделе `Маршруты`;
- список страниц в разделе `Страницы`;
- связанные компоненты или content-коллекции, если страница добавляет новую архитектурную зону;
- примечания для ИИ, если у страницы есть особая логика, отдельный лендинг или нестандартные ассеты.

Новая страница считается появившейся, если добавлен файл в `src/pages/**` или добавлен markdown-файл в `src/content/{services,cases,posts}/`, который рендерится динамическим маршрутом.

## Команды

| Команда | Действие |
| :-- | :-- |
| `npm install` | Установить зависимости |
| `npm run dev` | Запустить локальный dev-сервер Astro |
| `npm run build` | Собрать production-версию в `dist/` |
| `npm run preview` | Локально проверить production-сборку |
| `npm run astro ...` | Запустить Astro CLI |

## Тестовый домен и индексация

Текущий тестовый домен: `https://ittimenow-ittn-27f0.twc1.net/`.

Пока сайт размещен на тестовом домене, индексация закрыта:

- `astro.config.mjs` использует тестовый домен в `site`, чтобы canonical и OG URL не указывали на production;
- `public/robots.txt` запрещает обход всего сайта для всех user-agent;
- `src/layouts/Layout.astro` добавляет `noindex,nofollow` в HTML всех страниц;
- `public/_headers` добавляет `X-Robots-Tag` для хостингов, которые поддерживают этот файл.

Перед переводом на production-домен нужно заменить `site` на production URL и снять временные запреты индексации.

## Архитектура

```text
/
├── public/
│   ├── clients/                 # Логотипы клиентов
│   ├── fonts/                   # Локальные шрифты
│   ├── textures/earth/          # Текстуры для 3D Earth
│   ├── favicon.svg
│   ├── favicon.ico
│   ├── main-b24.png
│   ├── main-b24-v2.png
│   └── main-rbs.png
├── src/
│   ├── components/              # Повторно используемые Astro-компоненты
│   ├── content/                 # Markdown-контент коллекций
│   │   ├── cases/
│   │   ├── posts/
│   │   └── services/
│   ├── layouts/
│   │   └── Layout.astro         # Общий HTML layout, header/footer/theme init
│   ├── pages/                   # Файловые маршруты Astro
│   ├── styles/
│   │   └── global.css
│   └── content.config.ts        # Схемы content collections
├── astro.config.mjs
├── package.json
└── tsconfig.json
```

## Маршруты

| URL | Источник | Назначение |
| :-- | :-- | :-- |
| `/` | `src/pages/index.astro` | Главная страница |
| `/about` | `src/pages/about.astro` | О компании |
| `/services` | `src/pages/services/index.astro` | Каталог услуг из `src/content/services` |
| `/services/:slug` | `src/pages/services/[...slug].astro` | Динамические страницы услуг |
| `/services/bitrix24` | `Bitrix24Landing.astro` через `services/[...slug].astro` | Отдельный лендинг Bitrix24 |
| `/services/rbs` | `RbsLanding.astro` через `services/[...slug].astro` | Отдельный лендинг РосБизнесСофт |
| `/cases` | `src/pages/cases/index.astro` | Каталог кейсов из `src/content/cases` |
| `/cases/:slug` | `src/pages/cases/[...slug].astro` | Динамическая страница кейса |
| `/posts` | `src/pages/posts/index.astro` | Список постов из `src/content/posts` |
| `/posts/:slug` | `src/pages/posts/[...slug].astro` | Динамическая страница поста |
| `/icons` | `src/pages/icons.astro` | Список и описания иконок сайта |
| `/ds2` | `src/pages/ds2.astro` | Витрина дизайн-системы DS2 |
| `/b24new` | `src/pages/b24new.astro` | Альтернативный лендинг Bitrix24 |
| `/codebg` | `src/pages/codebg.astro` | Экспериментальная shader-страница |
| `/codegame` | `src/pages/codegame.astro` | Экспериментальная shader/game-страница |
| `/earth-test` | `src/pages/earth-test.astro` | Тестовая 3D Earth-страница |

## Страницы

### Основные

- `src/pages/index.astro` собирает главную из `Hero`, `DirectionsGrid`, `CasesPreview`, `ConsultationForm`, `Stats`, `TechStack`, `ClientLogos`, `PartnersGrid`.
- `src/pages/about.astro` содержит статический контент о компании.
- `src/pages/services/index.astro` группирует услуги по `group` из content collection.
- `src/pages/cases/index.astro` и `src/pages/posts/index.astro` строят списки из content collections.

### Динамические

- `src/pages/services/[...slug].astro` рендерит markdown услуг, кроме специальных slug:
  - `bitrix24` рендерит `src/components/Bitrix24Landing.astro`;
  - `rbs` рендерит `src/components/RbsLanding.astro`.
- `src/pages/cases/[...slug].astro` рендерит кейсы из `src/content/cases`.
- `src/pages/posts/[...slug].astro` рендерит посты из `src/content/posts`.

### Служебные и экспериментальные

- `src/pages/icons.astro` документирует иконки сайта.
- `src/pages/ds2.astro` показывает дизайн-систему, UI-паттерны, формы, карточки и Bitrix24-паттерны.
- `src/pages/b24new.astro` хранит альтернативную версию лендинга Bitrix24.
- `src/pages/codebg.astro`, `src/pages/codegame.astro`, `src/pages/earth-test.astro` используются для визуальных экспериментов.

## Контент

Content collections описаны в `src/content.config.ts`.

| Коллекция | Папка | Динамический маршрут | Назначение |
| :-- | :-- | :-- | :-- |
| `services` | `src/content/services` | `/services/:slug` | Услуги и метаданные каталога |
| `cases` | `src/content/cases` | `/cases/:slug` | Кейсы |
| `posts` | `src/content/posts` | `/posts/:slug` | Блог |

Важно: добавление markdown-файла в эти папки может создать новую публичную страницу. После такого изменения обновите этот README.

## Ключевые компоненты

| Компонент | Назначение |
| :-- | :-- |
| `Layout.astro` | Общий layout, meta, header, footer, тема |
| `Header.astro` | Навигация, меню услуг, mobile menu |
| `Footer.astro` | Футер и ссылки |
| `ThemeToggle.astro` | Переключатель светлой/темной темы |
| `UiIcon.astro` | Inline SVG-набор иконок |
| `Bitrix24Landing.astro` | Основной лендинг `/services/bitrix24` |
| `RbsLanding.astro` | Основной лендинг `/services/rbs` |
| `ConsultationForm.astro` | Форма консультации |
| `CasesPreview.astro` | Превью кейсов на главной |
| `ClientLogos.astro` | Логотипы клиентов |

## Ассеты

- Изображения лендингов: `public/main-b24.png`, `public/main-b24-v2.png`, `public/main-rbs.png`.
- Логотипы клиентов: `public/clients/`.
- Текстуры Земли: `public/textures/earth/`.
- Favicon: `public/favicon.svg`, `public/favicon.ico`.

## Примечания для ИИ

- Перед изменениями проверяйте текущие файлы, потому что в рабочем дереве могут быть незакоммиченные изменения пользователя.
- Не откатывайте чужие изменения без явной просьбы.
- Для новых публичных страниц сразу добавляйте маршрут в `Маршруты` и описание в `Страницы`.
- Для новых content-файлов в `services`, `cases` или `posts` обновляйте соответствующие разделы, если меняется публичная карта сайта или архитектурная логика.
- Для новых иконок обновляйте `src/components/UiIcon.astro` и страницу `/icons`, если она используется как документация иконок.
