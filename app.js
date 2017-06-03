const os = require("os");
const fs = require("fs");
const path = require("path");
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
const memoryTimeout = 4000; // ms to wait for memory to be freed
const pageLimit = 2; // Number of pages to go through for each language before quitting
let baseQueue = [];
const pageQueue = [];
const contentQueue = [];
const results = {};
// Generate baseQueue
for (language of languages) {
	for (i = 0; i < swears.length; i = i + 3) {
		baseQueue.push({
			phrase: `${swears[i]} OR ${swears[i + 1]} OR ${swears[i + 2]} in:file language:"${language}"`,
			language: language
		});
	}
}
let memoryAvailable = () => os.freemem() <= os.totalmem() * .80;

baseQueue.splice(0, 73);

// GitHub Search API requests are limited to 30 per minute.
// Therefore, the baseTimer is run every 4 seconds and pageTimer is run every 4 seconds.
// This makes a total of 30 API requests per minute.

crawl(baseQueue.shift(), 1);

function crawl(query, pageNumber) {
	console.log("QUERY:", query.phrase, "PAGE:", pageNumber);
	if (!memoryAvailable()) {
		setTimeout(crawl, memoryTimeout, query, pageNumber);
		return;
	}
	github.search.code({
		q: query.phrase,
		per_page: 100,
		page: pageNumber,
		sort: "indexed"
	})
	.then(results => {
		for (file of results.data.items) {
			contentQueue.push({
				phrase: query.phrase,
				language: query.language,
				repo: file.repository.name,
				owner: file.repository.owner.login,
				path: file.path
			});
		}
		console.log(contentQueue.length);
		if (pageNumber < pageLimit) {
			crawl(query, pageNumber + 1);
		}
		else {
			if (!baseQueue.length) {
				console.log("Finished queries");
				return;
			}
			else crawl(baseQueue.shift(), 1);
		}
	})
	.catch(err => {
		if (err.message.includes("abuse detection mechanism")) {
			let retryAfter = err.headers["retry-after"];
			console.log(`RETRYING AFTER ${retryAfter}s - QUERY: ${query.phrase} PAGE: ${pageNumber}`)
			setTimeout(crawl, retryAfter * 1000, query, pageNumber); 
		} else {
			console.log(err);
			console.log("TRYING AGAIN!");
			crawl(query, pageNumber);
		}
	});
}

// const baseTimer = setInterval(() => {
// 	if (!memoryAvailable() || !baseQueue.length) return;
// 	const query = baseQueue.shift();
// 	github.search.code({
// 		q: query,
// 		per_page: 100,
// 		page: 1
// 	}).then(result => {
// 		console.log(result);
// 		if(result.meta.link && Number(result.meta.link.split(";")[0].split("&page=")[1].split("&")[0])) {
// 			const nextPage = Number(result.meta.link.split(";")[0].split("&page=")[1].split("&")[0]); // Hacky, but works.
// 			pageQueue.push({
// 				phrase: query.phrase,
// 				language: query.language,
// 				nextPage: nextPage
// 			});
// 		}

// 		for(file of result.data.items) {
// 			contentQueue.push({
// 				phrase: query.phrase,
// 				language: query.language,
// 				repo: file.repository.name,
// 				owner: file.repository.owner.login,
// 				path: file.path
// 			});
// 		}
// 	}).catch(err => {
// 		if(err.message.includes("abuse detection mechanism")) {
// 			console.log("GitHub API rate limit was exceeded. Requeuing query to search again later.")
// 			baseQueue.unshift(query);
// 		} else console.log(err);
// 	});
// }, 4000);

// const pageLimit = 1;
// const pageTimer = setInterval(() => {
// 	if(memoryIsAvailable()) {
// 		if(pageQueue.length) {
// 			const query = pageQueue[0];
// 			pageQueue.shift();

// 			console.log(`Continuing search for ${query.language} files containing "${query.phrase}" on page ${query.nextPage}.`);

// 			github.search.code({
// 				q: `${query.phrase} in:file language:${query.language}`,
// 				per_page: 100,
// 				page: query.nextPage
// 			}).then(result => {
// 				if(result.meta.link && Number(result.meta.link.split(";")[0].split("&page=")[1].split("&")[0]) && Number(result.meta.link.split(";")[0].split("&page=")[1].split("&")[0]) <= pageLimit) {
// 					const nextPage = Number(result.meta.link.split(";")[0].split("&page=")[1].split("&")[0]); // Hacky, but works.
// 					pageQueue.push({
// 						phrase: query.phrase,
// 						language: query.language,
// 						nextPage: nextPage
// 					});
// 				}

// 				for(file of result.data.items) {
// 					contentQueue.push({
// 						phrase: query.phrase,
// 						language: query.language,
// 						repo: file.repository.name,
// 						owner: file.repository.owner.login,
// 						path: file.path
// 					});
// 				}
// 			}).catch(err => {
// 				if(err.message.includes("abuse detection mechanism")) {
// 					console.log("GitHub API rate limit was exceeded. Requeuing query to search again later.")
// 					pageQueue.unshift(query);
// 				} else console.log(err);
// 			});
// 		}
// 	}
// }, 4000);

// // GitHub's regular API requests are limited to 5,000 per hour or ~83 per minute.
// // Therefore, the contentTimer is run every second.
// // This makes a total of 60 API requests per minute.

// const contentTimer = setInterval(() => {
// 	if(memoryIsAvailable()) {
// 		if(contentQueue.length) {
// 			const query = contentQueue[0];
// 			contentQueue.shift();

// 			console.log(`Searching ${query.language} file content for instances of "${query.phrase}."`);

// 			github.repos.getContent({
// 				owner: query.owner,
// 				repo: query.repo,
// 				path: query.path
// 			}).then(result => {
// 				const content = new Buffer(result.data.content, "base64").toString("utf8");

// 				if(!results[query.language]) {
// 					results[query.language] = {};
// 				}
// 				if(!results[query.language][query.phrase]) {
// 					results[query.language][query.phrase] = 0;
// 				}
// 				results[query.language][query.phrase] += (content.match(new RegExp(query.phrase, "g")) || []).length;
// 				jsonFile.writeFile("./results.json", JSON.stringify(results, null, 4), (err) => {
// 					if (err) console.log(`Write failed: ${err}`)
// 				});
// 			}).catch(err => {
// 				if(err.message.includes("abuse detection mechanism")) {
// 					console.log("GitHub API rate limit was exceeded. Requeuing query to search again later.")
// 					contentQueue.unshift(query);
// 				}
// 				else console.log(err);
// 			});
// 		}
// 	}
// }, 1000);