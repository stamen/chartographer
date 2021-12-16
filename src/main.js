import App from './App.svelte';

const app = new App({
	target: document.body,
	props: {
		loadDefaultStyle: process.env.NODE_ENV === 'development',
	}
});

export default app;
