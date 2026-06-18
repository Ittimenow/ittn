---
title: 'Сны, билеты и немного магии фронтенда'
client: 'Сказки сна'
summary: 'Кейс IT TIME NOW — Разработали лендинг с игровой механикой, анимацией и интерактивными сценариями для видео арт-балета «Сказки сна».'
industry: 'Искусство и события'
year: 2025
stack: ['PHP', 'JS', 'HTML', 'CSS', 'API']
services: ['Разработка', 'UX/UI']
featured: true
order: 9
cover: '/cases/skazki-sna-frontend/img-skazkisna-main-4x3-1.jpg'
coverVideo: '/cases/skazki-sna-frontend/video-skazkisna-main.mp4'
---

## Клиент

**Илья Старилов** — российский видеохудожник, иллюстратор, режиссер мультимедиа и основатель творческого продакшена S+AR+HIVE. Его работы сочетают цифровые технологии с традиционными формами искусства, создавая визуальные проекции и инсталляции для театра, моды и коммерческих брендов.

## Задача

Создать стильный лендинг с игровой механикой для видео арт-балета **«Сказки сна»**.

Проект должен был с первых секунд погружать зрителя в атмосферу технологичного сна, но при этом оставаться понятным: пользователь должен исследовать страницу, узнавать о постановке и без лишнего трения переходить к покупке билета.

## Результаты

- Пилотный показ успешно пройден
- Сайт посетило 28,7 тыс. пользователей
- Сгенерировано 166 видео-открыток
- В Электротеатре Станиславского 214 зрителя за 3 дня погрузились во сны

[skazkisna.ru](https://skazkisna.ru/)

## Идея

**«Сказка сна»** — путешествие в другую реальность, где знакомые с детства образы становятся новыми вдохновляющими сюжетами и превращаются в основу для впечатлений зрителей в реальной жизни.

Илья Старилов собрал профессиональную команду и привлек выдающихся актеров. В течение года команда шлифовала концепцию видео арт-балета, а к концу года была готова перейти к разработке сайта.

![Скетчи Сказки сна](/cases/skazki-sna-frontend/img-skazkisna-sketches-2.jpeg)

## Процесс

Разработанный Ильей Стариловым графический стиль **«Сказки сна»** стал визуальным воплощением перехода в иную реальность, где знакомые с детства образы трансформируются в символы будущего. Он сочетает кибер-готическую эстетику, футуристический минимализм и элементы высокой моды, создавая атмосферу технологичного сна и цифрового ритуала.

Глубокие тени, холодные металлические текстуры, псевдошрифты и абстрактные знаки формируют язык, в котором сказка предстает не как ностальгия, а как источник новых идей и эмоциональных переживаний. Этот стиль не иллюстрирует сюжет — он сам становится пространством, где фантазия встречается с виртуальной реальностью, а визуальный код превращается в самостоятельный способ повествования.

![Сказки сна элементы дизайна](/cases/skazki-sna-frontend/img-skazkisna-elements.jpeg)

Наша задача заключалась в том, чтобы адаптировать стилистику арт-балета для сайта: создать интригу и ощущение сна, но не пожертвовать понятностью интерфейса.

Мы стремились превратить взаимодействие в лёгкую игру: заинтересовать, вовлечь, вызвать желание исследовать. Для этого были придуманы эффекты — плавное перетекание текста при прокрутке, появление и исчезновение информации, словно она ускользает сквозь пальцы, — чтобы усилить ощущение движения внутри сновидения.

В процессе работы мы экспериментировали с акцентным цветом, но в итоге отказались от него — на чёрном фоне он выглядел излишне ярко и отвлекал от общего визуального настроения. Были протестированы блоки с красными и зеленоватыми оттенками, однако мы вернулись к более сдержанной палитре.

<section class="case-slider" data-case-slider aria-label="Эксперименты с цветом">
	<div class="case-slider-viewport">
		<div class="case-slider-track">
			<div class="case-slider-slide">
				<img src="/cases/skazki-sna-frontend/img-skazkisna-color-1.jpeg" alt="Эксперимент с цветовым акцентом Сказки сна" />
			</div>
			<div class="case-slider-slide">
				<img src="/cases/skazki-sna-frontend/img-skazkisna-color-2.jpeg" alt="Альтернативный цветовой акцент Сказки сна" />
			</div>
		</div>
	</div>
	<div class="case-slider-controls">
		<button class="case-slider-button case-slider-button-prev" type="button" aria-label="Предыдущий слайд">&larr;</button>
		<div class="case-slider-dots" aria-label="Навигация по слайдам">
			<button class="case-slider-dot" type="button" aria-label="Слайд 1"></button>
			<button class="case-slider-dot" type="button" aria-label="Слайд 2"></button>
		</div>
		<button class="case-slider-button case-slider-button-next" type="button" aria-label="Следующий слайд">&rarr;</button>
	</div>
</section>

<video class="case-video" autoplay loop muted playsinline>
	<source src="/cases/skazki-sna-frontend/sc-pc-skazkisna-effect.mp4" type="video/mp4" />
</video>

Одним из амбициозных этапов стало проектирование интерфейса и логики генерации уникального видеоролика для каждого пользователя. Изначальная механика позволяла создать более 120 вариантов видео, персонализированных под гостя. Из-за объема контента и сроков реализации мы упростили сценарий: пользователь по-прежнему получает именное видео после покупки билета и может легко поделиться им в соцсетях.

<section class="case-slider" data-case-slider aria-label="Интерфейсные экраны Сказки сна">
	<div class="case-slider-viewport">
		<div class="case-slider-track">
			<div class="case-slider-slide">
				<img src="/cases/skazki-sna-frontend/img-skazkisna-1.jpg" alt="Экран лендинга Сказки сна" />
			</div>
			<div class="case-slider-slide">
				<img src="/cases/skazki-sna-frontend/img-skazkisna-2.jpg" alt="Интерактивный блок лендинга Сказки сна" />
			</div>
			<div class="case-slider-slide">
				<img src="/cases/skazki-sna-frontend/img-skazkisna-3.jpg" alt="Мобильный экран лендинга Сказки сна" />
			</div>
			<div class="case-slider-slide">
				<img src="/cases/skazki-sna-frontend/img-skazkisna-4.jpg" alt="Экран видеоролика Сказки сна" />
			</div>
		</div>
	</div>
	<div class="case-slider-controls">
		<button class="case-slider-button case-slider-button-prev" type="button" aria-label="Предыдущий слайд">&larr;</button>
		<div class="case-slider-dots" aria-label="Навигация по слайдам">
			<button class="case-slider-dot" type="button" aria-label="Слайд 1"></button>
			<button class="case-slider-dot" type="button" aria-label="Слайд 2"></button>
			<button class="case-slider-dot" type="button" aria-label="Слайд 3"></button>
			<button class="case-slider-dot" type="button" aria-label="Слайд 4"></button>
		</div>
		<button class="case-slider-button case-slider-button-next" type="button" aria-label="Следующий слайд">&rarr;</button>
	</div>
</section>

<section class="case-mobile-showcase">
	<video class="case-mobile-showcase-video" autoplay loop muted playsinline>
		<source src="/cases/skazki-sna-frontend/sc-mob-skazkisna-effect-2.mp4" type="video/mp4" />
	</video>
	<div class="case-mobile-showcase-copy">
		<p>Для мобильной версии мы реализовали горизонтальную прокрутку в блоках с актёрами и организаторами — современно, динамично. Но в случае с актёрами было важно показать всех сразу — без горизонтального скролла. Актёрский состав — это гордость проекта, и пренебречь визуальным равновесием было бы, скажем так, опасно ? Особенно с учётом необходимости сохранить правильный порядок — иначе кто-нибудь из звёзд может обидеться.</p>
		<p>Также мы разработали собственный дизайн блока выбора даты и времени мероприятия, что-то там старались пыхтели… ?  Но на финальной стадии решили использовать стандартную механику от Яндекс.Афиши — она оказалась проще и привычнее для пользователя.</p>
	</div>
	<img src="/cases/skazki-sna-frontend/img-skazkisna-datapicker-2.jpeg" alt="Концепт выбора времени мероприятия" />
</section>

<section class="case-video-copy-row">
	<video autoplay loop muted playsinline poster="/cases/skazki-sna-frontend/img-skazkisna-main-4x3-1.jpg">
		<source src="/cases/skazki-sna-frontend/sc-pc-skazkisna-creators.mp4" type="video/mp4" />
	</video>
	<p>Из-за большого объёма информации об организаторах мы вынесли этот раздел в отдельное всплывающее окно — так структура страницы осталась чистой, а всё нужное осталось под рукой.</p>
</section>

А потом случилось главное: руководитель проекта попал на само мероприятие. Феерия образов, света и атмосферы оказалась настолько мощной, что мы собрали небольшой промо-ролик о том, как это было.

<video class="case-video" controls playsinline preload="metadata" poster="/cases/skazki-sna-frontend/main-skazki-sna-promo-poster.jpg">
	<source src="/cases/skazki-sna-frontend/main-skazki-sna-promo.mp4" type="video/mp4" />
</video>

## Команда

<div class="case-team">
	<div class="case-team-card">
		<img src="/cases/skazki-sna-frontend/avatar-max.jpg" alt="" />
		<h4>Менеджер проекта</h4>
		<p>Макс Юрьевич</p>
	</div>
	<div class="case-team-card">
		<img src="/cases/skazki-sna-frontend/avatar-goga.jpg" alt="" />
		<h4>Дизайнер</h4>
		<p>Гога</p>
	</div>
	<div class="case-team-card">
		<img src="/cases/skazki-sna-frontend/avatar-serg.jpg" alt="" />
		<h4>Backend разработчик</h4>
		<p>Сергей Николаевич</p>
	</div>
	<div class="case-team-card">
		<img src="/cases/skazki-sna-frontend/avatar-yarik.jpg" alt="" />
		<h4>Frontend разработчик</h4>
		<p>Ярослав Евгеньевич</p>
	</div>
</div>
