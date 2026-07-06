import type { APIRoute } from 'astro';

export const prerender = false;

const BITRIX24_METHOD = 'crm.lead.add';
const REQUIRED_PHONE_DIGITS = 10;

const getEnv = (key: string) => process.env[key] || import.meta.env[key] || '';

const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), {
	status,
	headers: {
		'Content-Type': 'application/json; charset=utf-8',
	},
});

const getText = (formData: FormData, key: string) => {
	const value = formData.get(key);
	return typeof value === 'string' ? value.trim().replace(/\s{2,}/g, ' ') : '';
};

const getBitrix24Url = () => {
	const webhookUrl = String(getEnv('BITRIX24_WEBHOOK_URL')).trim().replace(/\/+$/, '');
	if (!webhookUrl) return '';
	if (webhookUrl.endsWith(`/${BITRIX24_METHOD}`)) return webhookUrl;
	return `${webhookUrl}/${BITRIX24_METHOD}`;
};

const getUtmFields = (url: URL) => {
	const fields: Record<string, string> = {};
	const utmMap = {
		utm_source: 'UTM_SOURCE',
		utm_medium: 'UTM_MEDIUM',
		utm_campaign: 'UTM_CAMPAIGN',
		utm_content: 'UTM_CONTENT',
		utm_term: 'UTM_TERM',
	};

	for (const [param, field] of Object.entries(utmMap)) {
		const value = url.searchParams.get(param);
		if (value) fields[field] = value.slice(0, 255);
	}

	return fields;
};

export const POST: APIRoute = async ({ request, url }) => {
	const bitrix24Url = getBitrix24Url();
	if (!bitrix24Url) {
		return json({ ok: false, message: 'Не настроен BITRIX24_WEBHOOK_URL на сервере сайта.' }, 500);
	}

	const formData = await request.formData();
	const name = getText(formData, 'name');
	const company = getText(formData, 'company');
	const email = getText(formData, 'email');
	const message = getText(formData, 'message');
	const phoneDigits = getText(formData, 'phone').replace(/\D/g, '').replace(/^[78](?=\d{10}$)/, '');
	const consent = getText(formData, 'personal_data_consent');

	if (!name) return json({ ok: false, message: 'Введите имя.' }, 400);
	if (phoneDigits.length !== REQUIRED_PHONE_DIGITS) return json({ ok: false, message: 'Введите телефон полностью.' }, 400);
	if (consent !== 'accepted') return json({ ok: false, message: 'Подтвердите согласие на обработку персональных данных.' }, 400);
	if (email && !/^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/.test(email)) {
		return json({ ok: false, message: 'Введите корректный email.' }, 400);
	}

	const pageUrl = request.headers.get('referer') || url.origin;
	const assignedById = Number(getEnv('BITRIX24_ASSIGNED_BY_ID') || 0);
	const fields: Record<string, unknown> = {
		TITLE: `${getEnv('BITRIX24_LEAD_TITLE_PREFIX') || 'Заявка с сайта'}: ${name}`,
		NAME: name,
		COMPANY_TITLE: company || undefined,
		STATUS_ID: getEnv('BITRIX24_LEAD_STATUS_ID') || 'NEW',
		SOURCE_ID: getEnv('BITRIX24_SOURCE_ID') || 'WEB',
		SOURCE_DESCRIPTION: pageUrl,
		OPENED: 'Y',
		PHONE: [{ VALUE: `+7${phoneDigits}`, VALUE_TYPE: 'WORK' }],
		EMAIL: email ? [{ VALUE: email, VALUE_TYPE: 'WORK' }] : undefined,
		COMMENTS: [
			message ? `Задача: ${message}` : '',
			`Страница: ${pageUrl}`,
			'Согласие на обработку персональных данных: получено',
		].filter(Boolean).join('\n'),
		...getUtmFields(new URL(pageUrl)),
	};

	if (assignedById > 0) fields.ASSIGNED_BY_ID = assignedById;

	for (const [key, value] of Object.entries(fields)) {
		if (value === undefined || value === '') delete fields[key];
	}

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 10000);

	try {
		const response = await fetch(bitrix24Url, {
			method: 'POST',
			headers: {
				'Accept': 'application/json',
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				fields,
				params: {
					REGISTER_SONET_EVENT: 'Y',
				},
			}),
			signal: controller.signal,
		});
		const result = await response.json().catch(() => null);

		if (!response.ok || result?.error) {
			console.error('Bitrix24 lead error', result);
			return json({ ok: false, message: 'Битрикс24 не принял заявку. Проверьте настройки воронки и webhook.' }, 502);
		}

		return json({ ok: true, leadId: result?.result });
	} catch (error) {
		console.error('Bitrix24 lead request failed', error);
		return json({ ok: false, message: 'Не удалось связаться с Битрикс24. Попробуйте позже.' }, 502);
	} finally {
		clearTimeout(timeout);
	}
};
