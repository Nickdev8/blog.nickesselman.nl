<script lang="ts">
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import type { PageData } from './$types';

	export let data: PageData;

	const formatDate = (value: number) => new Date(value).toLocaleString();
	const formatShortDate = (value: number) =>
		new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
	const formatLongDate = (value: number) =>
		new Date(value).toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});

	const refreshIntervalMs = 30000;

	onMount(() => {
		if (!data.loggedIn) return;
		const timer = window.setInterval(() => {
			void invalidateAll();
		}, refreshIntervalMs);

		return () => window.clearInterval(timer);
	});

	const chartWidth = 640;
	const chartHeight = 220;
	const chartPadding = { x: 24, y: 24 };
	let hoverIndex = -1;

	const getVisitPoints = (series: { count: number }[], maxValue: number) => {
		if (series.length === 0) return '';
		const innerWidth = chartWidth - chartPadding.x * 2;
		const innerHeight = chartHeight - chartPadding.y * 2;
		const step = series.length > 1 ? innerWidth / (series.length - 1) : 0;
		return series
			.map((entry, index) => {
				const x = chartPadding.x + index * step;
				const y =
					chartPadding.y + innerHeight - (entry.count / maxValue) * innerHeight;
				return `${x},${y}`;
			})
			.join(' ');
	};

	$: visitSeries = data?.visitSeries ?? [];
	$: maxVisits = Math.max(1, ...visitSeries.map((entry) => entry.count));
	$: visitPoints = getVisitPoints(visitSeries, maxVisits);
	$: visitPointData = visitSeries.map((entry, index) => {
		const innerWidth = chartWidth - chartPadding.x * 2;
		const innerHeight = chartHeight - chartPadding.y * 2;
		const step = visitSeries.length > 1 ? innerWidth / (visitSeries.length - 1) : 0;
		const x = chartPadding.x + index * step;
		const y = chartPadding.y + innerHeight - (entry.count / maxVisits) * innerHeight;
		return { x, y, entry };
	});
	$: lastIndex = visitSeries.length - 1;
	$: lastPoint = lastIndex >= 0 ? visitSeries[lastIndex] : null;
	$: lastX =
		chartPadding.x +
		(lastIndex > 0 ? (chartWidth - chartPadding.x * 2) / lastIndex : 0) * lastIndex;
	$: lastY =
		lastPoint
			? chartPadding.y +
				(chartHeight - chartPadding.y * 2) -
				(lastPoint.count / maxVisits) * (chartHeight - chartPadding.y * 2)
			: chartHeight - chartPadding.y;
	$: hoverPoint = hoverIndex >= 0 ? visitPointData[hoverIndex] : null;
</script>

{#if !data.loggedIn}
	<main class="analytics auth">
		<section class="panel">
			<h1>Reader Analytics</h1>
			<p>Log in to view analytics.</p>
			<a class="button" href="/admin">Go to admin login</a>
		</section>
	</main>
{:else}
	<main class="analytics shell">
		<header class="analytics__header">
			<div>
				<p class="eyebrow">Overview</p>
				<h1>Reader Analytics</h1>
			</div>
			<a class="button ghost" href="/admin">Back to editor</a>
		</header>

		<section class="grid">
			<div class="card">
				<p class="label">Total visits</p>
				<p class="value">{data.totals?.totalVisits ?? 0}</p>
			</div>
			<div class="card">
				<p class="label">Total post reads</p>
				<p class="value">{data.totals?.totalPostViews ?? 0}</p>
			</div>
			<div class="card">
				<p class="label">Unique readers</p>
				<p class="value">{data.totals?.uniqueReaders ?? 0}</p>
			</div>
			<div class="card">
				<p class="label">Named readers</p>
				<p class="value">{data.totals?.uniqueNamedReaders ?? 0}</p>
			</div>
		</section>

		<section class="section">
			<h2>Visits over time</h2>
			{#if visitSeries.length === 0}
				<p class="muted">No visits yet.</p>
			{:else}
				<div class="chart">
					<svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label="Visits over time">
						<defs>
							<linearGradient id="visitFill" x1="0" x2="0" y1="0" y2="1">
								<stop offset="0%" stop-color="rgba(248, 223, 114, 0.5)" />
								<stop offset="100%" stop-color="rgba(248, 223, 114, 0)" />
							</linearGradient>
						</defs>
						<polyline
							points={visitPoints}
							fill="none"
							stroke="rgba(248, 223, 114, 0.95)"
							stroke-width="3"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
						<polyline
							points={`${visitPoints} ${chartWidth - chartPadding.x},${chartHeight - chartPadding.y} ${chartPadding.x},${chartHeight - chartPadding.y}`}
							fill="url(#visitFill)"
							stroke="none"
						/>
						<circle cx={lastX} cy={lastY} r="5" fill="#f8df72" />
						<circle cx={lastX} cy={lastY} r="9" fill="rgba(248, 223, 114, 0.2)" />
						{#each visitPointData as point, index}
							<circle
								cx={point.x}
								cy={point.y}
								r={index === hoverIndex ? 6 : 4}
								fill={index === hoverIndex ? '#f8df72' : 'rgba(248, 223, 114, 0.5)'}
							/>
							<circle
								cx={point.x}
								cy={point.y}
								r="12"
								fill="transparent"
								class="chart-hit"
								on:mouseenter={() => (hoverIndex = index)}
								on:focus={() => (hoverIndex = index)}
								on:mouseleave={() => (hoverIndex = -1)}
								tabindex="0"
							/>
						{/each}
					</svg>
					{#if hoverPoint}
						<div
							class="chart__tooltip"
							style={`left: ${(hoverPoint.x / chartWidth) * 100}%; top: ${(hoverPoint.y / chartHeight) * 100}%;`}
						>
							<span>{formatLongDate(hoverPoint.entry.timestamp)}</span>
							<strong>{hoverPoint.entry.count} visits</strong>
						</div>
					{/if}
					<div class="chart__footer">
						<span>{formatShortDate(visitSeries[0].timestamp)}</span>
						<span>{formatShortDate(visitSeries[visitSeries.length - 1].timestamp)}</span>
					</div>
				</div>
			{/if}
		</section>

		<section class="section">
			<h2>Post performance</h2>
			{#if data.perPost.length === 0}
				<p class="muted">No post reads yet.</p>
			{:else}
				<div class="table">
					<div class="row head">
						<span>Post</span>
						<span>Reads</span>
						<span>Unique readers</span>
					</div>
					{#each data.perPost as post}
						<div class="row">
							<div>
								<p class="row-title">{post.title}</p>
								<p class="row-sub">{post.slug}</p>
							</div>
							<span>{post.totalViews}</span>
							<span>{post.uniqueReaders}</span>
						</div>
					{/each}
				</div>
			{/if}
		</section>

		<section class="split">
			<div class="section">
				<h2>Devices</h2>
				{#if data.deviceCounts.length === 0}
					<p class="muted">No device data yet.</p>
				{:else}
					<ul>
						{#each data.deviceCounts as [device, count]}
							<li>
								<span class="row-title">{device}</span>
								<span class="pill">{count}</span>
							</li>
						{/each}
					</ul>
				{/if}
			</div>

			<div class="section">
				<h2>Referrers</h2>
				{#if data.referrerCounts.length === 0}
					<p class="muted">No referrers yet.</p>
				{:else}
					<ul>
						{#each data.referrerCounts as [source, count]}
							<li>
								<span class="row-title">{source}</span>
								<span class="pill">{count}</span>
							</li>
						{/each}
					</ul>
				{/if}
			</div>

			<div class="section">
				<h2>Language</h2>
				{#if data.languageCounts.length === 0}
					<p class="muted">No language choices yet.</p>
				{:else}
					<ul>
						{#each data.languageCounts as [language, count]}
							<li>
								<span class="row-title">{language === 'nl' ? 'Dutch' : 'Original'}</span>
								<span class="pill">{count}</span>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		</section>

		<section class="section">
			<h2>Private reader notes</h2>
			{#if data.notes.length === 0}
				<p class="muted">No private notes yet.</p>
			{:else}
				<div class="notes-list">
					{#each data.notes as note}
						<article class="note">
							<div class="note-meta">
								<strong>{note.name}</strong>
								<span>{note.storyTitle}</span>
								<span>{formatDate(note.createdAt)}</span>
								<span class:delivery-failed={note.emailStatus === 'failed'}>{note.emailStatus}</span>
							</div>
							<p>{note.message}</p>
						</article>
					{/each}
				</div>
			{/if}
		</section>

		<section class="section">
			<h2>Readers</h2>
			{#if data.names.length === 0}
				<p class="muted">No names submitted yet.</p>
			{:else}
				<div class="table readers-table">
					<div class="row row--four head">
						<span>Name</span>
						<span>Visits</span>
						<span>Last seen</span>
						<span>Posts visited</span>
					</div>
					{#each data.names as entry}
						{@const reader = data.readerBreakdown.find((item) => item.name === entry.name)}
						<div class="row row--four">
							<span class="row-title">
								{entry.name}
								{#if entry.nameCount > 1}
									<span class="row-sub name-meta">
										({entry.nameCount}x · {entry.devices.join('/')})
									</span>
								{/if}
							</span>
							<span>{entry.visitCount}</span>
							<span>{formatDate(entry.lastSeen)}</span>
							<div class="visited-tags">
								{#if reader && reader.posts.length > 0}
									{#each reader.posts as post}
										<span class="tag">{post.title}</span>
									{/each}
								{:else}
									<span class="muted">—</span>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</section>
	</main>
{/if}

<style>
	:global(body.is-admin) {
		background: var(--app-bg, #050505);
	}

	.analytics {
		padding: clamp(1rem, 3vw, 2.5rem);
		color: #f3f4f6;
		background: #050505;
	}

	.analytics.auth {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.panel {
		width: min(420px, 100%);
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 1rem;
		padding: 2rem;
		backdrop-filter: blur(20px);
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
		text-align: center;
	}

	.analytics.shell {
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}

	.analytics__header {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.analytics h1 {
		margin: 0.35rem 0 0;
		font-size: clamp(1.8rem, 3vw, 2.4rem);
	}

	.chart {
		border-radius: 1.25rem;
		border: 1px solid rgba(255, 255, 255, 0.08);
		background: rgba(255, 255, 255, 0.03);
		padding: 1.25rem 1.5rem;
		box-shadow: 0 16px 40px rgba(0, 0, 0, 0.3);
		position: relative;
	}

	.chart svg {
		display: block;
		width: 100%;
		height: auto;
	}

	.chart__footer {
		margin-top: 0.75rem;
		display: flex;
		justify-content: space-between;
		font-size: 0.75rem;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: rgba(255, 255, 255, 0.45);
	}

	.chart__tooltip {
		position: absolute;
		transform: translate(-50%, -120%);
		padding: 0.4rem 0.7rem;
		border-radius: 0.75rem;
		background: rgba(10, 10, 10, 0.9);
		border: 1px solid rgba(255, 255, 255, 0.12);
		font-size: 0.75rem;
		color: #f8f7f3;
		display: grid;
		gap: 0.1rem;
		pointer-events: none;
		text-align: center;
		box-shadow: 0 12px 28px rgba(0, 0, 0, 0.45);
	}

	.chart__tooltip strong {
		font-weight: 600;
		color: #f8df72;
	}

	.chart-hit {
		cursor: pointer;
	}

	.notes-list {
		display: grid;
		gap: 0.8rem;
	}

	.note {
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 0.75rem;
		padding: 1rem;
		background: rgba(255, 255, 255, 0.03);
	}

	.note p {
		margin: 0.8rem 0 0;
		white-space: pre-wrap;
		line-height: 1.6;
	}

	.note-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 1rem;
		font-size: 0.8rem;
		color: rgba(255, 255, 255, 0.55);
	}

	.note-meta strong {
		color: #f3f4f6;
	}

	.delivery-failed {
		color: rgb(255, 128, 128);
	}

	.eyebrow {
		text-transform: uppercase;
		letter-spacing: 0.35em;
		font-size: 0.65rem;
		color: rgba(255, 255, 255, 0.5);
	}

	.button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 999px;
		padding: 0.5rem 1.25rem;
		font-weight: 600;
		background: #f8df72;
		color: #0d0d0d;
		text-decoration: none;
	}

	.button.ghost {
		background: transparent;
		border: 1px solid rgba(255, 255, 255, 0.2);
		color: #f3f4f6;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: 1rem;
	}

	.card {
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 1rem;
		padding: 1rem 1.25rem;
	}

	.label {
		margin: 0;
		color: rgba(255, 255, 255, 0.55);
		text-transform: uppercase;
		font-size: 0.7rem;
		letter-spacing: 0.2em;
	}

	.value {
		margin: 0.4rem 0 0;
		font-size: 1.8rem;
		font-weight: 600;
	}

	.section h2 {
		margin: 0 0 0.75rem;
		font-size: 1.1rem;
	}

	.table {
		display: grid;
		gap: 0.5rem;
	}

	.row {
		display: grid;
		grid-template-columns: minmax(0, 1.5fr) 0.4fr 0.6fr;
		align-items: center;
		gap: 1rem;
		padding: 0.75rem 1rem;
		background: rgba(255, 255, 255, 0.04);
		border-radius: 0.85rem;
	}

	.row.head {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.2em;
		color: rgba(255, 255, 255, 0.55);
		background: transparent;
		border: 1px solid rgba(255, 255, 255, 0.05);
	}

	.row.row--two {
		grid-template-columns: minmax(0, 1.2fr) 0.8fr;
	}

	.row.row--three {
		grid-template-columns: minmax(0, 0.9fr) 0.7fr minmax(0, 1.4fr);
		align-items: start;
	}

	.row.row--four {
		grid-template-columns: minmax(0, 0.9fr) 0.4fr 0.7fr minmax(0, 1.4fr);
		align-items: start;
	}

	.row-title {
		font-weight: 600;
		margin: 0;
	}

	.row-sub {
		margin: 0.2rem 0 0;
		font-size: 0.8rem;
		opacity: 0.7;
	}

	.name-meta {
		font-size: 0.7rem;
		letter-spacing: 0.02em;
	}

	.split {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 1.5rem;
	}

	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.5rem;
	}

	li {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.75rem;
		padding: 0.65rem 0.9rem;
		border-radius: 0.85rem;
		background: rgba(255, 255, 255, 0.04);
	}

	.pill {
		border-radius: 999px;
		padding: 0.2rem 0.6rem;
		background: rgba(255, 255, 255, 0.08);
		font-size: 0.8rem;
	}

	.names {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.name-pill {
		padding: 0.35rem 0.75rem;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.08);
		font-size: 0.85rem;
	}

	.readers {
		display: grid;
		gap: 1rem;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
	}

	.reader-card {
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 1rem;
		padding: 1rem;
		display: grid;
		gap: 0.6rem;
	}

	.visited-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.tag {
		border-radius: 999px;
		padding: 0.25rem 0.65rem;
		background: rgba(255, 255, 255, 0.08);
		font-size: 0.8rem;
	}

	.muted {
		color: rgba(255, 255, 255, 0.55);
	}

	@media (max-width: 600px) {
		.row {
			grid-template-columns: 1fr;
			gap: 0.35rem;
		}
	}
</style>
