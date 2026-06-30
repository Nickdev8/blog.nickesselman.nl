<script lang="ts">
	import { Splide, SplideSlide } from '@splidejs/svelte-splide';
	import '@splidejs/svelte-splide/css';

	export let data: {
		carouselImages: { src: string; isVideo: boolean }[];
		aboutMeImage: string;
	};

	const badges = ['Builder', 'Programmer', 'Nerd'];

	const simpleNotes = [
		'Code meets cameras is my favorite combo.',
		'I learn fastest by hosting nights where everyone ships.',
		'Offline first, internet second.'
	];

	function playMuted(node: HTMLVideoElement) {
		node.muted = true;
		node.play().catch(() => {
		});
	}
</script>

<div class="space-y-10 px-4 pb-16 pt-6 sm:px-8 lg:px-10">
	<section class="glass-panel overflow-hidden">
		<div class="grid gap-8 lg:grid-cols-[1.1fr,0.9fr]">
			<div class="space-y-4">
				<p class="eyebrow">About Nick</p>
				<h1 class="text-4xl font-semibold text-gray-900 dark:text-white">Making, photogrophy, wandering.</h1>
				<p class="text-base leading-relaxed text-gray-600 dark:text-gray-300">
					I’m Nick—teenage builder, currently splitting time between code, photogrophy, and Hack Club events.
					This page is the quick version of who’s writing all those posts.
				</p>
				<div class="flex flex-wrap gap-2">
					{#each badges as badge}
						<span class="badge-soft">{badge}</span>
					{/each}
				</div>
			</div>
			<div class="relative">
				<div class="absolute -inset-3 rounded-3xl bg-gradient-to-br from-blue-100 via-pink-100 to-yellow-100 blur-2xl opacity-60 dark:from-blue-900/40 dark:via-purple-900/30 dark:to-yellow-900/20"></div>
				<img
					src={data.aboutMeImage}
					alt="Nick"
					class="relative z-10 h-full w-full rounded-3xl object-cover shadow-2xl"
				/>
			</div>
		</div>
	</section>

	{#if data.carouselImages.length > 0}
		<section class="space-y-4">
			<div class="glass-panel space-y-3 text-center sm:text-left">
				<p class="eyebrow">Film strip</p>
				<h2 class="text-2xl font-semibold text-gray-900 dark:text-white">Scenes from the projects + trips</h2>
				<p class="text-sm text-gray-600 dark:text-gray-300">
					A rotating grab bag of stills and clips pulled straight from recent posts.
				</p>
			</div>
			<div class="rounded-3xl">
				<Splide
					options={{
						type: 'loop',
						gap: '1.25rem',
						perPage: 3,
						breakpoints: {
							1024: { perPage: 2 },
							640: { perPage: 1 }
						},
						autoplay: true,
						interval: 3200,
						pagination: false
					}}
				>
					{#each data.carouselImages as media}
						<SplideSlide>
							<div class="overflow-hidden rounded-3xl border border-black/5 bg-gray-200 dark:border-white/10 dark:bg-white/5">
								{#if media.isVideo}
									<video
										src={media.src}
										class="h-64 w-full object-cover"
										loop
										playsinline
										use:playMuted
									>
										<track kind="captions" />
									</video>
								{:else}
									<img src={media.src} alt="Gallery" class="h-64 w-full object-cover" loading="lazy" />
								{/if}
							</div>
						</SplideSlide>
					{/each}
				</Splide>
			</div>
		</section>
	{/if}

	<section class="glass-panel space-y-4 text-center">
		<p class="text-sm uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">Elsewhere</p>
		<h2 class="text-2xl font-semibold text-gray-900 dark:text-white">Want to see my main site?</h2>
		<p class="text-sm text-gray-600 dark:text-gray-300">
			Most projects ship on nickesselman.nl, plus there’s a contact form if you want to collaborate or share an idea.
		</p>
		<a
			href="https://nickesselman.nl"
			target="_blank"
			rel="noopener"
			class="inline-flex items-center justify-center gap-2 rounded-full bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 dark:bg-white dark:text-gray-900"
		>
			Visit nickesselman.nl
		</a>
	</section>
</div>
