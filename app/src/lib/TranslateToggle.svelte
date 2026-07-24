<script lang="ts">
	import { page } from '$app/stores';

	$: isDutch = $page.url.pathname === '/nl' || $page.url.pathname.startsWith('/nl/');
	$: englishPath = isDutch ? $page.url.pathname.replace(/^\/nl(?=\/|$)/, '') || '/' : $page.url.pathname;
	$: dutchPath = isDutch ? $page.url.pathname : `/nl${$page.url.pathname === '/' ? '' : $page.url.pathname}`;
</script>

<nav class="flex items-center gap-2 text-sm" aria-label="Language">
	<a href={englishPath} class:font-semibold={!isDutch} class="hairline-link" lang="en" hreflang="en">EN</a>
	<span aria-hidden="true" class="text-[#aaa398]">/</span>
	<a href={dutchPath} class:font-semibold={isDutch} class="hairline-link" lang="nl" hreflang="nl">NL</a>
</nav>
