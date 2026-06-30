<script lang="ts">
	import { navigating } from '$app/stores';
	import { wrapNoTranslateWords } from '$lib/noTranslate';

	export let data: {
		events: {
			slug: string;
			title: string;
			description: string;
			coverImage: string;
			live: boolean;
		}[];
	} = { events: [] };

	const posts = data.events ?? [];
	const heroYear = new Date().getFullYear();
	const livePost = posts.find((post) => post.live);
</script>

{#if $navigating}
	<main class="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-10 sm:px-6 lg:max-w-7xl">
		<section class="space-y-3">
			<div class="h-3 w-40 rounded-full bg-gray-200/70 dark:bg-white/10 animate-pulse"></div>
			<div class="h-8 w-3/5 rounded-full bg-gray-200/80 dark:bg-white/10 animate-pulse"></div>
			<div class="h-4 w-2/3 rounded-full bg-gray-200/70 dark:bg-white/10 animate-pulse"></div>
		</section>
		<ul class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
			{#each Array(6) as _}
				<li class="overflow-hidden rounded-3xl border border-black/5 bg-white/90 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-white/5">
					<div class="h-40 rounded-2xl bg-gray-200/70 dark:bg-white/10 animate-pulse"></div>
					<div class="mt-4 space-y-2">
						<div class="h-3 w-24 rounded-full bg-gray-200/70 dark:bg-white/10 animate-pulse"></div>
						<div class="h-5 w-3/4 rounded-full bg-gray-200/80 dark:bg-white/10 animate-pulse"></div>
						<div class="h-3 w-full rounded-full bg-gray-200/60 dark:bg-white/10 animate-pulse"></div>
					</div>
				</li>
			{/each}
		</ul>
	</main>
{:else}
	<main class="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-10 sm:px-6 lg:max-w-7xl">
		<section class="space-y-2 text-gray-900 dark:text-white">
			<p class="text-xs uppercase tracking-[0.35em] text-gray-500 dark:text-gray-400">
				Trip journals · {heroYear}
			</p>
			<h1 class="text-4xl font-semibold leading-tight">Stories from the road</h1>
			<p class="max-w-2xl text-sm text-gray-600 dark:text-gray-300">
				Everything I'm doing lands here. quick scraps, day-by-day play-by-plays, and the longer stories from what I'm building and wandering through.
			</p>
			{#if livePost}
				<a
					href={`/${livePost.slug}`}
					class="mt-4 inline-flex items-center gap-2 rounded-full border border-green-500/40 bg-green-500/10 px-4 py-2 text-sm font-semibold text-green-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-green-500/20 dark:border-green-400/40 dark:text-green-200"
				>
					<span class="inline-flex size-2.5 rounded-full bg-green-500 shadow-[0_0_12px_rgba(74,222,128,0.8)]"></span>
					<span>Live now: {@html wrapNoTranslateWords(livePost.title)}</span>
				</a>
			{/if}
		</section>


		{#if posts.length === 0}
			<section class="rounded-3xl border border-dashed border-black/10 bg-white/70 p-10 text-center text-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-gray-300">
				<p class="text-lg font-semibold">No trips are public yet.</p>
				<p class="mt-2 text-sm">New entries will show up here as soon as I publish them.</p>
			</section>
		{:else}
			<ul class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
				{#each posts as post}
					<li class="group overflow-hidden rounded-3xl border border-black/5 bg-white/95 shadow-[0_18px_40px_rgba(15,23,42,0.08)] transition hover:-translate-y-0.5 dark:border-white/10 dark:bg-white/5">
						<a href={`/${post.slug}`} class="flex h-full flex-col">
							{#if post.coverImage}
								<div class="relative h-48 overflow-hidden border-b border-black/5 bg-black/5 dark:border-white/10 dark:bg-white/10">
									{#if post.coverImage.endsWith('.mp4')}
										<video src={post.coverImage} muted playsinline loop class="h-full w-full object-cover"></video>
									{:else}
										<img src={post.coverImage} alt={post.title} class="h-full w-full object-cover" loading="lazy" />
									{/if}
						<span
							class={`absolute left-4 top-4 inline-flex items-center gap-1 rounded-full px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.35em] ${post.live ? 'bg-green-500/90 text-white shadow-[0_8px_20px_rgba(34,197,94,0.45)]' : 'bg-black/70 text-white'}`}
						>
							{post.live ? '● Live' : 'Archived'}
						</span>
								</div>
							{/if}
							<div class="flex flex-1 flex-col gap-3 px-5 py-6 text-gray-900 dark:text-white">
								<div>
									<p class="text-xs uppercase tracking-[0.35em] text-gray-500 dark:text-gray-400">{post.slug}</p>
									<h2 class="mt-2 text-2xl font-semibold">{@html wrapNoTranslateWords(post.title)}</h2>
								</div>
								<p class="text-sm text-gray-600 dark:text-gray-300">{post.description}</p>
								<span class="mt-auto inline-flex w-fit items-center gap-2 text-sm font-semibold text-blue-700 transition group-hover:gap-3 dark:text-blue-200">
									Continue reading ➜
								</span>
							</div>
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	</main>
{/if}

<style>
	:global(body) {
		background: #f7f5f2;
	}

	:global(.dark body) {
		background: #05060a;
	}
</style>
