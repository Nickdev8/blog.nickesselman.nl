<script lang="ts">
	import { page } from '$app/stores';
	$: isDutch = $page.url.pathname === '/nl' || $page.url.pathname.startsWith('/nl/');
	$: links = [
		{ href: isDutch ? '/nl' : '/', label: isDutch ? 'Verhalen' : 'Stories' },
		{ href: isDutch ? '/nl/about' : '/about', label: isDutch ? 'Over mij' : 'About' },
		{ href: 'https://contact.nickesselman.nl/?from=blog.nickesselman.nl', label: 'Contact' }
	];
</script>

<footer class="mt-20 border-t border-[#d8d2c7]">
	<div class="site-container flex flex-col gap-5 py-8 text-sm text-[#6f6a61] sm:flex-row sm:items-center sm:justify-between">
		<p>{isDutch ? 'Verhalen over bouwen en rondzwerven.' : 'Stories of building and wandering.'}</p>
		<div class="flex flex-wrap gap-x-6 gap-y-3">
			{#each links as link}
				<a href={link.href} class="hairline-link">{link.label}</a>
			{/each}
			<a href="mailto:info@nickesselman.nl" class="hairline-link">info@nickesselman.nl</a>
		</div>
	</div>
</footer>
