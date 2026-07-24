import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit({
			// Enable SCSS preprocessing so <style lang="scss"> blocks compile correctly.
			preprocess: vitePreprocess(),

			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }: { filename: string }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			// Every route here is fully client-driven (style upload, rendering) with
			// no server-side data — a static export, deployed to GitHub Pages (see
			// scripts/deploy.sh + .github/workflows/deploy.yml). `strict: true`
			// (the default) fails the build if any route turns out not to be
			// prerenderable, so drift gets caught here rather than at deploy time.
			adapter: adapter({
				pages: 'build',
				assets: 'build'
			})
		})
	]
});
