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
const retryTimeout = 2000;
const filesPerPage = 100;
const pageLimit = 5; // Number of pages to go through for each language before quitting
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
		per_page: filesPerPage,
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
		if (pageNumber < pageLimit) {
			crawl(query, pageNumber + 1);
		}
		else {
			if (!baseQueue.length) {
				console.log("Finished queries");
				fs.writeFileSync("contentQueue.json", JSON.stringify(contentQueue, null, 2), "utf8");
				return;
			}
			else crawl(baseQueue.shift(), 1);
		}
	})
	.catch(err => {
		if (err.message.includes("rate limit exceeded")) {
			let resetTimestamp = err.headers["x-ratelimit-reset"];
			console.log("RESET TIMESTAMP:", resetTimestamp);
			let currentTimestamp = Date.now() / 1000;
			let retryAfter = resetTimestamp - currentTimestamp;
			console.log(`RATE LIMIT! RETRYING AFTER ${retryAfter}s - QUERY: ${query.phrase} PAGE: ${pageNumber}`);
			setTimeout(crawl, retryAfter * 1000, query, pageNumber);
			return;
		}
		if (err.message.includes("abuse detection mechanism")) {
			let retryAfter = err.headers["retry-after"];
			console.log(`ABUSE DETECTION! RETRYING AFTER ${retryAfter}s - QUERY: ${query.phrase} PAGE: ${pageNumber}`)
			setTimeout(crawl, retryAfter * 1000, query, pageNumber); 
		} else {
			console.log(err);
			console.log("TRYING AGAIN!");
			setTimeout(crawl, retryTimeout, query, pageNumber);
		}
	});
}