<script lang="ts">
	import { onMount } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/stores';
	import Header from '$lib/Header.svelte';
	import Footer from '$lib/Footer.svelte';
	import { getOrCreateReaderId, trackReaderEvent } from '$lib/readerTracking';
	import { SITE_AUTHOR, SITE_NAME, buildSeo, defaultSeo, serializeJsonLd, type SeoData } from '$lib/seo';
	import '../app.css';

	let isAdminRoute = false;
	let seo: SeoData = defaultSeo;

	const getErrorSeo = (status: number, pathname: string) =>
		buildSeo({
			title: status === 404 ? 'Page Not Found' : 'Page Unavailable',
			description:
				status === 404
					? 'The page you were looking for could not be found.'
					: 'Something went wrong while loading this page.',
			pathname,
			robots: 'noindex,nofollow'
		});

	const getDeviceClass = () => (window.innerWidth < 768 ? 'mobile' : 'desktop');

	const trackVisit = (path: string, referrer: string) => {
		void trackReaderEvent({
			kind: 'visit',
			path,
			referrer: referrer || 'direct',
			device: getDeviceClass()
		});
	};

	const trackVisitWhenIdle = (path: string, referrer: string) => {
		const idleWindow = window as Window & {
			requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
		};
		if (idleWindow.requestIdleCallback) {
			idleWindow.requestIdleCallback(() => trackVisit(path, referrer), { timeout: 2000 });
			return;
		}
		window.setTimeout(() => trackVisit(path, referrer), 0);
	};

	$: isAdminRoute = $page.url.pathname.startsWith('/admin');
	$: isDutch = $page.url.pathname === '/nl' || $page.url.pathname.startsWith('/nl/');
	$: seo =
		$page.status >= 400
			? getErrorSeo($page.status, $page.url.pathname)
			: (($page.data as { seo?: SeoData })?.seo ?? defaultSeo);
	afterNavigate(({ from, to }) => {
		if (!from || !to) return;
		document.documentElement.lang =
			to.url.pathname === '/nl' || to.url.pathname.startsWith('/nl/') ? 'nl' : 'en';
		trackVisitWhenIdle(to.url.pathname, from.url.pathname);
	});
	onMount(() => {
		document.documentElement.lang = isDutch ? 'nl' : 'en';
		getOrCreateReaderId();
		trackVisitWhenIdle(window.location.pathname, document.referrer);
	});
</script>

<svelte:head>
	<title>{seo.title}</title>
	<meta name="description" content={seo.description} />
	<meta name="author" content={SITE_AUTHOR} />
	<meta name="robots" content={seo.robots} />
	<link rel="canonical" href={seo.canonical} />
	<link rel="sitemap" type="application/xml" title="Sitemap" href="/sitemap.xml" />
	{#if seo.alternates}
		<link rel="alternate" hreflang="en" href={seo.alternates.en} />
		<link rel="alternate" hreflang="nl" href={seo.alternates.nl} />
		{#if seo.alternates.xDefault}<link rel="alternate" hreflang="x-default" href={seo.alternates.xDefault} />{/if}
	{/if}
	<meta property="og:site_name" content={SITE_NAME} />
	<meta property="og:type" content={seo.ogType} />
	<meta property="og:url" content={seo.canonical} />
	<meta property="og:title" content={seo.title} />
	<meta property="og:description" content={seo.description} />
	<meta property="og:image" content={seo.image} />
	<meta property="og:image:alt" content={seo.imageAlt} />
	<meta property="og:locale" content="en_US" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={seo.title} />
	<meta name="twitter:description" content={seo.description} />
	<meta name="twitter:image" content={seo.image} />
	{#if seo.publishedTime}<meta property="article:published_time" content={seo.publishedTime} />{/if}
	{#if seo.modifiedTime}<meta property="article:modified_time" content={seo.modifiedTime} />{/if}
	{#each seo.structuredData as item}
		{@html `<script type="application/ld+json">${serializeJsonLd(item)}<\/script>`}
	{/each}

	{#if isAdminRoute}
		<meta name="google" content="notranslate" />
	{/if}
</svelte:head>

<div class="page-shell">
	{#if !isAdminRoute}<Header />{/if}
	<main><slot /></main>
	{#if !isAdminRoute}<Footer />{/if}
</div>
