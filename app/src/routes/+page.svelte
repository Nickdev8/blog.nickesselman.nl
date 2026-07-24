<script lang="ts">
	import { navigating } from '$app/stores';
	import { cdnImageDimensions, cdnImageSrcset, cdnImageVariant } from '$lib/cdnImages';
	import { wrapNoTranslateWords } from '$lib/noTranslate';

	export let data: {
		locale?: 'en' | 'nl';
		translationPending?: boolean;
		events: {
			slug: string;
			title: string;
			description: string;
			coverImage: string;
			live: boolean;
			latestDate: number;
		}[];
	} = { events: [] };

	const posts = data.events ?? [];
	const isDutch = data.locale === 'nl';
	const copy = isDutch
		? {
			title: 'Verhalen van onderweg',
			intro: 'Reisdagboeken en bouwverslagen, geschreven terwijl het gebeurde.',
			empty: 'Er zijn nog geen verhalen openbaar.',
			live: 'Live dagboek',
			journal: 'Dagboek',
			read: 'Lees het verhaal',
			more: 'Meer verhalen'
		}
		: {
			title: 'Stories from the road',
			intro: 'Travel journals and build notes, written as they happened.',
			empty: 'No stories are public yet.',
			live: 'Live journal',
			journal: 'Journal',
			read: 'Read the story',
			more: 'More stories'
		};
	const leadPost = posts[0];
	const leadDimensions = cdnImageDimensions(leadPost?.coverImage);
	const leadSrcset = cdnImageSrcset(leadPost?.coverImage);
	const leadMobileSrc = cdnImageVariant(leadPost?.coverImage, 480);
	const remainingPosts = posts.slice(1);
	const dateFormatter = new Intl.DateTimeFormat(isDutch ? 'nl' : 'en', { month: 'long', year: 'numeric' });
	const formatDate = (value: number) => (value ? dateFormatter.format(new Date(value)) : copy.journal);
	const postHref = (slug: string) => `${isDutch ? '/nl' : ''}/${slug}`;
	const isVideo = (src: string) => src.toLowerCase().endsWith('.mp4');
</script>

<svelte:head>
	{#if leadPost?.coverImage && leadSrcset}
		{#if leadMobileSrc}
			<link rel="preload" as="image" href={leadMobileSrc} media="(max-width: 640px)" fetchpriority="high" />
		{/if}
		<link
			rel="preload"
			as="image"
			href={leadPost.coverImage}
			imagesrcset={leadSrcset}
			imagesizes="(min-width: 1024px) 70vw, 100vw"
			media="(min-width: 641px)"
			fetchpriority="high"
		/>
	{/if}
</svelte:head>

{#if $navigating}
	<main class="site-container py-12 sm:py-16">
		<div class="h-7 w-64 animate-pulse bg-[#e5e0d6]"></div>
		<div class="mt-4 h-4 w-full max-w-xl animate-pulse bg-[#e5e0d6]"></div>
		<div class="mt-10 aspect-[16/8] animate-pulse bg-[#e5e0d6]"></div>
	</main>
{:else}
	<main class="site-container py-12 sm:py-16">
		{#if isDutch && data.translationPending}
			<p class="mb-8 border-y border-[#d8d2c7] py-3 text-sm leading-6 text-[#6f6a61]">
				De Nederlandse vertaling is nog niet gegenereerd. De verhalen worden voorlopig in het Engels getoond.
			</p>
		{/if}
		<header class="max-w-2xl border-b border-[#d8d2c7] pb-8">
			<h1 class="text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">{copy.title}</h1>
			<p class="mt-3 max-w-xl text-base leading-7 text-[#6f6a61]">
				{copy.intro}
			</p>
		</header>

		{#if !leadPost}
			<p class="py-16 text-[#6f6a61]">{copy.empty}</p>
		{:else}
			<section class="py-10 sm:py-14" aria-labelledby="latest-story">
				<a href={postHref(leadPost.slug)} class="group grid gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(260px,0.75fr)] lg:items-end">
					<div class="overflow-hidden bg-[#e5e0d6]">
						{#if isVideo(leadPost.coverImage)}
							<video src={leadPost.coverImage} muted playsinline loop autoplay preload="metadata" class="aspect-[16/9] w-full object-cover"></video>
						{:else}
							<picture>
								{#if leadMobileSrc}<source media="(max-width: 640px)" srcset={leadMobileSrc} />{/if}
								<img
									src={leadPost.coverImage}
									srcset={leadSrcset}
									width={leadDimensions?.width}
									height={leadDimensions?.height}
									alt=""
									fetchpriority="high"
									decoding="async"
									sizes="(min-width: 1024px) 70vw, 100vw"
									class="aspect-[16/9] w-full object-cover opacity-95 transition-opacity duration-200 group-hover:opacity-100"
								/>
							</picture>
						{/if}
					</div>
					<div class="border-t border-[#d8d2c7] pt-4 lg:border-t-0 lg:pt-0">
						<p class="text-sm text-[#6f6a61]">{leadPost.live ? copy.live : formatDate(leadPost.latestDate)}</p>
						<h2 id="latest-story" class="mt-2 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
							{@html wrapNoTranslateWords(leadPost.title)}
						</h2>
						<p class="mt-4 leading-7 text-[#5f5a52]">{leadPost.description}</p>
						<span class="mt-6 inline-block border-b border-[#211f1b] pb-1 text-sm font-medium">{copy.read}</span>
					</div>
				</a>
			</section>

			{#if remainingPosts.length > 0}
				<section class="border-t border-[#d8d2c7]" aria-label={copy.more}>
					{#each remainingPosts as post}
						{@const dimensions = cdnImageDimensions(post.coverImage)}
						<a href={postHref(post.slug)} class="group grid gap-5 border-b border-[#d8d2c7] py-7 sm:grid-cols-[220px_1fr_auto] sm:items-center lg:grid-cols-[300px_1fr_auto]">
							<div class="overflow-hidden bg-[#e5e0d6]">
								{#if isVideo(post.coverImage)}
									<video src={post.coverImage} muted playsinline loop preload="none" class="aspect-[3/2] w-full object-cover"></video>
								{:else}
									<img
										src={post.coverImage}
										srcset={cdnImageSrcset(post.coverImage)}
										width={dimensions?.width}
										height={dimensions?.height}
										alt=""
										loading="lazy"
										decoding="async"
										sizes="(min-width: 1024px) 300px, (min-width: 640px) 220px, 100vw"
										class="aspect-[3/2] w-full object-cover opacity-90 transition-opacity duration-200 group-hover:opacity-100"
									/>
								{/if}
							</div>
							<div>
								<p class="text-sm text-[#6f6a61]">{post.live ? copy.live : formatDate(post.latestDate)}</p>
								<h2 class="mt-1 text-2xl font-semibold tracking-[-0.025em]">{@html wrapNoTranslateWords(post.title)}</h2>
								<p class="mt-2 max-w-2xl leading-7 text-[#5f5a52]">{post.description}</p>
							</div>
							<span class="hidden text-xl text-[#6f6a61] sm:block" aria-hidden="true">→</span>
						</a>
					{/each}
				</section>
			{/if}
		{/if}
	</main>
{/if}
