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

const swearsList = fs.readFileSync('swears.txt').toString().split("\n");
const swears = [];
let swear;
let swearIndex = 0;
for(swear of swearsList) {
	swears.push({
		word: swear,
		pages: null,
		pageNumber: 1,
		files: []
	});
}

console.log(`Beginning search for swear word "${swears[swearIndex].word}" on page 1."`);

// Search API requests are limited to 30 per minute.
// A request is performed every two seconds (totaling 30 requests per minute) to meet the requirements.
const rateLimiter = setInterval(() => {
	if(swearIndex >= swears.length) {
		clearInterval(rateLimiter);
		return;
	}

	swear = swears[swearIndex];
	github.search.code({
		q: swear.word + " in:file",
		page: swear.pageNumber,
		per_page: 100
	}).then(result => {
		if(!swears[swearIndex].pages) {
			const pages = Number(result.meta.link.split(",")[1].split("&page=")[1].split("&")[0]); // Hacky, but works.
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

		if(swears[swearIndex].pageNumber === swears[swearIndex].pages) {
			console.log(`Ending search for swear word "${swears[swearIndex].word}."`);
			swearIndex += 1;
			console.log(`Starting next search for swear word "${swears[swearIndex].word} on page 1."`);
		} else {
			swears[swearIndex].pageNumber += 1;
			console.log(`Continuing search for swear word "${swears[swearIndex].word}" on page ${swears[swearIndex].pageNumber}.`);
		}
	}).catch(err => console.error);
}, 2000);

death((signal, err) => {
	console.log("Searching has been stopped. Please wait while results are stored...");
	jsonFile.writeFile("./results.json", languages, err => {
		if(err) console.error(err);
		process.exit();
	});
});