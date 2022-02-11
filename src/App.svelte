<script>
	import { onMount } from 'svelte';
	import Progress from '@rutynka/helper-progress'
	import Bar from '@rutynka/helper-bar-board'

	let allTheFish = {itemListElement:[]}

	export let name
	const questionsInterval = 15000
	const HIGHTLIHT_WRONG = 5000
	let quiz_data = []
	let cycle = 0
	let correct = 0
	let wrong = 0
	let current = ''
	let interval = {}
	let parent_node_name = 'figure'

	let prgs;
	let bb;

	$: {console.log( `${name}`)}

	function handleClick(ev) {
		let answer = ev.target.getAttribute('data-answer');
		console.log("clicked " + answer);
		if (answer === bb.question) {
			ev.target.parentNode.classList.add('correct');
			correct++;
			bb.set_correct(answer);
			quiz_data.splice(cycle - 1, 1);
			startTimerQuestions();
		} else {
			bb.set_wrong(bb.question, answer);
			ev.target.closest(parent_node_name).classList.add('js--wrong_answer');
			setTimeout(()=>{
				ev.target.closest(parent_node_name).classList.remove('js--wrong_answer');
			}, HIGHTLIHT_WRONG);
			wrong++;
		}
		if (correct === allTheFish.itemListElement.length) {
			console.log('correct:', correct)
			stopQuestionsAndWin();
			bb.set_timer = false
		}
		return answer
	}

	function shuffle(a) {
		for (let i = a.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[a[i], a[j]] = [a[j], a[i]];
		}
		return a;
	}

	function cycleText () {
		if (quiz_data.length <= cycle) {
			cycle = 0;
			quiz_data = shuffle(quiz_data);
			console.log(quiz_data.length , 'reset');
		}
		if (quiz_data.length) {
			bb.question = quiz_data[cycle].item.name
		}
		cycle++;
	}

	function stopQuestionsAndWin () {
		console.log('Win')
		clearInterval(interval);
		prgs.store_progress({collectionName:allTheFish.name,exerciseTime:bb.get_timer()})
		//bb_helper.progress_request(data);
		bb.question = 'Excellent !'
		document.body.classList.add('bg-correct')
	}

	function startTimerQuestions () {
		clearInterval(interval);
		cycleText();
		bb.set_timer = true;
		interval = window.setInterval(cycleText, questionsInterval);
	}

	function start() {
		document.getElementById('run').classList.remove('js--hidden_btn_run');
		document.getElementById('run').addEventListener('click', () => {
			console.log('start pressed')
			cycle = 0; correct = 0; wrong = 0
			bb.reset = true;
			prgs.show = false;
			document.body.classList.remove('bg-correct')
			quiz_data = shuffle(allTheFish.itemListElement.slice());
			// let $img = document.getElementsByClassName('image');
			let img = [...document.querySelectorAll('[data-search]')];
			img.map(el => el.classList.toggle('js--hidden_answer'));
			// let $imgNames = [...document.querySelectorAll('[data-search]')];
			[].forEach.call(img, el => el.parentNode.classList.remove('correct'));
			startTimerQuestions()

		})

	}

	onMount(async () => {
		console.log('start plugin:', name)
		// fetch('/assets/jsonld/20-Fish_of_Australia.json')
		// fetch('/assets/jsonld/18-Parrot_stubs.json')
		fetch('/assets/jsonld/6-Mięśnie_człowieka.json')
		// fetch('/assets/jsonld/303-Nato_Army_officers.json')
		// fetch('/assets/jsonld/56-Muscles_of_the_upper_limb.json')
		// fetch('/assets/jsonld/142-Food_and_drink_paintings.json')
				.then(r => r.json())
				.then(data => {
					allTheFish = data;
					quiz_data = shuffle(data.itemListElement.slice());
				})


		document.addEventListener('DOMContentLoaded', start);


	})
</script>
	<Bar bind:this={bb}/>
	<div class="content">
		{#each allTheFish.itemListElement as row}
			<figure on:click={handleClick} class="{current === 'correct' ? 'js--correct' : ''}">
				<img loading="lazy" width="200" class="image" src="{ row.item.image.thumbnail.contentUrl }" data-answer="{ row.item.name }" alt="{ row.item.name }">
				<a class="wiki" rel="noreferrer nofollow" target="_blank" href="{ row.item.url }">W</a>
				<figcaption data-search class="desc">{ row.item.name }</figcaption>
			</figure>
		{/each}
	</div>

<Progress bind:this={prgs}/>

<style>
	.content {
		background-color: #f5f5f5;
    	display: flex;
    	flex-wrap: wrap;
	}
	figure {
		margin:5px;
		display:table;
	}
	figure, img {
		max-width: 200px;
	}
	:global(figure.correct) {  display:none; }
	figcaption {
		display: table-caption;
    	caption-side: bottom;
	}
	.wiki {
		position:absolute;
		right: 3px;
		top: 3px;
		color: transparent;
		text-decoration: none;
		padding: 3px;
	}
	.wiki:hover {
		background-color:white;
		color:black;
	}
	img:hover {opacity:0.5;background-color:white; }

	:global(.desc.js--hidden_answer) {
		visibility:hidden;
	}
	:global(.js--correct, .js--hidden_answer) { display:none; }
	.desc {
		font-size: 14px;
		display: block;
		text-align: center;
		position: relative;
		top: -5px;

	}
</style>