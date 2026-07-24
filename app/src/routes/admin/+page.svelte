<script lang="ts">
	import { navigating } from '$app/stores';
	import type { ActionData, PageData } from './$types';
	import { publicPostSlug } from '$lib/postRoutes';

	export let data: PageData;
	export let form: ActionData;

	const loginError = form?.loginError;
	const saveError = form?.saveError;
</script>

{#if $navigating}
	<main class="admin shell">
		<aside class="sidebar">
			<div class="sidebar__header">
				<div class="skeleton-line wide"></div>
				<div class="skeleton-line"></div>
			</div>
			<ul class="skeleton-list">
				{#each Array(6) as _}
					<li>
						<div class="skeleton-line wide"></div>
						<div class="skeleton-line small"></div>
					</li>
				{/each}
			</ul>
			<div class="sidebar__actions">
				<div class="skeleton-pill"></div>
			</div>
		</aside>
		<section class="editor">
			<header class="editor__header">
				<div class="skeleton-line wide"></div>
				<div class="skeleton-line small"></div>
			</header>
			<div class="skeleton-block tall"></div>
		</section>
	</main>
{:else}
	{#if !data.loggedIn}
		<main class="admin auth">
			<section class="panel">
				<h1>Markdown Admin</h1>
				<p>Enter the shared password to start editing posts.</p>
				{#if loginError}
					<p class="status error">{loginError}</p>
				{/if}
				<form method="post" action="/admin?/login">
					<label for="password">Password</label>
					<input id="password" name="password" type="password" required />
					<button type="submit">Unlock editor</button>
				</form>
			</section>
		</main>
	{:else}
		<main class="admin shell">
			<aside class="sidebar">
				<div class="sidebar__header">
					<h2>Posts</h2>
					<p class="hint">Tap a post to load it below.</p>
				</div>
				<ul>
					{#if data.posts.length === 0}
						<li class="empty">No markdown files found in <code>src/posts</code>.</li>
					{:else}
						{#each data.posts as post}
							<li class:selected={post.slug === data.selectedSlug}>
								<a href={`/admin?post=${encodeURIComponent(post.slug)}`}>
									<span class="post-title">{post.title}</span>
									<span class="post-slug">{post.slug}.md</span>
								</a>
							</li>
						{/each}
					{/if}
				</ul>
				<div class="sidebar__actions">
					<a class="ghost-link" href="/admin/analytics">View analytics</a>
				</div>
				<form method="post" action="/admin?/logout">
					<button type="submit" class="ghost">Log out</button>
				</form>
			</aside>
			<section class="editor">
				{#if data.selectedSlug}
					<header class="editor__header">
						<div>
							<h1>{data.posts.find((p) => p.slug === data.selectedSlug)?.title ?? data.selectedSlug}</h1>
							<p class="file-label">{data.selectedSlug}.md</p>
						</div>
						<div class="editor__status">
							<a
								class="ghost-link"
								href={`/${publicPostSlug(data.selectedSlug)}`}
								target="_blank"
								rel="noreferrer"
							>
								Open post
							</a>
							{#if data.saved}
								<p class="status success">Saved.</p>
							{/if}
							{#if saveError}
								<p class="status error">{saveError}</p>
							{/if}
						</div>
					</header>
					<form method="post" action="/admin?/save" class="editor__form">
						<input type="hidden" name="slug" value={data.selectedSlug} />
						<label for="content">Markdown</label>
						<textarea id="content" name="content" rows="24" required>{data.content}</textarea>
						<div class="editor__actions">
							<button type="submit">Save changes</button>
						</div>
					</form>
				{:else}
					<div class="empty-state">
						<h1>Select a post</h1>
						<p>Pick a markdown file from the list to begin editing.</p>
					</div>
				{/if}
			</section>
		</main>
	{/if}
{/if}

<style>
	:global(body.is-admin) {
		background: var(--app-bg, #050505);
	}

	.admin {
		min-height: 80vh;
		padding: clamp(1rem, 3vw, 2.5rem);
	}

	.admin.auth {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.panel {
		width: min(400px, 100%);
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 1rem;
		padding: 2rem;
		backdrop-filter: blur(20px);
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
	}

	.panel h1 {
		margin-bottom: 0.5rem;
		font-size: clamp(1.5rem, 3vw, 2rem);
	}

	label {
		display: block;
		margin-bottom: 0.4rem;
		font-weight: 500;
	}

	input,
	textarea,
	button {
		width: 100%;
		font: inherit;
		border-radius: 0.65rem;
	}

	input,
	textarea {
		border: 1px solid rgba(255, 255, 255, 0.12);
		background: rgba(255, 255, 255, 0.04);
		color: inherit;
		padding: 0.75rem 1rem;
		resize: vertical;
	}

	button {
		border: none;
		background: #f8df72;
		color: #0d0d0d;
		padding: 0.75rem 1rem;
		font-weight: 600;
		cursor: pointer;
		transition: transform 120ms ease, box-shadow 120ms ease;
	}

	button:hover {
		transform: translateY(-1px);
		box-shadow: 0 10px 18px rgba(0, 0, 0, 0.2);
	}

	button.ghost {
		width: auto;
		background: transparent;
		color: inherit;
		border: 1px solid rgba(255, 255, 255, 0.2);
	}

	.status {
		margin: 0.25rem 0 0;
		padding: 0.35rem 0.65rem;
		border-radius: 0.45rem;
		font-size: 0.9rem;
	}

	.status.success {
		background: rgba(98, 231, 160, 0.15);
		color: rgb(98, 231, 160);
	}

	.status.error {
		background: rgba(255, 90, 90, 0.12);
		color: rgb(255, 128, 128);
	}

	.admin.shell {
		display: grid;
		grid-template-columns: minmax(230px, 300px) 1fr;
		gap: 1.5rem;
	}

	.sidebar {
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 1rem;
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.sidebar__header h2 {
		margin: 0;
	}

	.sidebar ul {
		list-style: none;
		margin: 0;
		padding: 0;
		flex: 1;
		overflow-y: auto;
	}

	.sidebar__actions {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.ghost-link {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 0.65rem;
		padding: 0.6rem 0.75rem;
		font-weight: 600;
		color: inherit;
		text-decoration: none;
		border: 1px solid rgba(255, 255, 255, 0.2);
		transition: transform 120ms ease, box-shadow 120ms ease;
	}

	.ghost-link:hover {
		transform: translateY(-1px);
		box-shadow: 0 10px 18px rgba(0, 0, 0, 0.2);
	}

	.skeleton-line {
		height: 0.8rem;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.12);
		animation: pulse 1.6s ease-in-out infinite;
	}

	.skeleton-line.wide {
		width: 80%;
	}

	.skeleton-line.small {
		width: 45%;
	}

	.skeleton-block {
		border-radius: 1rem;
		background: rgba(255, 255, 255, 0.08);
		animation: pulse 1.6s ease-in-out infinite;
	}

	.skeleton-block.tall {
		height: 60vh;
	}

	.skeleton-list li {
		display: grid;
		gap: 0.4rem;
		padding: 0.6rem 0.75rem;
		border-radius: 0.65rem;
		background: rgba(255, 255, 255, 0.03);
	}

	.skeleton-pill {
		height: 2.2rem;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.1);
		animation: pulse 1.6s ease-in-out infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 0.4;
		}
		50% {
			opacity: 1;
		}
	}

	.sidebar li {
		margin-bottom: 0.35rem;
	}

	.sidebar li a {
		display: flex;
		flex-direction: column;
		padding: 0.6rem 0.75rem;
		border-radius: 0.65rem;
		text-decoration: none;
		color: inherit;
		border: 1px solid transparent;
	}

	.sidebar li.selected a {
		border-color: rgba(248, 223, 114, 0.7);
		background: rgba(248, 223, 114, 0.12);
	}

	.post-title {
		font-weight: 600;
	}

	.post-slug {
		font-size: 0.85rem;
		opacity: 0.7;
	}

	.editor {
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(255, 255, 255, 0.07);
		border-radius: 1rem;
		padding: clamp(1rem, 2vw, 1.5rem);
		display: flex;
		flex-direction: column;
		min-height: 70vh;
	}

	.editor__header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin-bottom: 1rem;
	}

	.editor__form {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.editor__actions {
		display: flex;
		justify-content: flex-end;
	}

	.empty-state {
		margin: auto;
		text-align: center;
		opacity: 0.75;
	}

	@media (max-width: 900px) {
		.admin.shell {
			grid-template-columns: 1fr;
		}

		.sidebar {
			order: 2;
		}
	}
</style>
