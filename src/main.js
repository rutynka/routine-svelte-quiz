import App from './App.svelte';

const app = new App({
	target: document.getElementsByTagName('main')[0],
	props: {
		name: 'rutynka_svald_wiki_basic',
	}
});

export default app;