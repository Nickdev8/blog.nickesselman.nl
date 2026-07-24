<script lang="ts">
	import { ExternalLink, Menu, X } from 'lucide-svelte';
	import { page } from '$app/stores';
	import TranslateToggle from '$lib/TranslateToggle.svelte';

	let isMobileMenuOpen = false;

	$: isDutch = $page.url.pathname === '/nl' || $page.url.pathname.startsWith('/nl/');
	$: navLinks = [
		{ href: isDutch ? '/nl' : '/', label: isDutch ? 'Verhalen' : 'Stories', external: false },
		{ href: isDutch ? '/nl/about' : '/about', label: isDutch ? 'Over mij' : 'About', external: false },
		{ href: 'https://contact.nickesselman.nl/?from=blog.nickesselman.nl', label: 'Contact Nick Esselman', external: true }
	];
</script>

<header class="border-b border-[#d8d2c7] bg-[#f7f4ed]">
	<nav class="site-container flex min-h-16 items-center justify-between gap-6 py-3" aria-label={isDutch ? 'Hoofdnavigatie' : 'Primary navigation'}>
		<a href={isDutch ? '/nl' : '/'} class="hairline-link text-lg font-semibold tracking-[-0.02em]">Nick Esselman’s Blog</a>

		<div class="hidden items-center gap-7 text-sm md:flex">
			{#each navLinks as link}
				<a href={link.href} rel={link.external ? 'external' : undefined} class={link.external ? 'inline-flex items-center gap-1.5 border border-[#aaa398] px-3 py-2 font-medium hover:border-[#211f1b]' : 'hairline-link'}>
					{link.label}
					{#if link.external}<ExternalLink class="size-4" aria-hidden="true" />{/if}
				</a>
			{/each}
			<TranslateToggle />
		</div>

		<button
			type="button"
			class="inline-flex size-12 items-center justify-center border border-[#d8d2c7] bg-transparent text-[#211f1b] md:hidden"
			on:click={() => (isMobileMenuOpen = !isMobileMenuOpen)}
			aria-expanded={isMobileMenuOpen}
			aria-controls="mobile-navigation"
			aria-label={isMobileMenuOpen ? 'Close navigation' : 'Open navigation'}
		>
			{#if isMobileMenuOpen}<X class="size-5" />{:else}<Menu class="size-5" />{/if}
		</button>
	</nav>

	{#if isMobileMenuOpen}
		<div id="mobile-navigation" class="site-container border-t border-[#d8d2c7] py-4 md:hidden">
			<div class="flex flex-col items-start gap-4 text-base">
				{#each navLinks as link}
					<a href={link.href} rel={link.external ? 'external' : undefined} class={link.external ? 'inline-flex min-h-11 items-center gap-2 border border-[#aaa398] px-3 font-medium' : 'hairline-link'} on:click={() => (isMobileMenuOpen = false)}>
						{link.label}
						{#if link.external}<ExternalLink class="size-4" aria-hidden="true" />{/if}
					</a>
				{/each}
				<TranslateToggle />
			</div>
		</div>
	{/if}
</header>
