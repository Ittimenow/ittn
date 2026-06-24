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

## Технологический стек

- Astro 6: файловый роутинг, статическая сборка, layouts, content collections и `astro:transitions`.
- TypeScript: конфигурация content collections и типизация Astro props.
- Tailwind CSS 4: подключен через Vite-плагин `@tailwindcss/vite`.
- Three.js: используется в экспериментальных WebGL/3D-страницах.
- Markdown: контент услуг, кейсов и блога хранится в `src/content`.
- npm и Node.js `>=22.12.0`: пакетный менеджер и минимальная версия runtime указаны в `package.json`.

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
│   ├── components/              # Повторно используемые Astro-компоненты и секции
│   ├── content/                 # Markdown-контент коллекций
│   │   ├── cases/
│   │   ├── posts/
│   │   └── services/
│   ├── layouts/
│   │   └── Layout.astro         # Общий HTML layout, header/footer/theme init
│   ├── pages/                   # Файловые маршруты Astro
│   ├── styles/
│   │   └── global.css           # Tailwind CSS 4, DS-токены, темы и глобальные стили
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
| `/ds` | `src/pages/ds.astro` | Витрина дизайн-системы DS |
| `/b24new` | `src/pages/b24new.astro` | Альтернативный лендинг Bitrix24 |
| `/codebg` | `src/pages/codebg.astro` | Экспериментальная shader-страница |
| `/codegame` | `src/pages/codegame.astro` | Экспериментальная shader/game-страница |
| `/earth-test` | `src/pages/earth-test.astro` | Тестовая 3D Earth-страница |

## Страницы

### Основные

- `src/pages/index.astro` собирает главную из `Hero`, `AudienceSegments`, `BusinessTasks`, `DirectionsGrid`, `PlatformChooser`, `BusinessOutcomes`, `CasesPreview`, `TrustReasons`, `ClientLogos`, `WorkProcess`, `TechStack`, `ConsultationForm`.
- `src/pages/about.astro` содержит статический контент о компании.
- `src/pages/services/index.astro` группирует услуги по `group` из content collection.
- `src/pages/cases/index.astro` и `src/pages/posts/index.astro` строят списки из content collections.

### Динамические

- `src/pages/services/[...slug].astro` рендерит markdown услуг, кроме специальных slug:
  - `bitrix24` рендерит `src/components/Bitrix24Landing.astro`;
  - `rbs` рендерит `src/components/RbsLanding.astro`.
- `src/pages/cases/[...slug].astro` рендерит кейсы из `src/content/cases`.
- `src/pages/posts/[...slug].astro` рендерит недрафтовые посты из `src/content/posts`.

### Служебные и экспериментальные

- `src/pages/icons.astro` документирует иконки сайта.
- `src/pages/ds.astro` показывает дизайн-систему, UI-паттерны, формы, карточки и Bitrix24-паттерны.
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

### Как добавлять новые кейсы

Чтобы новый кейс появился в разделе `/cases` и, при необходимости, на главной странице:

1. Создайте markdown-файл в `src/content/cases/`.
   - Имя файла становится slug страницы.
   - Например: `src/content/cases/new-client-crm.md` создаст страницу `/cases/new-client-crm/`.

2. Заполните frontmatter по схеме из `src/content.config.ts`.

```md
---
title: 'Название кейса'
client: 'Клиент'
summary: 'Короткое описание для карточек и meta description.'
industry: 'Отрасль'
year: 2026
stack: ['CRM', 'API', 'Интеграция']
services: ['Автоматизация', 'Разработка']
featured: true
order: 7
cover: '/cases/new-client-crm/cover.jpg'
---

## Задача

Что нужно было решить.

## Решение

Что сделали.

## Результаты

- Измеримый результат
- Что изменилось для клиента
```

Обязательные поля: `title`, `client`, `summary`.

Необязательные, но рекомендуемые поля:

- `industry` и `year` показываются в карточках и в шапке страницы кейса.
- `stack` показывает теги технологий.
- `services` хранит связанные направления работ.
- `order` управляет сортировкой: чем больше число, тем выше кейс в списках.
- `cover` показывает обложку на странице кейса.

3. Чтобы кейс появился в общем разделе `/cases`, достаточно добавить файл в `src/content/cases/`.
   Страница `src/pages/cases/index.astro` автоматически берет все кейсы из коллекции и сортирует их по `order`.

4. Чтобы кейс появился на главной странице, поставьте `featured: true`.
   Компонент `src/components/CasesPreview.astro` показывает только featured-кейсы, сортирует их по `order` и выводит максимум 5 карточек.

5. Если featured-кейс должен показывать на главной блоки `Задача` и `Результат`, добавьте его slug в объект `details` внутри `src/components/CasesPreview.astro`.

```ts
const details = {
	'new-client-crm': {
		task: 'краткая формулировка задачи',
		result: 'краткая формулировка результата',
	},
};
```

6. Если у кейса есть изображения, положите их в `public/cases/<slug>/`.
   В markdown и frontmatter используйте публичные пути от корня сайта:

```md
cover: '/cases/new-client-crm/cover.jpg'

![Описание изображения](/cases/new-client-crm/screen-1.jpg)
```

7. После добавления кейса проверьте:

- `npm run build` — схема frontmatter валидна и страницы собираются;
- `/cases` — кейс есть в общем списке;
- `/cases/<slug>/` — страница открывается;
- `/` — кейс появился в блоке главной, если стоит `featured: true`.

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
| `AudienceSegments.astro` | Сегменты аудитории на главной |
| `BusinessTasks.astro` | Блок бизнес-задач на главной |
| `DirectionsGrid.astro` | Направления услуг на главной |
| `PlatformChooser.astro` | Блок выбора платформы |
| `BusinessOutcomes.astro` | Блок бизнес-результатов |
| `CasesPreview.astro` | Превью кейсов на главной |
| `TrustReasons.astro` | Блок причин доверия |
| `ClientLogos.astro` | Логотипы клиентов |
| `WorkProcess.astro` | Этапы работы |
| `TechStack.astro` | Технологии и платформы |
| `ConsultationCta.astro` | CTA-блок для консультации |

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
