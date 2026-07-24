<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { cdnImageSrcset } from '$lib/cdnImages';
	import { ChevronLeft, ChevronRight } from 'lucide-svelte';

	export let data: {
		locale?: 'en' | 'nl';
		carouselImages: { src: string; isVideo: boolean }[];
		aboutMeImage: string;
	};
	let visibleCarouselImages = [...data.carouselImages];
	let carouselTrack: HTMLDivElement;
	let canScrollBack = false;
	let canScrollForward = false;
	const isDutch = data.locale === 'nl';
	const copy = isDutch
		? {
			title: 'Over Nick',
			lead: 'Ik ben een tiener die zijn tijd verdeelt tussen code, fotografie, Hack Club-evenementen en de volgende reis.',
			body: 'Op deze blog bewaar ik de dagelijkse versie: de projecten, mensen, omwegen en foto’s die anders verloren zouden gaan.',
			scenes: 'Recente momenten',
			scenesBody: 'Foto’s en video’s uit de dagboeken.',
			more: 'Meer projecten',
			moreBody: 'Afgeronde projecten en andere experimenten staan op mijn hoofdsite.',
			visit: 'Bezoek nickesselman.nl'
		}
		: {
			title: 'About Nick',
			lead: 'I’m a teenage builder splitting my time between code, photography, Hack Club events, and whatever trip comes next.',
			body: 'This blog is where I keep the day-by-day version: the projects, people, wrong turns, and photographs that would otherwise get lost.',
			scenes: 'Recent scenes',
			scenesBody: 'Photographs and clips pulled from the journals.',
			more: 'More projects',
			moreBody: 'The finished projects and other experiments live on my main site.',
			visit: 'Visit nickesselman.nl'
		};

	function playMuted(node: HTMLVideoElement) {
		node.muted = true;
		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) {
					void node.play().catch(() => undefined);
				} else {
					node.pause();
				}
			},
			{ rootMargin: '200px 0px', threshold: 0.01 }
		);
		observer.observe(node);
		return { destroy: () => observer.disconnect() };
	}

	function removeBrokenMedia(src: string, node: Element) {
		node.setAttribute('hidden', '');
		visibleCarouselImages = visibleCarouselImages.filter((media) => media.src !== src);
		void tick().then(updateCarouselControls);
	}

	function updateCarouselControls() {
		if (!carouselTrack) return;
		canScrollBack = carouselTrack.scrollLeft > 2;
		canScrollForward = carouselTrack.scrollLeft + carouselTrack.clientWidth < carouselTrack.scrollWidth - 2;
	}

	function moveCarousel(direction: -1 | 1) {
		carouselTrack?.scrollBy({ left: direction * carouselTrack.clientWidth, behavior: 'smooth' });
	}

	onMount(() => {
		updateCarouselControls();
		window.addEventListener('resize', updateCarouselControls, { passive: true });
		return () => window.removeEventListener('resize', updateCarouselControls);
	});
</script>

<main class="site-container py-12 sm:py-16">
	<section class="grid gap-8 border-b border-[#d8d2c7] pb-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(420px,1.2fr)] lg:items-end">
		<div class="max-w-xl">
			<h1 class="text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">{copy.title}</h1>
			<p class="mt-5 text-lg leading-8 text-[#5f5a52]">
				{copy.lead}
			</p>
			<p class="mt-5 leading-7 text-[#6f6a61]">
				{copy.body}
			</p>
		</div>
		<img src={data.aboutMeImage} alt="Nick Esselman" width="1793" height="1800" fetchpriority="high" decoding="async" class="aspect-square w-[92%] max-w-lg justify-self-center object-cover lg:justify-self-end" />
	</section>

	{#if visibleCarouselImages.length > 0}
		<section class="py-12" aria-labelledby="recent-scenes">
			<div class="mb-6 flex items-end justify-between gap-4">
				<div>
					<h2 id="recent-scenes" class="text-2xl font-semibold tracking-[-0.03em]">{copy.scenes}</h2>
					<p class="mt-2 text-[#6f6a61]">{copy.scenesBody}</p>
				</div>
			</div>
			<div class="mb-3 flex gap-2">
				<button type="button" class="inline-flex size-11 items-center justify-center border border-[#d8d2c7] bg-transparent disabled:cursor-default disabled:opacity-40" on:click={() => moveCarousel(-1)} disabled={!canScrollBack} aria-label={isDutch ? 'Vorige beelden' : 'Previous scenes'}>
					<ChevronLeft class="size-5" aria-hidden="true" />
				</button>
				<button type="button" class="inline-flex size-11 items-center justify-center border border-[#d8d2c7] bg-transparent disabled:cursor-default disabled:opacity-40" on:click={() => moveCarousel(1)} disabled={!canScrollForward} aria-label={isDutch ? 'Volgende beelden' : 'Next scenes'}>
					<ChevronRight class="size-5" aria-hidden="true" />
				</button>
			</div>
			<div class="carousel-track" bind:this={carouselTrack} on:scroll={updateCarouselControls}>
				{#each visibleCarouselImages as media (media.src)}
					<div class="carousel-item bg-[#e5e0d6]">
						{#if media.isVideo}
							<video src={media.src} class="aspect-[4/3] w-full object-cover" loop playsinline muted preload="none" use:playMuted on:error={(event) => removeBrokenMedia(media.src, event.currentTarget)}><track kind="captions" /></video>
						{:else}
							<img src={media.src} srcset={cdnImageSrcset(media.src)} sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw" alt="Scene from a recent story" class="aspect-[4/3] w-full object-cover" loading="lazy" decoding="async" on:error={(event) => removeBrokenMedia(media.src, event.currentTarget)} />
						{/if}
					</div>
				{/each}
			</div>
		</section>
	{/if}

	<section class="border-t border-[#d8d2c7] pt-10">
		<h2 class="text-2xl font-semibold tracking-[-0.03em]">{copy.more}</h2>
		<p class="mt-3 max-w-xl leading-7 text-[#6f6a61]">{copy.moreBody}</p>
		<a href="https://nickesselman.nl" target="_blank" rel="noopener" class="mt-5 inline-block border-b border-[#211f1b] pb-1 font-medium">{copy.visit}</a>
	</section>
</main>

<style>
	.carousel-track {
		display: flex;
		gap: 1rem;
		overflow-x: auto;
		scroll-snap-type: x mandatory;
		scrollbar-width: none;
	}

	.carousel-track::-webkit-scrollbar {
		display: none;
	}

	.carousel-item {
		flex: 0 0 100%;
		min-width: 0;
		scroll-snap-align: start;
	}

	@media (min-width: 641px) {
		.carousel-item {
			flex-basis: calc((100% - 1rem) / 2);
		}
	}

	@media (min-width: 1025px) {
		.carousel-item {
			flex-basis: calc((100% - 2rem) / 3);
		}
	}
</style>
