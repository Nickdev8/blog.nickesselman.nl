<script lang="ts">
	import { browser } from '$app/environment';
	import { onDestroy, onMount, tick } from 'svelte';
	import { ChevronLeft, ChevronRight, Play, X } from 'lucide-svelte';
	import { lockBodyScroll, unlockBodyScroll } from '$lib/bodyScrollLock';

	export let shareUrl: string = '';
	export let locale: 'en' | 'nl' | undefined = 'en';
	// Legacy props kept for older embeds.
	export let title: string | undefined = undefined;
	export let description: string | undefined = undefined;
	$: if (title || description) {
	}

	type GalleryAsset = {
		id: string;
		thumbnailUrl?: string;
		previewUrl: string;
		originalUrl: string;
		alt: string;
		isVideo: boolean;
		srcset?: string | null;
	};
	export let initialAssets: GalleryAsset[] = [];

	let valid = false;
	$: valid =
		initialAssets.length > 0 || Boolean(shareUrl && shareUrl.startsWith('http'));
	$: isDutch = locale === 'nl';
	$: labels = isDutch
		? {
				gallery: 'Fotogalerij', viewer: 'Mediaweergave', photo: 'Foto', video: 'Video',
				open: 'Open', close: 'Sluiten', previous: 'Vorige', next: 'Volgende', of: 'van'
			}
		: {
				gallery: 'Photo gallery', viewer: 'Media viewer', photo: 'Photo', video: 'Video',
				open: 'Open', close: 'Close', previous: 'Previous', next: 'Next', of: 'of'
			};

	let galleryAssets: GalleryAsset[] = [...initialAssets];
	let loading = false;
	let errorMessage = '';
	let abortController: AbortController | null = null;
	let activeIndex = -1;
	$: activeAsset = galleryAssets[activeIndex];
	let viewer: HTMLDialogElement;
	let closeButton: HTMLButtonElement;
	let opener: HTMLButtonElement | null = null;
	let swipeStart: { x: number; y: number } | null = null;
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
		if (opener) unlockBodyScroll();
	});

	const openViewer = (index: number, button: HTMLButtonElement) => {
		activeIndex = index;
		viewer.showModal();
		opener = button;
		lockBodyScroll();
		void tick().then(() => closeButton?.focus());
	};

	const closeViewer = () => viewer.close();

	const resetViewer = () => {
		activeIndex = -1;
		swipeStart = null;
		unlockBodyScroll();
		opener?.focus({ preventScroll: true });
		opener = null;
	};

	const move = (direction: number) => {
		const nextIndex = activeIndex + direction;
		if (nextIndex >= 0 && nextIndex < galleryAssets.length) activeIndex = nextIndex;
	};

	const handleKey = (event: KeyboardEvent) => {
		if (!viewer?.open || (event.target instanceof HTMLElement && event.target.closest('video'))) return;
		if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
			event.preventDefault();
			move(event.key === 'ArrowLeft' ? -1 : 1);
		}
	};

	const startSwipe = (event: TouchEvent) => {
		swipeStart = null;
		if (event.touches.length !== 1 || (event.target as HTMLElement).closest('button, video')) return;
		const touch = event.touches[0];
		swipeStart = { x: touch.clientX, y: touch.clientY };
	};

	const finishSwipe = (event: TouchEvent) => {
		const start = swipeStart;
		swipeStart = null;
		if (!start || !event.changedTouches.length) return;
		const touch = event.changedTouches[0];
		const x = touch.clientX - start.x;
		const y = touch.clientY - start.y;
		if (Math.abs(x) >= 45 && Math.abs(x) > Math.abs(y) * 1.5) move(x < 0 ? 1 : -1);
	};

	const useFallbackImage = (event: Event, fallback?: string) => {
		const image = event.currentTarget as HTMLImageElement;
		if (fallback && image.getAttribute('src') !== fallback) image.src = fallback;
	};
</script>

<svelte:window on:keydown={handleKey} />

{#if valid}
	<section bind:this={section} class="site-container mt-16 min-h-24 border-t border-[#d8d2c7] pt-8" aria-label={labels.gallery}>
		{#if !shouldLoad || loading}
			<p class="text-sm text-[#6f6a61]">{isDutch ? 'Gedeelde foto’s laden…' : 'Loading shared photos…'}</p>
		{:else if errorMessage}
			<p class="text-sm text-[#8b3f32]">{errorMessage}</p>
		{:else if galleryAssets.length === 0}
			<p class="text-sm text-[#6f6a61]">{isDutch ? 'Er zijn nog geen gedeelde media beschikbaar.' : 'No shared media is available yet.'}</p>
		{:else}
			<div class="grid grid-cols-3 gap-1.5 sm:grid-cols-4 sm:gap-2 lg:grid-cols-5">
				{#each galleryAssets as asset, index (asset.id)}
					<button
						type="button"
						class="group relative aspect-square overflow-hidden rounded-md bg-[#e5e0d6] p-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
						on:click={(event) => openViewer(index, event.currentTarget)}
						aria-label={`${labels.open} ${asset.isVideo ? labels.video : labels.photo} ${index + 1}`}
					>
						<img
							src={asset.thumbnailUrl || asset.previewUrl}
							srcset={asset.thumbnailUrl ? undefined : asset.srcset || undefined}
							sizes="(min-width: 1024px) 20vw, (min-width: 640px) 25vw, 33vw"
							alt={asset.alt}
							loading="lazy"
							decoding="async"
							on:error={(event) => useFallbackImage(event, asset.previewUrl)}
							class="block h-full w-full object-cover motion-safe:transition-transform motion-safe:duration-200 motion-safe:group-hover:scale-105"
						/>
						{#if asset.isVideo}
							<span class="absolute bottom-2 right-2 rounded-full bg-black/70 p-1.5 text-white">
								<Play size={15} fill="currentColor" aria-hidden="true" />
							</span>
						{/if}
					</button>
				{/each}
			</div>
		{/if}
	</section>

	<dialog
		bind:this={viewer}
		class="gallery-viewer"
		aria-label={labels.viewer}
		on:close={resetViewer}
		on:touchstart|passive={startSwipe}
		on:touchend|passive={finishSwipe}
		on:touchcancel={() => (swipeStart = null)}
	>
		{#if activeAsset}
			<button type="button" class="absolute inset-0" tabindex="-1" aria-hidden="true" on:click={closeViewer}></button>
			<div class="viewer-content">
				<div class="flex items-center justify-between gap-3">
					<p class="px-2 text-sm tabular-nums text-white/80" aria-live="polite">
						{activeIndex + 1} {labels.of} {galleryAssets.length}
					</p>
					<button bind:this={closeButton} type="button" class="viewer-control" aria-label={labels.close} on:click={closeViewer}>
						<X size={24} aria-hidden="true" />
					</button>
				</div>
				<div class="viewer-stage">
					{#key activeAsset.id}
						{#if activeAsset.isVideo}
							<video
								src={activeAsset.originalUrl}
								poster={activeAsset.thumbnailUrl || activeAsset.previewUrl}
								controls
								playsinline
								autoplay
								aria-label={activeAsset.alt}
							><track kind="captions" /></video>
						{:else}
							<img
								src={activeAsset.previewUrl}
								alt={activeAsset.alt}
								draggable="false"
								on:error={(event) => useFallbackImage(event, activeAsset.thumbnailUrl)}
							/>
						{/if}
					{/key}
					{#if galleryAssets.length > 1}
						<button type="button" class="viewer-control absolute left-0" aria-label={labels.previous} aria-disabled={activeIndex === 0} on:click={() => move(-1)}>
							<ChevronLeft size={26} aria-hidden="true" />
						</button>
						<button type="button" class="viewer-control absolute right-0" aria-label={labels.next} aria-disabled={activeIndex === galleryAssets.length - 1} on:click={() => move(1)}>
							<ChevronRight size={26} aria-hidden="true" />
						</button>
					{/if}
				</div>
			</div>
		{/if}
	</dialog>
{/if}

<style>
	.gallery-viewer {
		position: fixed;
		inset: 0;
		width: 100%;
		height: 100%;
		height: 100dvh;
		max-width: none;
		max-height: none;
		padding: 0;
		border: 0;
		color: white;
		background: transparent;
	}

	.gallery-viewer::backdrop {
		background: rgb(10 11 13 / 96%);
	}

	.viewer-content {
		position: relative;
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		gap: 0.5rem;
		height: 100%;
		padding: max(0.75rem, env(safe-area-inset-top)) max(0.75rem, env(safe-area-inset-right))
			max(0.75rem, env(safe-area-inset-bottom)) max(0.75rem, env(safe-area-inset-left));
		pointer-events: none;
	}

	.viewer-stage {
		position: relative;
		display: grid;
		grid-template: minmax(0, 1fr) / minmax(0, 1fr);
		place-items: center;
		min-height: 0;
	}

	.viewer-stage img,
	.viewer-stage video {
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
		pointer-events: auto;
	}

	.viewer-stage img {
		touch-action: pinch-zoom;
	}

	.viewer-control {
		display: grid;
		place-items: center;
		width: 2.75rem;
		height: 2.75rem;
		border: 1px solid rgb(255 255 255 / 22%);
		border-radius: 50%;
		background: rgb(22 24 29 / 85%);
		pointer-events: auto;
	}

	.viewer-control:hover:not([aria-disabled='true']) {
		background: #393c45;
	}

	.viewer-control:focus-visible {
		outline: 2px solid white;
		outline-offset: 3px;
	}

	.viewer-control[aria-disabled='true'] {
		opacity: 0.35;
		cursor: default;
	}

	@media (prefers-reduced-motion: no-preference) {
		.gallery-viewer[open] .viewer-content {
			animation: enter 160ms ease-out;
		}

		@keyframes enter {
			from { opacity: 0; }
			to { opacity: 1; }
		}
	}
</style>
