const batchSize = 10;
const activeLists = new Set<HTMLElement>();
const cleanups = new Set<() => void>();

function initializeProgressiveLists() {
	document.querySelectorAll<HTMLElement>('[data-progressive-list]').forEach((list) => {
		if (list.dataset.progressiveReady) return;

		const cards = Array.from(list.children) as HTMLElement[];
		const button = list.parentElement?.querySelector<HTMLButtonElement>('[data-load-more]');
		if (!button || cards.length <= batchSize) return;

		list.dataset.progressiveReady = 'true';
		activeLists.add(list);
		cards.forEach((card, index) => { card.hidden = index >= batchSize; });
		button.hidden = false;

		let visible = batchSize;
		let frame = 0;
		const stopWatching = () => {
			window.removeEventListener('scroll', checkPosition);
			if (frame) window.cancelAnimationFrame(frame);
			cleanups.delete(stopWatching);
		};
		const revealNextBatch = () => {
			const next = Math.min(visible + batchSize, cards.length);
			for (let index = visible; index < next; index++) cards[index].hidden = false;
			visible = next;
			if (visible === cards.length) {
				button.hidden = true;
				stopWatching();
			}
		};
		const checkPosition = () => {
			if (frame || button.hidden) return;
			frame = window.requestAnimationFrame(() => {
				frame = 0;
				if (button.getBoundingClientRect().top <= window.innerHeight + 320) revealNextBatch();
			});
		};

		button.onclick = revealNextBatch;
		window.addEventListener('scroll', checkPosition, { passive: true });
		cleanups.add(stopWatching);
		checkPosition();
	});
}

initializeProgressiveLists();
document.addEventListener('astro:page-load', initializeProgressiveLists);
document.addEventListener('astro:before-swap', () => {
	cleanups.forEach((cleanup) => cleanup());
	activeLists.forEach((list) => { delete list.dataset.progressiveReady; });
	activeLists.clear();
});
