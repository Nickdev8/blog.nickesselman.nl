<script lang="ts">
	import StoryPage from '../../[event]/+page.svelte';
	import type { ActionData, PageData } from './$types';
	export let data: PageData;
	export let form: ActionData;
	$: storyData = data as any;
	$: storyForm = form as any;
</script>

<StoryPage data={storyData} form={storyForm} />
