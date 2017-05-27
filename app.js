const os = require("os");
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

const languages = fs.readFileSync("languages.txt").toString().split("\n");
const swears = fs.readFileSync("swears.txt").toString().split("\n");
const baseQueue = [];
const pageQueue = [];
const contentQueue = [];
const results = {};
for(swear of swears) {
	for(language of languages) {
		baseQueue.push({
			word: swear.replace("\r", ""),
			language: language
		});
	}
}

function memoryIsAvailable() {
	return os.freemem() >= 150000000;
}

console.log(`Searching will begin now.`);

// GitHub Search API requests are limited to 30 per minute.
// Therefore, the baseTimer is run every 4 seconds and pageTimer is run every 4 seconds.
// This makes a total of 30 API requests per minute.

const baseTimer = setInterval(() => {
	if(memoryIsAvailable()) {
		if(baseQueue.length) {
			const query = baseQueue[0];
			baseQueue.shift();

			console.log(`Beginning search for ${query.language} files containing "${query.word}" on page 1.`);

			github.search.code({
				q: `${query.word} in:file language:${query.language}`,
				per_page: 100,
				page: 1
			}).then(result => {
				if(result.meta.link && Number(result.meta.link.split(";")[0].split("&page=")[1].split("&")[0])) {
					const nextPage = Number(result.meta.link.split(";")[0].split("&page=")[1].split("&")[0]); // Hacky, but works.
					pageQueue.push({
						word: query.word,
						language: query.language,
						nextPage: nextPage
					});
				}

				for(file of result.data.items) {
					contentQueue.push({
						word: query.word,
						language: query.language,
						repo: file.repository.name,
						owner: file.repository.owner.login,
						path: file.path
					});
				}
			}).catch(err => {
				if(err.message.includes("abuse detection mechanism")) {
					console.log("GitHub API rate limit was exceeded. Requeuing query to search again later.")
					baseQueue.unshift(query);
				} else console.log(err);
			});
		}
	}
}, 4000);

const pageTimer = setInterval(() => {
	if(memoryIsAvailable()) {
		if(pageQueue.length) {
			const query = pageQueue[0];
			pageQueue.shift();

			console.log(`Continuing search for ${query.language} files containing "${query.word}" on page ${query.nextPage}.`);

			github.search.code({
				q: `${query.word} in:file language:${query.language}`,
				per_page: 100,
				page: query.nextPage
			}).then(result => {
				if(result.meta.link && Number(result.meta.link.split(";")[0].split("&page=")[1].split("&")[0])) {
					const nextPage = Number(result.meta.link.split(";")[0].split("&page=")[1].split("&")[0]); // Hacky, but works.
					pageQueue.push({
						word: query.word,
						language: query.language,
						nextPage: nextPage
					});
				}

				for(file of result.data.items) {
					contentQueue.push({
						word: query.word,
						language: query.language,
						repo: file.repository.name,
						owner: file.repository.owner.login,
						path: file.path
					});
				}
			}).catch(err => {
				if(err.message.includes("abuse detection mechanism")) {
					console.log("GitHub API rate limit was exceeded. Requeuing query to search again later.")
					pageQueue.unshift(query);
				} else console.log(err);
			});
		}
	}
}, 4000);

// GitHub's regular API requests are limited to 5,000 per hour or ~83 per minute.
// Therefore, the contentTimer is run every second.
// This makes a total of 60 API requests per minute.

const contentTimer = setInterval(() => {
	if(memoryIsAvailable()) {
		if(contentQueue.length) {
			const query = contentQueue[0];
			contentQueue.shift();

			console.log(`Searching ${query.language} file content for instances of "${query.word}."`);

			github.repos.getContent({
				owner: query.owner,
				repo: query.repo,
				path: query.path
			}).then(result => {
				const content = new Buffer(result.data.content, "base64").toString("utf8");

				if(!results[query.language]) {
					results[query.language] = {};
				}
				if(!results[query.language][query.word]) {
					results[query.language][query.word] = 0;
				}
				results[query.language][query.word] += (content.match(new RegExp(query.word, "g")) || []).length;
			}).catch(err => {
				if(err.message.includes("abuse detection mechanism")) {
					console.log("GitHub API rate limit was exceeded. Requeuing query to search again later.")
					contentQueue.unshift(query);
				}
				else console.log(err);
			});
		}
	}
}, 1000);

death((signal, err) => {
	console.log("Searching has been stopped. Please wait while results are stored...");
	jsonFile.writeFile("./results.json", JSON.stringify(results, null, 4), err => {
		if(err) console.error(err);
		process.exit();
	})
});