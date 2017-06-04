const os = require("os");
const fs = require("fs");
const path = require("path");
const GitHubApi = require("github");
const restify = require("restify");

const languages = fs.readFileSync("languages.txt").toString().split("\n");
const swears = fs.readFileSync("swears.txt").toString().split("\n");
const credentials = require("./credentials.json");
let contentQueue = require("./contentQueue.json");
let github = new GitHubApi();
github.authenticate({
	type: "basic",
	username: credentials.username,
	password: credentials.password
});
const memoryTimeout = 4000; // ms to wait for memory to be freed
const retryTimeout = 2000;

let memoryAvailable = () => os.freemem() <= os.totalmem() * .80;

let swearSearch = new RegExp(swears.join("|"), "gi");
let server = restify.createStringClient({url: "http://localhost:8080"});

server.get(`/setRemaining/${contentQueue.length}`, () => {});

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
			console.log("DONE");
			return;
		}
		else {
			let index = Math.floor(Math.random() * contentQueue.length);
			console.log(`Reading index ${index}`);
			readFile(contentQueue[index]);
			contentQueue.splice(index, 1);
		}
	})
	.catch(err => {
		if (err.message.includes("rate limit exceeded")) {
			let resetTimestamp = err.headers["x-ratelimit-reset"];
			let currentTimestamp = Date.now() / 1000;
			let retryAfter = resetTimestamp - currentTimestamp;
			console.log(`RATE LIMIT! RETRYING AFTER ${retryAfter}s - FILE: ${file.path}`);
			setTimeout(readFile, retryAfter * 1000, file);
			return;
		}
		if (err.message.includes("abuse detection mechanism")) {
			let retryAfter = err.headers["retry-after"];
			console.log(`ABUSE DETECTION! RETRYING AFTER ${retryAfter}s - FILE: ${file.path}`)
			setTimeout(readFile, retryAfter * 1000, file); 
		} else {
			console.log(err);
			console.log("TRYING AGAIN!");
			setTimeout(readFile, retryTimeout, file);
		}
	});
}

readFile(contentQueue.shift());

setInterval(() => {
	fs.writeFile("contentQueue.json", JSON.stringify(contentQueue, null, 2), (err) => {});
}, 60000);