<script lang="ts">
	import { browser } from '$app/environment';
	import { enhance } from '$app/forms';
	import { navigating } from '$app/stores';
	import { onDestroy, onMount } from 'svelte';
	import type { ActionData } from './$types';
	import ImmichGallery from '$lib/ImmichGallery.svelte';
	import { cdnImageDimensions, cdnImageSrcset, cdnImageVariant } from '$lib/cdnImages';
	import { wrapNoTranslateWords } from '$lib/noTranslate';
	import { lockBodyScroll, unlockBodyScroll } from '$lib/bodyScrollLock';
	import { getOrCreateReaderId, trackReaderEvent } from '$lib/readerTracking';

	export let form: ActionData;
	type NoteForm = { noteSuccess?: boolean; noteWarning?: string; noteError?: string; noteName?: string; noteMessage?: string };
	$: noteForm = form as NoteForm | undefined;
	export let data: {
		locale?: 'en' | 'nl';
		translationPending?: boolean;
		posts: {
			date: string;
			title: string;
			slug: string;
			blocks: (
				| { type: 'text'; html: string }
				| {
						type: 'media';
						media: { src: string; alt: string; caption: string; layout: string[] };
				  }
			)[];
		}[];
		event: string;
		leftoverImages: { src: string; alt: string }[];
		banner?: { message: string; type?: 'info' | 'warning' | 'danger' | 'success'; dismissible?: boolean } | null;
		title: string;
		description: string;
		coverImage: string;
		coverImageAlt?: string;
		immichAlbum?: string;
		galleryAssets?: {
			id: string;
			previewUrl: string;
			originalUrl: string;
			alt: string;
			isVideo: boolean;
			width?: number | null;
			height?: number | null;
			srcset?: string | null;
		}[];
		timezone?: string;
		timezoneLabel?: string;
		sortOrder?: 'asc' | 'desc';
		turnstileSiteKey?: string;
		relatedStories?: { slug: string; title: string }[];
	};
	const isDutch = data.locale === 'nl';
	const copy = isDutch
		? {
			close: 'Sluiten', allStories: 'Alle verhalen', entry: 'deel', entries: 'delen', updated: 'Bijgewerkt',
			by: 'Door',
			storyEntries: 'Delen van het verhaal', earliest: 'Oudste', latest: 'Nieuwste', jump: 'Ga naar deel',
			empty: 'Er zijn nog geen delen.', day: 'Dag', openMedia: 'Open media op volledig scherm', more: 'Meer van de reis',
			related: 'Gerelateerde verhalen',
			noteTitle: 'Laat een privébericht achter', noteIntro: 'Laat weten dat je hier was, of deel wat je is bijgebleven. Alleen ik kan dit lezen.',
			noteThanks: 'Bedankt voor het lezen. Je bericht is privé opgeslagen.', name: 'Je naam', note: 'Je bericht', send: 'Verstuur privébericht', fullscreen: 'Media op volledig scherm'
		}
		: {
			close: 'Close', allStories: 'All stories', entry: 'entry', entries: 'entries', updated: 'Updated',
			by: 'By',
			storyEntries: 'Story entries', earliest: 'Earliest', latest: 'Latest', jump: 'Jump to entry',
			empty: 'No entries just yet.', day: 'Day', openMedia: 'Open media fullscreen', more: 'More from the trip',
			related: 'Related stories',
			noteTitle: 'Leave me a private note', noteIntro: 'Tell me you were here, or share what stayed with you. Only I can read it.',
			noteThanks: 'Thanks for reading. Your note is private and saved.', name: 'Your name', note: 'Your note', send: 'Send private note', fullscreen: 'Fullscreen media'
		};

	const CDN_BASE = 'https://cdn.nickesselman.nl';
	const toCdn = (src?: string) => !src ? '' : /^https?:\/\//i.test(src) ? src : src.startsWith('/blogimages/') ? `${CDN_BASE}${src}` : src;
	const isVideo = (src: string) => src.toLowerCase().endsWith('.mp4');
	const hasLayout = (layout: string[], value: string) => layout.includes(value);
	const dateFormatter = new Intl.DateTimeFormat(isDutch ? 'nl' : 'en', { month: 'long', day: 'numeric', year: 'numeric' });
	const formatDate = (value?: string) => value ? dateFormatter.format(new Date(value)) : '—';
	const normalizeId = (value: string, fallback: string) => value?.replace(/[^a-zA-Z0-9_-]/g, '-') || fallback;
	const readableTitle = data.title || data.event;
	const heroDescription = data.description || 'A journal from the road.';
	const coverImageSrc = toCdn(data.coverImage);
	const coverImageDimensions = cdnImageDimensions(coverImageSrc);
	const coverImageSrcset = cdnImageSrcset(coverImageSrc);
	const coverMobileSrc = cdnImageVariant(coverImageSrc, 480);
	const immichAlbum = data.immichAlbum;
	const banner = data.banner;

	const datedPosts = data.posts.map((post) => ({ ...post, timestamp: new Date(post.date).getTime() }));
	const chronological = [...datedPosts].sort((a, b) => a.timestamp - b.timestamp);
	const tripStart = chronological[0]?.timestamp;
	const baseEntries = data.posts.map((post, index) => ({
		...post,
		id: normalizeId(post.slug, `entry-${index + 1}`),
		dayNumber: tripStart ? Math.max(1, Math.round((new Date(post.date).getTime() - tripStart) / 86400000) + 1) : index + 1,
		dateLabel: formatDate(post.date)
	}));

	let sortOrder: 'asc' | 'desc' = data.sortOrder || 'asc';
	const sortEntries = (order: 'asc' | 'desc') => [...baseEntries].sort((a, b) => order === 'desc' ? new Date(b.date).getTime() - new Date(a.date).getTime() : new Date(a.date).getTime() - new Date(b.date).getTime());
	let journalEntries = sortEntries(sortOrder);
	$: journalEntries = sortEntries(sortOrder);
	let activeEntryId = journalEntries[0]?.id || null;
	let bannerDismissed = false;
	let fullscreenMedia: { src: string; alt: string; isVideo: boolean } | null = null;
	let fullscreenLocked = false;
	let localTime = '';
	let readerId = '';
	let noteSubmitted = false;
	let maxScrollPercent = 0;
	let readingFrame = 0;

	const timeFormatter = data.timezone ? new Intl.DateTimeFormat('en-US', { timeZone: data.timezone, hour: 'numeric', minute: '2-digit' }) : null;
	const refreshLocalTime = () => { if (timeFormatter) localTime = timeFormatter.format(new Date()); };

	function getLayoutClasses(layout: string[]) {
		const classes = ['media-block'];
		if (hasLayout(layout, 'hole')) classes.push('media-wide');
		if (hasLayout(layout, 'vertical')) classes.push('media-vertical');
		if (hasLayout(layout, 'left')) classes.push('media-left');
		if (hasLayout(layout, 'right')) classes.push('media-right');
		return classes.join(' ');
	}

	const openFullscreen = (src: string, alt: string) => { fullscreenMedia = { src, alt, isVideo: isVideo(src) }; };
	const closeFullscreen = () => { fullscreenMedia = null; };
	const jumpToEntry = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	const resetTurnstile = () => (window as Window & { turnstile?: { reset: () => void } }).turnstile?.reset();
	const loadTurnstile = () => {
		if (!data.turnstileSiteKey || document.getElementById('turnstile-api')) return;
		const script = document.createElement('script');
		script.id = 'turnstile-api';
		script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
		script.async = true;
		script.defer = true;
		document.head.appendChild(script);
	};
	const updateReadingState = () => {
		const doc = document.documentElement;
		const scrollable = Math.max(1, doc.scrollHeight - doc.clientHeight);
		maxScrollPercent = Math.max(maxScrollPercent, Math.min(100, (window.scrollY / scrollable) * 100));
		const anchor = 150;
		for (const entry of journalEntries) {
			const node = document.getElementById(entry.id);
			if (node && node.getBoundingClientRect().top <= anchor && node.getBoundingClientRect().bottom > anchor) {
				activeEntryId = entry.id;
				break;
			}
		}
	};
	const requestReadingUpdate = () => {
		if (readingFrame) return;
		readingFrame = window.requestAnimationFrame(() => {
			readingFrame = 0;
			updateReadingState();
		});
	};

	$: if (fullscreenMedia && !fullscreenLocked) { lockBodyScroll(); fullscreenLocked = true; }
	$: if (!fullscreenMedia && fullscreenLocked) { unlockBodyScroll(); fullscreenLocked = false; }

	onMount(() => {
		readerId = getOrCreateReaderId();
		void trackReaderEvent({ kind: 'post_view', event: data.event, path: window.location.pathname });
		refreshLocalTime();
		const timer = timeFormatter ? window.setInterval(refreshLocalTime, 60000) : undefined;
		window.addEventListener('scroll', requestReadingUpdate, { passive: true });
		window.addEventListener('resize', requestReadingUpdate, { passive: true });
		updateReadingState();
		return () => {
			if (timer) clearInterval(timer);
			if (readingFrame) window.cancelAnimationFrame(readingFrame);
			window.removeEventListener('scroll', requestReadingUpdate);
			window.removeEventListener('resize', requestReadingUpdate);
		};
	});

	onDestroy(() => {
		if (browser) void trackReaderEvent({ kind: 'scroll', event: data.event, path: window.location.pathname, percent: maxScrollPercent });
		if (fullscreenLocked) unlockBodyScroll();
	});
</script>

<svelte:head>
	{#if coverImageSrc && coverImageSrcset}
		{#if coverMobileSrc}
			<link rel="preload" as="image" href={coverMobileSrc} media="(max-width: 640px)" fetchpriority="high" />
		{/if}
		<link
			rel="preload"
			as="image"
			href={coverImageSrc}
			imagesrcset={coverImageSrcset}
			imagesizes="(min-width: 1280px) 1280px, 100vw"
			media="(min-width: 641px)"
			fetchpriority="high"
		/>
	{/if}
</svelte:head>

<svelte:window on:keydown={(event) => { if (event.key === 'Escape') closeFullscreen(); }} />

{#if $navigating}
	<main class="site-container py-10">
		<div class="h-8 w-2/3 animate-pulse bg-[#e5e0d6]"></div>
		<div class="mt-4 h-4 w-1/2 animate-pulse bg-[#e5e0d6]"></div>
		<div class="mt-8 aspect-[16/7] animate-pulse bg-[#e5e0d6]"></div>
	</main>
{:else}
	<article>
		{#if banner && !bannerDismissed}
			<div class="border-b border-[#d8d2c7] bg-[#eee9df]">
				<div class="site-container flex items-center justify-between gap-5 py-3 text-sm">
					<span>{@html banner.message}</span>
					{#if banner.dismissible !== false}<button type="button" class="border-b border-current bg-transparent" on:click={() => (bannerDismissed = true)}>{copy.close}</button>{/if}
				</div>
			</div>
		{/if}
		{#if isDutch && data.translationPending}
			<div class="border-b border-[#d8d2c7]">
				<p class="site-container py-3 text-sm leading-6 text-[#6f6a61]">
					De Nederlandse vertaling is nog niet gegenereerd. Dit verhaal wordt voorlopig in het Engels getoond.
				</p>
			</div>
		{/if}

		<header class="site-container py-10 sm:py-14">
			<div class="max-w-3xl">
				<a href={isDutch ? '/nl' : '/'} class="hairline-link text-sm text-[#6f6a61]">← {copy.allStories}</a>
				<h1 class="mt-6 text-4xl font-semibold tracking-[-0.045em] sm:text-6xl">{@html wrapNoTranslateWords(readableTitle)}</h1>
				<p class="mt-5 max-w-2xl text-lg leading-8 text-[#5f5a52]">{heroDescription}</p>
				<p class="mt-6 text-sm text-[#6f6a61]">
					{copy.by} <a href={isDutch ? '/nl/about' : '/about'} class="hairline-link">Nick Esselman</a>
					· {data.posts.length} {data.posts.length === 1 ? copy.entry : copy.entries}
					{#if data.posts.length} · {copy.updated} {formatDate(chronological[chronological.length - 1]?.date)}{/if}
					{#if data.timezoneLabel && localTime} · {data.timezoneLabel} {localTime}{/if}
				</p>
			</div>
			{#if coverImageSrc}
				<div class="mt-9 overflow-hidden bg-[#e5e0d6]">
					{#if isVideo(coverImageSrc)}
						<video src={coverImageSrc} muted autoplay loop playsinline preload="metadata" class="max-h-[70vh] w-full object-cover"></video>
					{:else}
						<picture>
							{#if coverMobileSrc}<source media="(max-width: 640px)" srcset={coverMobileSrc} />{/if}
							<img
								src={coverImageSrc}
								srcset={coverImageSrcset}
								width={coverImageDimensions?.width}
								height={coverImageDimensions?.height}
								alt={data.coverImageAlt || `Cover for ${readableTitle}`}
								fetchpriority="high"
								decoding="async"
								sizes="(min-width: 1280px) 1280px, 100vw"
								class="max-h-[70vh] w-full object-cover"
							/>
						</picture>
					{/if}
				</div>
			{/if}
		</header>

		<div class="site-container grid gap-10 border-t border-[#d8d2c7] pt-10 lg:grid-cols-[210px_minmax(0,780px)] lg:justify-center lg:gap-16">
			<nav class="hidden self-start lg:sticky lg:top-6 lg:block" aria-label={copy.storyEntries}>
				<div class="mb-5 flex gap-4 border-b border-[#d8d2c7] pb-4 text-sm">
					<button type="button" class:border-b={sortOrder === 'asc'} class="bg-transparent pb-1" on:click={() => (sortOrder = 'asc')}>{copy.earliest}</button>
					<button type="button" class:border-b={sortOrder === 'desc'} class="bg-transparent pb-1" on:click={() => (sortOrder = 'desc')}>{copy.latest}</button>
				</div>
				<ol class="space-y-3 text-sm">
					{#each journalEntries as entry}
						<li><a href={`#${entry.id}`} class="block min-h-11 py-2 text-[#6f6a61] hover:text-[#211f1b]" class:font-semibold={activeEntryId === entry.id} class:text-[#211f1b]={activeEntryId === entry.id}>{entry.title}</a></li>
					{/each}
				</ol>
			</nav>

			<div class="min-w-0">
				<div class="mb-8 flex items-center justify-between border-b border-[#d8d2c7] pb-3 text-sm lg:hidden">
					<label for="entry-jump">{copy.jump}</label>
					<select id="entry-jump" class="min-h-12 max-w-[65%] border border-[#d8d2c7] bg-transparent px-3 py-2" on:change={(event) => jumpToEntry(event.currentTarget.value)}>
						{#each journalEntries as entry}<option value={entry.id}>{entry.title}</option>{/each}
					</select>
				</div>

				{#if journalEntries.length === 0}
					<p class="py-12 text-[#6f6a61]">{copy.empty}</p>
				{:else}
					{#each journalEntries as entry}
						<section id={entry.id} class="journal-entry scroll-mt-8 border-b border-[#d8d2c7] pb-12 pt-4 first:pt-0">
							<header class="mb-7">
								<p class="text-sm text-[#6f6a61]">{copy.day} {entry.dayNumber} · {entry.dateLabel}</p>
								<h2 class="mt-2 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">{@html wrapNoTranslateWords(entry.title)}</h2>
							</header>
							<div class="journal-body flow-root">
								{#each entry.blocks as block}
									{#if block.type === 'text'}
										<div class="prose max-w-none">{@html wrapNoTranslateWords(block.html)}</div>
									{:else if block.media?.src}
										{@const mediaSrc = toCdn(block.media.src)}
										<figure class={getLayoutClasses(block.media.layout)}>
											{#if isVideo(mediaSrc)}
												<video src={mediaSrc} controls playsinline preload="none" aria-label={block.media.alt} class="block max-h-[75vh] w-full object-cover"><track kind="captions" /></video>
											{:else}
												{@const dimensions = cdnImageDimensions(mediaSrc)}
												<button type="button" class="block w-full cursor-zoom-in border-0 bg-transparent p-0" on:click={() => openFullscreen(mediaSrc, block.media.alt)} aria-label={block.media.alt || copy.openMedia}>
													<img src={mediaSrc} srcset={cdnImageSrcset(mediaSrc)} width={dimensions?.width} height={dimensions?.height} alt={block.media.alt} loading="lazy" decoding="async" sizes="(min-width: 1024px) 780px, 100vw" class="block max-h-[75vh] w-full object-cover" />
												</button>
											{/if}
											{#if block.media.caption}<figcaption class="mt-2 text-sm text-[#6f6a61]">{block.media.caption}</figcaption>{/if}
										</figure>
									{/if}
								{/each}
							</div>
						</section>
					{/each}
			{/if}

			{#if data.relatedStories?.length}
				<nav class="border-t border-[#d8d2c7] py-10" aria-label={copy.related}>
					<h2 class="text-xl font-semibold">{copy.related}</h2>
					<ul class="mt-4 grid gap-3 sm:grid-cols-2">
						{#each data.relatedStories as story}
							<li>
								<a class="block min-h-12 border border-[#d8d2c7] p-4 hover:border-[#211f1b]" href={`${isDutch ? '/nl' : ''}/${story.slug}`}>
									{story.title} →
								</a>
							</li>
						{/each}
					</ul>
				</nav>
			{/if}
		</div>
		</div>

		{#if data.leftoverImages.length > 0}
			<section class="site-container mt-16 border-t border-[#d8d2c7] pt-8" aria-labelledby="extra-frames">
				<h2 id="extra-frames" class="text-2xl font-semibold tracking-[-0.03em]">{copy.more}</h2>
				<div class="mt-6 grid grid-cols-2 gap-2 md:grid-cols-3">
					{#each data.leftoverImages as item}
						{@const src = toCdn(item.src)}
						{@const dimensions = cdnImageDimensions(src)}
						{#if isVideo(src)}
							<video src={src} controls playsinline preload="none" aria-label={item.alt} class="aspect-square h-full w-full bg-[#e5e0d6] object-cover"><track kind="captions" /></video>
						{:else}
							<button type="button" class="aspect-square overflow-hidden border-0 bg-[#e5e0d6] p-0" on:click={() => openFullscreen(src, item.alt)} aria-label={item.alt || copy.openMedia}>
								<img src={src} srcset={cdnImageSrcset(src)} width={dimensions?.width} height={dimensions?.height} alt={item.alt} loading="lazy" decoding="async" sizes="(min-width: 768px) 33vw, 50vw" class="h-full w-full object-cover" />
							</button>
						{/if}
					{/each}
				</div>
			</section>
		{/if}

		<ImmichGallery
			shareUrl={immichAlbum}
			initialAssets={data.galleryAssets || []}
			title={readableTitle}
			locale={data.locale}
		/>

		<section class="site-container mt-16 border-t border-[#d8d2c7] pt-10" aria-labelledby="reader-note">
			<div class="max-w-2xl">
				<h2 id="reader-note" class="text-2xl font-semibold tracking-[-0.03em]">{copy.noteTitle}</h2>
				<p class="mt-2 leading-7 text-[#6f6a61]">{copy.noteIntro}</p>
				{#if noteSubmitted || noteForm?.noteSuccess}
					<p class="mt-5 border-l-2 border-[#735f3d] pl-4">{copy.noteThanks}</p>
					{#if noteForm?.noteWarning}<p class="mt-2 text-sm text-[#8b3f32]">{noteForm.noteWarning}</p>{/if}
				{:else}
					<form method="POST" action="?/note" class="mt-6 space-y-5" on:focusin={loadTurnstile} on:pointerenter={loadTurnstile} use:enhance={() => async ({ result, update }) => { await update({ reset: result.type === 'success' }); if (result.type === 'success') noteSubmitted = true; else resetTurnstile(); }}>
						<input type="hidden" name="readerId" value={readerId} />
						<div class="sr-only" aria-hidden="true"><label for="website">Website</label><input id="website" name="website" tabindex="-1" autocomplete="off" /></div>
						<div><label for="note-name" class="mb-2 block text-sm font-medium">{copy.name}</label><input id="note-name" name="name" required maxlength="80" value={noteForm?.noteName || ''} class="w-full border border-[#aaa398] bg-[#fffdf8] px-3 py-2.5" /></div>
						<div><label for="note-message" class="mb-2 block text-sm font-medium">{copy.note}</label><textarea id="note-message" name="message" required maxlength="2000" rows="5" class="w-full resize-y border border-[#aaa398] bg-[#fffdf8] px-3 py-2.5">{noteForm?.noteMessage || ''}</textarea></div>
						{#if data.turnstileSiteKey}<div class="cf-turnstile" data-sitekey={data.turnstileSiteKey}></div>{/if}
						{#if noteForm?.noteError}<p class="text-sm text-[#8b3f32]" role="alert">{noteForm.noteError}</p>{/if}
						<button type="submit" class="border border-[#211f1b] bg-[#211f1b] px-4 py-2.5 text-sm font-medium text-[#fffdf8] hover:bg-[#4a463e]">{copy.send}</button>
					</form>
				{/if}
			</div>
		</section>
	</article>
{/if}

{#if fullscreenMedia}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" role="dialog" aria-modal="true" aria-label={fullscreenMedia.alt || copy.fullscreen}>
		{#if fullscreenMedia.isVideo}<video src={fullscreenMedia.src} controls autoplay playsinline class="max-h-[90vh] max-w-[95vw]"><track kind="captions" /></video>{:else}<img src={fullscreenMedia.src} alt={fullscreenMedia.alt} class="max-h-[90vh] max-w-[95vw] object-contain" />{/if}
		<button type="button" class="absolute right-4 top-4 size-12 border border-white/60 bg-black text-2xl text-white" on:click={closeFullscreen} aria-label={copy.close}>×</button>
	</div>
{/if}

<style>
	.media-block { clear: both; margin: 2rem 0; }
	.media-wide { width: min(1080px, calc(100vw - 2rem)); margin-left: 50%; transform: translateX(-50%); }
	.media-vertical { max-width: 420px; margin-inline: auto; }
	.journal-entry { content-visibility: auto; contain-intrinsic-size: auto 900px; }
	@media (min-width: 768px) {
		.media-vertical.media-left { float: left; width: 44%; margin: 0.5rem 2rem 1.25rem 0; }
		.media-vertical.media-right { float: right; width: 44%; margin: 0.5rem 0 1.25rem 2rem; }
	}
</style>
