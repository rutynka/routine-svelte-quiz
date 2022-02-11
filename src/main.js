import App from './App.svelte';

const app = new App({
	target: document.getElementsByTagName('main')[0],
	props: {
		name: 'rutynka svelte quiz',
	}
});

export default app;