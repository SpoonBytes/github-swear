let results = require("./results-outliers-removed");
const fs = require("fs");

let summaries = {};

for (language in results) {
	let samples = results[language];
	samples.sort((a, b) => a - b); // Samples are now in numerical order
	samples.map(Number);
	let half = Math.floor(samples.length / 2);
	let median = (samples.length % 2) ? samples[half] : ((samples[half - 1] + samples[half]) / 2.0);
	let q1 = samples[Math.floor(half / 2)];
	let q3 = samples[Math.floor(samples.length - (half / 2))];
	summaries[language] = {
		min: +samples[0],
		q1: +q1,
		median: +median,
		q3: +q3,
		max: +samples[samples.length - 1],
		iqr: q3 - q1
	}
}

fs.writeFileSync("summaries-outliers-removed.json", JSON.stringify(summaries, null, 2), (err) => {});