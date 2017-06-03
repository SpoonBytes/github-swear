const os = require("os");
const fs = require("fs");
const path = require("path");
const GitHubApi = require("github");
const restify = require("restify");

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
const pageLimit = 10; // Number of pages to go through for each language before quitting
let readingStarted = false;
let baseQueue = [];
const contentQueue = [];
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
			contentQueue.push({
				phrase: query.phrase,
				language: query.language,
				repo: file.repository.name,
				owner: file.repository.owner.login,
				path: file.path
			});
		if (!readingStarted) {
			readFile(contentQueue.shift());
			readingStarted = true;
		}
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

let swearSearch = new RegExp(swears.join("|"), "gi");
let server = restify.createStringClient({url: "http://localhost:8080"});

function readFile(file) {
	if (!memoryAvailable()) {
		setTimeout(readFile, memoryTimeout, file);
		return;
	}
	github.repos.getContent({
		owner: file.owner,
		repo: file.repo,
		path: file.path
	})
	.then(result => {
		const content = new Buffer(result.data.content, "base64").toString("utf8");
		let numSwears = content.match(swearSearch).length;
		server.get(`/report/${file.language}/${numSwears}`, () => {});
		if (!contentQueue.length) {
			readingStarted = false; // Other loop will start another read eventually
		}
		else {
			readFile(contentQueue.shift());
		}
	})
	.catch(err => {
		if (err.message.includes("abuse detection mechanism")) {
			let retryAfter = err.headers["retry-after"];
			console.log(`RETRYING AFTER ${retryAfter}s - FILE: ${file.path}`)
			setTimeout(readFile, retryAfter * 1000, file); 
		} else {
			console.log(err);
			console.log("TRYING AGAIN!");
			readFile(file);
		}
	});
}