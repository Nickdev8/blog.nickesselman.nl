<script lang="ts">
	import { browser } from '$app/environment';
	import { onDestroy, onMount } from 'svelte';

	export let shareUrl: string = '';
	export let locale: 'en' | 'nl' | undefined = 'en';
	// Legacy props kept for older embeds.
	export let title: string | undefined = undefined;
	export let description: string | undefined = undefined;
	$: if (title || description) {
	}

	type GalleryAsset = {
		id: string;
		previewUrl: string;
		originalUrl: string;
		alt: string;
		isVideo: boolean;
		width?: number | null;
		height?: number | null;
		srcset?: string | null;
	};
	export let initialAssets: GalleryAsset[] = [];

	let valid = false;
	$: valid =
		initialAssets.length > 0 || Boolean(shareUrl && shareUrl.startsWith('http'));
	$: isDutch = locale === 'nl';

	let galleryAssets: GalleryAsset[] = [...initialAssets];
	let loading = false;
	let errorMessage = '';
	let abortController: AbortController | null = null;
	let fullscreenAsset: GalleryAsset | null = null;
	let section: HTMLElement;
	let shouldLoad = false;
	let loadedUrl = '';

	const parseError = async (response: Response) => {
		try {
			const data = await response.json();
			return data?.error || data?.message || `Immich responded with ${response.status}`;
		} catch {
			return `Immich responded with ${response.status}`;
		}
	};

	const fetchGallery = async (url: string) => {
		if (!browser || !url) {
			return;
		}

		abortController?.abort();
		const controller = new AbortController();
		abortController = controller;

		loading = true;
		errorMessage = '';
		galleryAssets = [];

		try {
			const response = await fetch(`/api/immich?shareUrl=${encodeURIComponent(url)}`, {
				signal: controller.signal
			});

			if (!response.ok) {
				throw new Error(await parseError(response));
			}

			const payload = (await response.json()) as { assets?: GalleryAsset[] };
			if (controller.signal.aborted) {
				return;
			}

			galleryAssets = Array.isArray(payload.assets) ? payload.assets : [];
		} catch (error) {
			if ((error as Error).name === 'AbortError') {
				return;
			}

			errorMessage = (error as Error).message || 'Unable to load shared gallery.';
		} finally {
			if (!controller.signal.aborted) {
				loading = false;
			}
		}
	};

	$: if (browser && shouldLoad && loadedUrl !== shareUrl) {
		if (initialAssets.length > 0) {
			galleryAssets = [...initialAssets];
			loadedUrl = shareUrl;
		} else if (!valid) {
			galleryAssets = [];
			errorMessage = '';
			loading = false;
		} else {
			loadedUrl = shareUrl;
			void fetchGallery(shareUrl);
		}
	}

	onMount(() => {
		if (!valid || !section) return;
		const observer = new IntersectionObserver(
			([entry]) => {
				if (!entry.isIntersecting) return;
				shouldLoad = true;
				observer.disconnect();
			},
			{ rootMargin: '600px 0px' }
		);
		observer.observe(section);
		return () => observer.disconnect();
	});

	onDestroy(() => {
		abortController?.abort();
	});

	const openFullscreen = (asset: GalleryAsset) => {
		fullscreenAsset = asset;
	};

	const closeFullscreen = () => {
		fullscreenAsset = null;
	};
</script>

{#if valid}
	<section bind:this={section} class="site-container mt-16 min-h-24 border-t border-[#d8d2c7] pt-8" aria-labelledby="immich-gallery-title">
		<h2 id="immich-gallery-title" class="mb-5 text-2xl font-semibold tracking-[-0.03em]">{isDutch ? 'Gedeeld album' : 'Shared album'}</h2>
		{#if !shouldLoad || loading}
			<p class="text-sm text-[#6f6a61]">{isDutch ? 'Gedeelde foto’s laden…' : 'Loading shared photos…'}</p>
		{:else if errorMessage}
			<p class="text-sm text-[#8b3f32]">{errorMessage}</p>
		{:else if galleryAssets.length === 0}
			<p class="text-sm text-[#6f6a61]">{isDutch ? 'Er zijn nog geen gedeelde media beschikbaar.' : 'No shared media is available yet.'}</p>
		{:else}
			<div class="grid grid-cols-2 gap-2 md:grid-cols-3">
				{#each galleryAssets as asset (asset.id)}
					<button
						type="button"
						class="group relative aspect-square overflow-hidden border-0 bg-[#e5e0d6] p-0 focus:outline-none"
						on:click={() => openFullscreen(asset)}
						aria-label={`Open ${asset.alt || 'media'} fullscreen`}
					>
						{#if asset.isVideo}
							<img
								src={asset.previewUrl}
								alt={asset.alt}
								width={asset.width || undefined}
								height={asset.height || undefined}
								loading="lazy"
								decoding="async"
								class="pointer-events-none block h-full w-full object-cover"
							/>
						{:else}
							<img
								src={asset.previewUrl}
								srcset={asset.srcset || undefined}
								alt={asset.alt}
								width={asset.width || undefined}
								height={asset.height || undefined}
								loading="lazy"
								decoding="async"
								sizes="(min-width: 768px) 33vw, 50vw"
								class="block h-full w-full object-cover opacity-95 transition-opacity duration-200 group-hover:opacity-100"
							/>
						{/if}
					</button>
				{/each}
			</div>
		{/if}
	</section>

	{#if fullscreenAsset}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
			role="dialog"
			aria-modal="true"
			aria-labelledby="immich-fullscreen-title"
		>
			<div class="relative max-h-full max-w-full">
				<h2 id="immich-fullscreen-title" class="sr-only">{fullscreenAsset.alt}</h2>
				{#if fullscreenAsset.isVideo}
					<video
						src={fullscreenAsset.originalUrl || fullscreenAsset.previewUrl}
						controls
						playsinline
						autoplay
						class="h-auto max-h-[90vh] w-auto max-w-[95vw]"
					>
						<track kind="captions" />
					</video>
				{:else}
					<img
						src={fullscreenAsset.originalUrl || fullscreenAsset.previewUrl}
						alt={fullscreenAsset.alt}
						class="h-auto max-h-[90vh] w-auto max-w-[95vw]"
						loading="eager"
					/>
				{/if}
				<button
					class="absolute right-2 top-2 size-12 border border-white/60 bg-black text-2xl text-white"
					on:click={closeFullscreen}
					aria-label={isDutch ? 'Sluit media op volledig scherm' : 'Close fullscreen media'}
				>
					×
				</button>
			</div>
		</div>
	{/if}
{/if}
