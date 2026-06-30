<script lang="ts">
	import { browser } from '$app/environment';
	import { navigating } from '$app/stores';
	import { onDestroy, onMount, tick } from 'svelte';
	import ImmichGallery from '$lib/ImmichGallery.svelte';
	import { wrapNoTranslateWords } from '$lib/noTranslate';
	import { lockBodyScroll, unlockBodyScroll } from '$lib/bodyScrollLock';
	import { trackReaderEvent } from '$lib/readerTracking';

	export let data: {
		posts: {
			date: string;
			title: string;
			slug: string;
			blocks: (
				| { type: 'text'; html: string }
				| { type: 'media'; media: { src: string; alt: string; layout: string[] } }
			)[];
		}[];
		event: string;
		leftoverImages: { src: string; alt: string }[];
		banner?: {
			message: string;
			type?: 'info' | 'warning' | 'danger' | 'success';
			dismissible?: boolean;
		} | null;
		title: string;
		description: string;
		coverImage: string;
		content: string;
		images: string[];
		tripDateRange?: { start?: string; end?: string };
		immichAlbum?: string;
		timezone?: string;
		timezoneLabel?: string;
		sortOrder?: 'asc' | 'desc';
	};

	const readableTitle = data.title || data.event;
	const heroDescription =
		data.description ||
		'A slow, long-form journal of what I was building, noticing, and collecting along the way.';

	const banner = data.banner;

	const dateFormatter = new Intl.DateTimeFormat('en', {
		month: 'long',
		day: 'numeric',
		year: 'numeric'
	});

	const CDN_BASE = 'https://cdn.nickesselman.nl';
	const toCdn = (src?: string): string => {
		if (!src) return '';
		if (/^https?:\/\//i.test(src)) return src;
		if (src.startsWith('/blogimages/')) return `${CDN_BASE}${src}`;
		return src;
	};

	const formatDate = (value?: string) => (value ? dateFormatter.format(new Date(value)) : '—');

	const normalizeId = (value: string, fallback: string) =>
		(value && value.replace(/[^a-zA-Z0-9_-]/g, '-')) || fallback;

	const MS_PER_DAY = 24 * 60 * 60 * 1000;

	const toUTCDate = (value?: string) => {
		if (!value) return null;
		const parts = value.split('-').map(Number);
		if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) return null;
		const [year, month, day] = parts;
		return Date.UTC(year, (month || 1) - 1, day || 1);
	};

	const postsWithDate = data.posts
		.map((post) => ({ date: post.date, dateValue: toUTCDate(post.date) }))
		.filter((post) => post.dateValue !== null)
		.sort((a, b) => (a.dateValue ?? 0) - (b.dateValue ?? 0));

	const tripStart = postsWithDate[0]?.dateValue ?? null;
	const earliestDate = postsWithDate[0]?.date ?? data.posts[0]?.date;
	const latestDate =
		postsWithDate[postsWithDate.length - 1]?.date ?? data.posts[data.posts.length - 1]?.date;

	const getDayNumber = (value?: string, fallback?: number) => {
		if (!tripStart) return fallback;
		const current = toUTCDate(value);
		if (current === null) return fallback;
		const diff = Math.round((current - tripStart) / MS_PER_DAY);
		return Math.max(1, diff + 1);
	};

	const baseEntries = data.posts.map((post, index) => {
		const dayNumber = getDayNumber(post.date, index + 1) ?? index + 1;
		return {
			...post,
			dayNumber,
			order: String(dayNumber).padStart(2, '0'),
			dateLabel: formatDate(post.date),
			id: normalizeId(post.slug, `entry-${index + 1}`)
		};
	});

	let sortOrder: 'asc' | 'desc' = (data.sortOrder as 'asc' | 'desc') || 'asc';

	$: journalEntries =
		sortOrder === 'desc'
			? [...baseEntries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
			: [...baseEntries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

	const totalEntriesLabel = data.posts.length === 1 ? 'entry' : 'entries';
	$: firstEntryId = journalEntries[0]?.id;
	const tripDateRange = data.tripDateRange ?? {};
	const immichAlbum = data.immichAlbum;
	const timezone = data.timezone || '';
	const timezoneLabel = data.timezoneLabel || data.timezone || '';

	let bannerDismissed = false;

	let showBanner = Boolean(banner);

	const heroHighlights = [
		{ label: 'Entries logged', value: data.posts.length || '—' },
		{ label: 'First day', value: formatDate(earliestDate) },
		{ label: 'Latest update', value: formatDate(latestDate) }
	];
	let heroHighlightsWithTime = heroHighlights;
	let localTime = timezone ? '--:--' : '';
	let coverImageSrc = toCdn(data.coverImage) || '';
	let activeEntryId: string | null = null;
	let navigatorList: HTMLElement | null = null;
	const entryNodes = new Map<string, HTMLElement>();
	let scrollTicking = false;
	let navigatorScrollTick: number | null = null;
	let fullscreenLocked = false;
	let maxScrollPercent = 0;
	let scrollMeasureTicking = false;

	const updateActiveEntryByPosition = () => {
		if (!browser) return;
		const anchor = 140;
		let inViewId: string | null = null;
		let inViewTop = -Infinity;
		let nextBelowId: string | null = null;
		let nextBelowTop = Infinity;
		let closestAboveId: string | null = null;
		let closestAboveTop = -Infinity;

		entryNodes.forEach((node, id) => {
			const rect = node.getBoundingClientRect();
			if (rect.top <= anchor && rect.bottom >= anchor) {
				if (rect.top > inViewTop) {
					inViewTop = rect.top;
					inViewId = id;
				}
			} else if (rect.top > anchor) {
				if (rect.top < nextBelowTop) {
					nextBelowTop = rect.top;
					nextBelowId = id;
				}
			} else if (rect.bottom < anchor) {
				if (rect.top > closestAboveTop) {
					closestAboveTop = rect.top;
					closestAboveId = id;
				}
			}
		});

		const nextActive = inViewId || nextBelowId || closestAboveId;
		if (nextActive && nextActive !== activeEntryId) {
			activeEntryId = nextActive;
		}
	};

	const trackEntry = (node: HTMLElement, entryId: string) => {
		let currentId = entryId;
		entryNodes.set(currentId, node);
		updateActiveEntryByPosition();

		return {
			update(newId: string) {
				if (newId === currentId) return;
				entryNodes.delete(currentId);
				currentId = newId;
				entryNodes.set(currentId, node);
				updateActiveEntryByPosition();
			},
			destroy() {
				entryNodes.delete(currentId);
			}
		};
	};

	const setInitialActiveEntry = async () => {
		if (!browser) return;
		await tick();
		const firstEntry = document.querySelector<HTMLElement>('.journal-entry');
		if (firstEntry) {
			activeEntryId = firstEntry.id;
		}
		updateActiveEntryByPosition();
	};

	const scrollActiveNavigator = () => {
		if (!browser || !navigatorList) return;
		if (navigatorScrollTick) {
			cancelAnimationFrame(navigatorScrollTick);
		}
		navigatorScrollTick = requestAnimationFrame(() => {
			if (!navigatorList) return;
			const doc = document.documentElement;
			const scrollable = Math.max(1, doc.scrollHeight - doc.clientHeight);
			const ratio = Math.min(1, Math.max(0, window.scrollY / scrollable));
			const navScrollable = navigatorList.scrollHeight - navigatorList.clientHeight;
			if (navScrollable <= 0) return;
			const targetTop = navScrollable * ratio;
			navigatorList.scrollTo({
				top: Math.max(0, targetTop),
				behavior: 'auto'
			});
		});
	};

	const handleScroll = () => {
		if (scrollTicking) return;
		scrollTicking = true;
		requestAnimationFrame(() => {
			updateActiveEntryByPosition();
			scrollActiveNavigator();
			scrollTicking = false;
		});
	};

	const updateScrollPercent = () => {
		if (!browser) return;
		const doc = document.documentElement;
		const scrollable = doc.scrollHeight - doc.clientHeight;
		if (scrollable <= 0) {
			maxScrollPercent = 100;
			return;
		}
		const percent = Math.min(100, Math.max(0, (window.scrollY / scrollable) * 100));
		if (percent > maxScrollPercent) {
			maxScrollPercent = percent;
		}
	};

	const handleScrollDepth = () => {
		if (scrollMeasureTicking) return;
		scrollMeasureTicking = true;
		requestAnimationFrame(() => {
			updateScrollPercent();
			scrollMeasureTicking = false;
		});
	};

	const timeFormatter: Intl.DateTimeFormat | null = timezone
		? new Intl.DateTimeFormat('en-US', {
				timeZone: timezone,
				hour: 'numeric',
				minute: '2-digit'
		  })
		: null;

	const refreshLocalTime = () => {
		if (!timeFormatter) return;
		localTime = timeFormatter.format(new Date());
	};

	const bannerTypeClasses: Record<string, string> = {
		warning: 'border-yellow-200/80 bg-yellow-50 text-yellow-900 dark:border-yellow-300/50 dark:bg-yellow-900/20 dark:text-yellow-100',
		danger: 'border-red-200/80 bg-red-50 text-red-900 dark:border-red-400/50 dark:bg-red-900/25 dark:text-red-100',
		info: 'border-blue-200/80 bg-blue-50 text-blue-900 dark:border-blue-300/60 dark:bg-blue-900/30 dark:text-blue-50',
		success: 'border-green-200/80 bg-green-50 text-green-900 dark:border-green-300/60 dark:bg-green-900/25 dark:text-green-50'
	};

type FullscreenMedia = { src: string; alt: string; isVideo: boolean } | null;

let fullscreenMedia: FullscreenMedia = null;

	const hasLayout = (layout: string[], value: string) => layout.includes(value);
	const isVideo = (src: string) => !!src && src.endsWith('.mp4');

	function getLayoutClasses(layout: string[]) {
		const base = 'media-block block cursor-pointer rounded-2xl overflow-hidden shadow-md transition';
		const alignClass = hasLayout(layout, 'right')
			? 'md:ml-auto'
			: hasLayout(layout, 'left')
				? 'md:mr-auto'
				: 'mx-auto';

		const widthClass = hasLayout(layout, 'hole')
			? 'w-full max-w-4xl'
			: hasLayout(layout, 'vertical')
				? 'w-full sm:w-2/3 md:w-1/3'
				: hasLayout(layout, 'horizantal') || hasLayout(layout, 'horizontal')
					? 'w-full sm:w-3/4 md:w-2/3'
					: 'w-full max-w-2xl';

		const orientationClass = hasLayout(layout, 'vertical') ? 'max-h-[520px]' : '';

		return [base, alignClass, widthClass, orientationClass, 'my-4 sm:my-5'].join(' ');
	}

	function openFullscreen(src: string, alt: string) {
		fullscreenMedia = { src, alt, isVideo: isVideo(src) };
	}

	function closeFullscreen() {
		fullscreenMedia = null;
	}

	function jumpToEntry(id: string) {
		if (!browser) return;
		const element = document.getElementById(id);
		if (!element) return;
		element.scrollIntoView({ behavior: 'smooth', block: 'start' });
		const highlight = ['ring-2', 'ring-emerald-400', 'ring-offset-2', 'ring-offset-white', 'dark:ring-offset-slate-900', 'shadow-xl'];
		element.classList.add(...highlight);
		window.setTimeout(() => element.classList.remove(...highlight), 1400);
	}

	$: showBanner = Boolean(banner && !bannerDismissed);
	$: heroHighlightsWithTime = timezoneLabel
		? [...heroHighlights, { label: `${timezoneLabel} time`, value: localTime || '—' }]
		: heroHighlights;
	$: coverImageSrc = toCdn(data.coverImage) || '';
	$: scrollActiveNavigator();

	$: if (fullscreenMedia && !fullscreenLocked) {
		lockBodyScroll();
		fullscreenLocked = true;
	} else if (!fullscreenMedia && fullscreenLocked) {
		unlockBodyScroll();
		fullscreenLocked = false;
	}

	onMount(() => {
		setInitialActiveEntry();
		if (browser) {
			trackReaderEvent({ kind: 'post_view', event: data.event, path: window.location.pathname });
			updateScrollPercent();
		}
		const cleanups: (() => void)[] = [];
		if (timeFormatter) {
			refreshLocalTime();
			const id = window.setInterval(refreshLocalTime, 60_000);
			cleanups.push(() => clearInterval(id));
		}
		if (browser) {
			window.addEventListener('scroll', handleScroll, { passive: true });
			window.addEventListener('resize', handleScroll, { passive: true });
			window.addEventListener('scroll', handleScrollDepth, { passive: true });
			window.addEventListener('resize', handleScrollDepth, { passive: true });
			cleanups.push(() => {
				window.removeEventListener('scroll', handleScroll);
				window.removeEventListener('resize', handleScroll);
				window.removeEventListener('scroll', handleScrollDepth);
				window.removeEventListener('resize', handleScrollDepth);
			});
		}
		return () => cleanups.forEach((cleanup) => cleanup());
	});

	onDestroy(() => {
		if (browser) {
			updateScrollPercent();
			trackReaderEvent({
				kind: 'scroll',
				event: data.event,
				path: window.location.pathname,
				percent: maxScrollPercent
			});
		}
		if (fullscreenLocked) {
			unlockBodyScroll();
			fullscreenLocked = false;
		}
	});
</script>

<svelte:window
	on:keydown={(event) => {
		if (event.key === 'Escape' && fullscreenMedia) {
			closeFullscreen();
		}
	}}
/>

{#if $navigating}
	<article class="journal-shell mx-auto w-full max-w-[1600px] px-3 pt-0 pb-6 -mt-1 sm:mt-0 sm:px-6 lg:-mt-2 lg:px-10">
		<section class="mt-0 grid items-center gap-6 rounded-[28px] border border-black/10 bg-white/80 p-6 shadow-[0_22px_40px_rgba(15,23,42,0.08)] dark:border-white/15 dark:bg-white/5 lg:grid-cols-[1.1fr_0.9fr] lg:p-7">
			<div class="space-y-3">
				<div class="h-3 w-40 rounded-full bg-gray-200/70 dark:bg-white/10 animate-pulse"></div>
				<div class="h-8 w-3/5 rounded-full bg-gray-200/80 dark:bg-white/10 animate-pulse"></div>
				<div class="h-4 w-2/3 rounded-full bg-gray-200/70 dark:bg-white/10 animate-pulse"></div>
				<div class="mt-3 flex flex-wrap items-center gap-3">
					<div class="h-8 w-32 rounded-full bg-gray-200/70 dark:bg-white/10 animate-pulse"></div>
					<div class="h-4 w-28 rounded-full bg-gray-200/60 dark:bg-white/10 animate-pulse"></div>
				</div>
			</div>
			<div class="h-56 w-full rounded-2xl bg-gray-200/70 dark:bg-white/10 animate-pulse"></div>
		</section>

		<section class="mt-6 rounded-3xl border border-black/10 bg-white/80 px-4 py-5 dark:border-white/10 dark:bg-white/5 sm:px-5 lg:px-6">
			<div class="h-4 w-40 rounded-full bg-gray-200/70 dark:bg-white/10 animate-pulse"></div>
			<div class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
				{#each Array(3) as _}
					<div class="h-24 rounded-2xl bg-gray-200/60 dark:bg-white/10 animate-pulse"></div>
				{/each}
			</div>
		</section>

		<section class="mt-10 space-y-5">
			{#each Array(3) as _}
				<div class="rounded-[32px] border border-black/5 bg-white/90 p-6 shadow-[0_28px_55px_rgba(15,23,42,0.1)] dark:border-white/10 dark:bg-white/5">
					<div class="h-4 w-24 rounded-full bg-gray-200/70 dark:bg-white/10 animate-pulse"></div>
					<div class="mt-3 h-6 w-2/3 rounded-full bg-gray-200/80 dark:bg-white/10 animate-pulse"></div>
					<div class="mt-4 space-y-2">
						<div class="h-3 w-full rounded-full bg-gray-200/60 dark:bg-white/10 animate-pulse"></div>
						<div class="h-3 w-5/6 rounded-full bg-gray-200/60 dark:bg-white/10 animate-pulse"></div>
						<div class="h-3 w-2/3 rounded-full bg-gray-200/60 dark:bg-white/10 animate-pulse"></div>
					</div>
				</div>
			{/each}
		</section>
	</article>
{:else}
<article class="journal-shell mx-auto w-full max-w-[1600px] px-3 pt-0 pb-6 -mt-1 sm:mt-0 sm:px-6 lg:-mt-2 lg:px-10">
	{#if showBanner && banner}
		<div class="mt-2 mb-4">
			<div
				class={`flex w-full flex-col items-start gap-3 rounded-2xl border border-black/5 px-5 py-4 text-sm shadow-[0_16px_30px_rgba(15,23,42,0.08)] ring-1 ring-white/60 backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:gap-4 ${bannerTypeClasses[banner.type || 'warning']}`}
				role="alert"
			>
				<span class="flex-1 font-medium">{@html banner.message}</span>
				{#if banner.dismissible !== false}
					<button
						type="button"
						class="rounded-full border border-current px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.3em] transition hover:-translate-y-0.5 hover:bg-white/50 hover:text-current dark:hover:bg-white/10"
						on:click={() => (bannerDismissed = true)}
					>
						Close
					</button>
				{/if}
			</div>
		</div>
	{/if}

	<section class="mt-0 grid items-center gap-6 rounded-[28px] border border-black/10 bg-gradient-to-br from-white/95 via-slate-50/95 to-white/95 p-6 shadow-[0_22px_40px_rgba(15,23,42,0.12)] dark:border-white/15 dark:from-slate-900/75 dark:via-slate-800/80 dark:to-slate-900/75 dark:shadow-[0_22px_40px_rgba(0,0,0,0.3)] lg:grid-cols-[1.1fr_0.9fr] lg:p-7">
		<div class="space-y-3">
			<p class="text-xs uppercase tracking-[0.28em] text-slate-600 dark:text-slate-200">Field report · {data.event}</p>
			<h1 class="text-[clamp(2rem,2.6vw,2.75rem)] font-bold leading-tight tracking-[-0.01em]">
				{@html wrapNoTranslateWords(readableTitle)}
			</h1>
			<p class="max-w-3xl text-sm leading-relaxed text-slate-700 dark:text-slate-200 sm:text-base">{heroDescription}</p>

			<div class="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-700 dark:text-slate-200">
				<span class="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.25em] dark:border-white/15">{data.posts.length} {totalEntriesLabel}</span>
				<span>Updated {formatDate(data.posts[data.posts.length - 1]?.date)}</span>
			</div>

			{#if timezoneLabel}
				<div class="mt-3">
					<div class="inline-flex flex-col gap-1 rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-100/80 to-white/95 px-4 py-3 text-slate-800 shadow-[0_14px_28px_rgba(15,23,42,0.1)] dark:border-white/15 dark:from-slate-800/80 dark:to-slate-900/90 dark:text-slate-100 dark:shadow-[0_14px_28px_rgba(0,0,0,0.4)]">
						<div class="text-[0.7rem] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-300">Local time · {timezoneLabel}</div>
						<div class="text-2xl font-semibold tracking-[-0.01em]">{localTime || '—'}</div>
					</div>
				</div>
			{/if}

			{#if firstEntryId}
				<button
					type="button"
					class="inline-flex items-center justify-center gap-2 rounded-full border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:shadow-lg dark:border-white/25 dark:bg-white/10 dark:text-white"
					on:click={() => jumpToEntry(firstEntryId)}
				>
					Jump to entries
				</button>
			{/if}
		</div>

		{#if coverImageSrc}
			<div class="relative ml-auto w-full max-w-[520px] overflow-hidden rounded-2xl border border-black/10 dark:border-white/10">
				{#if isVideo(coverImageSrc)}
					<video src={coverImageSrc} muted playsinline loop class="block h-full w-full object-cover" />
				{:else}
					<img src={coverImageSrc} alt={readableTitle} class="block h-full w-full object-cover" loading="lazy" />
				{/if}
			</div>
		{/if}
	</section>

	<section class="mt-6 rounded-3xl border border-black/10 bg-white/90 px-4 py-5 dark:border-white/10 dark:bg-slate-900/60 sm:px-5 lg:px-6">
		<div class="flex flex-col gap-1">
			<p class="text-xs uppercase tracking-[0.25em] text-slate-500 dark:text-slate-300">Mission dossier</p>
			<h2 class="text-xl font-semibold text-slate-900 dark:text-white">At a glance</h2>
		</div>
		<div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
			{#each heroHighlightsWithTime as highlight}
				<div class="rounded-2xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-white/5">
					<p class="text-[0.72rem] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-300">{highlight.label}</p>
					<p class="mt-2 text-xl font-semibold text-slate-900 dark:text-white">{highlight.value}</p>
				</div>
			{/each}
		</div>
	</section>

	<section class="mt-10 space-y-5 lg:space-y-0 lg:grid lg:gap-8 lg:grid-cols-[minmax(0,360px)_1fr]">
		<nav class="jump-panel sticky top-6 hidden max-h-[calc(100vh-3rem)] overflow-y-auto self-start rounded-[28px] border border-black/5 bg-white/90 p-5 shadow-[0_18px_38px_rgba(15,23,42,0.1)] dark:border-white/10 dark:bg-white/5 lg:block">
		<div class="flex items-center justify-between gap-3">
			<div>
				<p class="text-[0.6rem] uppercase tracking-[0.35em] text-gray-500 dark:text-gray-400">Navigator</p>
				<p class="text-base font-semibold text-gray-900 dark:text-white">Entries</p>
			</div>
			<span class="text-xs text-gray-500 dark:text-gray-400">Tap to jump</span>
		</div>
		<div class="mt-4 flex items-center gap-2 text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-gray-600 dark:text-gray-300">
			<button
				type="button"
				class={`rounded-full border px-3 py-1 transition ${
					sortOrder === 'asc'
						? 'border-gray-900 bg-gray-900 text-white shadow-sm dark:border-white/40 dark:bg-white/15'
						: 'border-gray-200 text-gray-800 hover:border-gray-400 dark:border-white/15 dark:text-white dark:hover:border-white/40'
				}`}
				on:click={() => (sortOrder = 'asc')}
			>
				Earliest first
			</button>
			<button
				type="button"
				class={`rounded-full border px-3 py-1 transition ${
					sortOrder === 'desc'
						? 'border-gray-900 bg-gray-900 text-white shadow-sm dark:border-white/40 dark:bg-white/15'
						: 'border-gray-200 text-gray-800 hover:border-gray-400 dark:border-white/15 dark:text-white dark:hover:border-white/40'
				}`}
				on:click={() => (sortOrder = 'desc')}
			>
				Latest first
			</button>
		</div>
		{#if journalEntries.length === 0}
			<p class="mt-6 text-sm text-gray-600 dark:text-gray-300">
				Entries will appear here once the trip is written up.
			</p>
			{:else}
				<div class="jump-timeline mt-5 space-y-3" bind:this={navigatorList}>
					{#each journalEntries as entry}
						{@const isActive = activeEntryId === entry.id}
						<button
							type="button"
							class={`jump-card group w-full rounded-2xl border px-3 py-3 text-left text-sm transition ${
								isActive
									? 'border-gray-300 bg-gray-50 ring-1 ring-gray-200/60 dark:border-white/15 dark:bg-white/10 dark:ring-white/10'
								: 'border-black/5 hover:border-black/20 hover:bg-black/5 dark:border-white/10 dark:hover:border-white/30 dark:hover:bg-white/10'
							}`}
							on:click={() => jumpToEntry(entry.id)}
							aria-current={isActive ? 'true' : undefined}
							data-entry-id={entry.id}
						>
							<p class="text-[0.65rem] uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">{entry.dateLabel}</p>
							<p class="mt-1 text-base font-semibold text-gray-900 group-hover:text-gray-700 dark:text-white dark:group-hover:text-gray-200">
								{entry.title}
							</p>
						</button>
					{/each}
				</div>
			{/if}
		</nav>

		<div class="journal-feed space-y-8 lg:col-start-2">
			{#if journalEntries.length === 0}
				<div class="rounded-[32px] border border-dashed border-black/10 bg-white/80 p-10 text-center text-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-gray-400">
					<p class="text-xl font-semibold">No entries just yet.</p>
					<p class="mt-2 text-sm">Check back soon for the full travel journal.</p>
				</div>
			{:else}
				{#each journalEntries as entry (entry.id)}
					<article
						id={entry.id}
						class="journal-entry scroll-mt-20 rounded-[32px] border border-black/5 bg-white/95 p-5 shadow-[0_28px_55px_rgba(15,23,42,0.12)] transition dark:border-white/10 dark:bg-white/5 sm:p-8"
						use:trackEntry={entry.id}
					>
						<header class="flex flex-col gap-4 border-b border-black/5 pb-4 dark:border-white/10 sm:flex-row sm:items-end sm:justify-between">
							<div>
								<p class="text-[0.65rem] uppercase tracking-[0.4em] text-gray-500 dark:text-gray-400">Day {entry.order}</p>
								<h2 class="text-3xl font-semibold text-gray-900 dark:text-white">
									{@html wrapNoTranslateWords(entry.title)}
								</h2>
							</div>
							<div class="text-sm text-gray-600 dark:text-gray-300">
								<span>{entry.dateLabel}</span>
							</div>
						</header>

						<div class="journal-body prose prose-base mt-6 max-w-none space-y-5 text-gray-800 dark:prose-invert dark:text-gray-100">
							{#each entry.blocks as block}
								{#if block.type === 'text'}
									<div class="prose prose-base max-w-none text-gray-800 dark:prose-invert dark:text-gray-100">
										{@html wrapNoTranslateWords(block.html)}
									</div>
								{:else}
									{#if block.media && block.media.src}
										{@const mediaSrc = toCdn(block.media.src)}
										<button
											type="button"
											class={getLayoutClasses(block.media.layout)}
											on:click={() => openFullscreen(mediaSrc, block.media.alt)}
											aria-label={block.media.alt || 'Open media fullscreen'}
											style="padding:0;border:none;background:none;"
										>
											{#if isVideo(mediaSrc)}
												<video
													src={mediaSrc}
													autoplay={!hasLayout(block.media.layout, 'dontautostart')}
													loop={!hasLayout(block.media.layout, 'dontautostart')}
													muted={!hasLayout(block.media.layout, 'dontautostart')}
													playsinline={!hasLayout(block.media.layout, 'dontautostart')}
													controls={hasLayout(block.media.layout, 'dontautostart')}
													tabindex="-1"
													class="w-full rounded-xl"
												>
													<track kind="captions" />
												</video>
											{:else}
												<img src={mediaSrc} alt={block.media.alt} tabindex="-1" class="block w-full rounded-xl object-cover" />
											{/if}
										</button>
									{/if}
								{/if}
							{/each}
						</div>
					</article>
				{/each}
			{/if}
		</div>
	</section>

	{#if data.leftoverImages.length > 0}
		<section class="mt-12 rounded-[32px] border border-black/5 bg-white/90 p-6 shadow-[0_30px_60px_rgba(15,23,42,0.12)] dark:border-white/10 dark:bg-white/5">
			<div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<p class="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">Loose frames</p>
					<h3 class="text-2xl font-semibold text-gray-900 dark:text-white">Extra captures from the trip</h3>
					<p class="text-sm text-gray-600 dark:text-gray-300">Tap any tile to open it fullscreen.</p>
				</div>
				<span class="text-sm font-semibold text-gray-500 dark:text-gray-400">{data.leftoverImages.length} media</span>
			</div>
			<div class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{#each data.leftoverImages as image}
					{@const imageSrc = toCdn(image.src)}
					<button
						type="button"
						class="group relative w-full overflow-hidden rounded-3xl border border-black/5 bg-white/80 shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 dark:border-white/10 dark:bg-white/5"
						on:click={() => openFullscreen(imageSrc, image.alt)}
						aria-label={image.alt || 'Open media fullscreen'}
						style="padding:0;border:none;background:none;"
					>
						{#if isVideo(imageSrc)}
							<video
								src={imageSrc}
								autoplay
								muted
								loop
								playsinline
								controls={false}
								controlsList="nodownload noplaybackrate noremoteplayback"
								disablePictureInPicture
								tabindex="-1"
								class="pointer-events-none block h-full w-full object-cover"
							>
								<track kind="captions" />
							</video>
						{:else}
							<img
								src={imageSrc}
								alt={image.alt}
								loading="lazy"
								class="block h-full w-full object-cover"
								tabindex="-1"
							/>
						{/if}
					</button>
				{/each}
			</div>
		</section>
	{/if}

	<ImmichGallery shareUrl={immichAlbum} title={`Story reel from ${readableTitle}`} description="Live Immich album embed" />
</article>
{/if}

{#if fullscreenMedia}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4"
		role="dialog"
		aria-modal="true"
		aria-labelledby="fullscreen-media-title"
		tabindex="-1"
	>
		<div class="relative max-h-full max-w-full" role="document">
			<h2 id="fullscreen-media-title" class="sr-only">{fullscreenMedia.alt}</h2>
			{#if fullscreenMedia.isVideo}
				<video
					src={fullscreenMedia.src}
					controls
					autoplay
					playsinline
					class="h-auto max-h-[85vh] w-auto max-w-[95vw]"
				>
					<track kind="captions" />
				</video>
			{:else}
				<img
					src={fullscreenMedia.src}
					alt={fullscreenMedia.alt}
					class="h-auto max-h-[85vh] w-auto max-w-[95vw]"
				/>
			{/if}

			<button
				class="absolute right-2 top-2 size-10 rounded-full bg-black/50 p-2 text-white"
				on:click={closeFullscreen}
				aria-label="Close fullscreen"
			>
				×
			</button>
		</div>
	</div>
{/if}
