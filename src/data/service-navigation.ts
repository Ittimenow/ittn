import { aiServices } from './ai-services';

export const serviceGroups = [
	{
		title: 'Разработка',
		description: 'Создаём цифровые продукты под задачи продаж, сервиса и внутренних процессов.',
		items: [
			{
				title: 'Разработка сайтов',
				shortTitle: 'Сайты',
				href: '/services/sites/',
				description: 'Лендинги, корпоративные сайты и интернет-магазины.',
			},
			{
				title: 'Веб-сервисы',
				shortTitle: 'Веб-сервисы',
				href: '/services/web-services/',
				description: 'Личные кабинеты, B2B-порталы, MVP и внутренние системы.',
			},
			{
				title: 'Интеграции',
				shortTitle: 'Интеграции',
				href: '/services/integrations/',
				description: 'Связываем сайт, CRM, ERP, 1С и внешние сервисы.',
			},
		],
	},
	{
		title: 'Автоматизация бизнеса',
		description: 'Внедряем платформы и настраиваем процессы под реальную работу компании.',
		items: [
			{
				title: 'Битрикс24',
				shortTitle: 'Битрикс24',
				href: '/services/bitrix24/',
				description: 'CRM, продажи, задачи, коммуникации и аналитика.',
			},
			{
				title: 'РосБизнесСофт',
				shortTitle: 'РосБизнесСофт',
				href: '/services/rbs/',
				description: 'CRM и ERP для продаж, склада, производства и сервиса.',
			},
			{
				title: 'ELMA365',
				shortTitle: 'ELMA365',
				href: '/services/elma/',
				description: 'Low-code автоматизация процессов и документооборота.',
			},
		],
	},
] as const;

export const aiServiceGroup = {
	title: 'ИИ для бизнеса',
	href: '/services/ai/',
	description: 'Прикладные ИИ-решения для клиентов, сотрудников, знаний и процессов.',
	items: aiServices.map((service) => ({
		title: service.navTitle,
		href: `/services/ai/${service.slug}/`,
		description: service.heroLead,
	})),
} as const;

export const supportService = {
	title: 'Техническая поддержка',
	href: '/services/support/',
	description: 'Поддержка и развитие сайтов, CRM, ERP и интеграций.',
} as const;
