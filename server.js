const restify = require("restify");
const os = require("os");
const fs = require("fs");

const server = restify.createServer({
	name: "Swear-Search"
});
const languages = fs
	.readFileSync("languages.txt")
	.toString()
	.split("\n");
var metrics = {
	started: +new Date(),
	lastUpdated: +new Date(),
	currentTimestamp: +new Date(),
	remaining: 0
};
function updateMetrics() {
	metrics.memory = {
		free: os.freemem(),
		total: os.totalmem(),
		usage: ((os.totalmem() - os.freemem()) / os.totalmem()).toFixed(2),
		available: os.freemem() <= os.totalmem() * 0.8
	};
	metrics.currentTimestamp = +new Date();
}
updateMetrics();
metrics.languages = {};
for (language of languages) {
	metrics.languages[language] = [];
}

server.use(restify.bodyParser());

server.get("/setRemaining/:remaining", (req, res, next) => {
	if (
		req.connection.remoteAddress != "::ffff:127.0.0.1" &&
		req.connection.remoteAddress != "::1"
	)
		return res.end();
	metrics.remaining = req.params.remaining;
	res.end();
});

server.get("/report/:language/:swears", (req, res, next) => {
	if (
		req.connection.remoteAddress != "::ffff:127.0.0.1" &&
		req.connection.remoteAddress != "::1"
	)
		return res.end();
	metrics.languages[req.params.language].push(req.params.swears);
	metrics.lastUpdated = +new Date();
	metrics.remaining--;
	res.end();
});

server.get("/", (req, res, next) => {
	updateMetrics();
	res.write(JSON.stringify(metrics, null, 2));
	res.end();
});

server.listen(8080);

setInterval(() => {
	fs.writeFile(
		`${metrics.started}.json`,
		JSON.stringify(metrics, null, 2),
		err => {}
	);
}, 60000);
