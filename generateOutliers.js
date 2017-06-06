var results = require("./results");
const fs = require("fs");
let arr = require("./arr-stat");


for (language in results) {
	let newResults = [];
	for (i in results[language]) {
		if (results[language][i] <= 5) newResults.push(results[language][i]);
	}
	results[language] = newResults;
}

fs.writeFileSync("results-capped.json", JSON.stringify(results, null, 2), (err) => {});