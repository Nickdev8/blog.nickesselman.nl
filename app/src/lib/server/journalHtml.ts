export const sanitizeJournalHtml = (html: string) =>
	html
		.replace(
			/<a href="https:\/\/nick\.hackclub\.app\/canopy\/build\/">([^<]+)<\/a>/g,
			'<span class="unavailable-link" title="This project link is no longer available">$1</span>'
		)
		.replace(
			/<a href="http:\/\/samstones\.org\/WordPress1\/\?page_id=37">([^<]+)<\/a>/g,
			'<span class="unavailable-link" title="The original page is not available over HTTPS">$1</span>'
		);
