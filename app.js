const fs = require("fs");
const path = require("path");
const death = require("death")({ uncaughtException: true });
const GitHubApi = require("github");
const jsonFile = require('jsonfile');

const credentials = require("./credentials.json");
let github = new GitHubApi();
github.authenticate({
	type: "basic",
	username: credentials.username,
	password: credentials.password
});

const languages = {};

fs.readFile('swears.txt', (err, data) => {
	if(err) throw err;

	const swearsText = data.toString().split("\n");
	const swears = [];
	const swearIndex = 0;
	for(swear of swearsText) {
		swears.push({
			word: swear,
			pages: null,
			pageNumber: 1
		});
	}

	const rateLimiter = setInterval(() => {
		if(swearIndex > swears.length) {
			clearInterval(rateLimiter);
			return;
		}

		const swear = swears[swearIndex];
		if(swear.pages && swear.pageNumber > swear.pages) {
			swearIndex += 1;
		} else {
			github.search.code({
				q: swear.word,
				page: swear.pageNumber,
				per_page: 100
			}).then((result) => {
				if(!swears[swearIndex].pages) {
					const pages = result.meta.link.split(",")[1].split("&page=")[1].split("&")[0]; // Hacky, but works.
					swears[swearIndex].pages = pages;
				}

				const code = result.data.items;
				for(file of code) {
					const extension = path.extname(file.path);
					if(!languages[extension]) {
						languages[extension] = {};
					}
					if(!languages[extension][swear.word]) {
						languages[extension][swear.word] = 0;
					}
					languages[extension][swear.word] += 1;
				}
			}).catch((err) => console.error);
		}
	}, 2000)
});

death((signal, err) => {
	jsonFile.writeFile("./results.json", languages, (err) => {
		if(err) console.error(err);
		process.exit();
	});
});