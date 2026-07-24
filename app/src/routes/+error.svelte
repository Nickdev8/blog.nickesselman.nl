<script lang="ts">
	import { page } from '$app/stores';
</script>

<main class="site-container py-24 sm:py-32">
	<div class="max-w-xl border-t border-[#d8d2c7] pt-8">
		<p class="text-sm text-[#6f6a61]">{$page.status}</p>
		<h1 class="mt-3 text-4xl font-semibold tracking-[-0.04em]">
			{$page.status === 404 ? 'This page is not here.' : 'This page is unavailable.'}
		</h1>
		<p class="mt-4 leading-7 text-[#6f6a61]">
			{$page.status === 404 ? 'The story may have moved, or the address might be wrong.' : 'Something went wrong while loading it. Please try again shortly.'}
		</p>
		<a href="/" class="mt-7 inline-block border-b border-[#211f1b] pb-1 font-medium">Return to the stories</a>
	</div>
</main>
