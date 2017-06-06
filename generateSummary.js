let results = require("./results");
const fs = require("fs");
const arr = require("./arr-stat");

let summaries = {};
let confidenceLevel = 1.96;

for (language in results) {
	let samples = results[language];
	samples = samples.sort((a, b) => a - b); // Samples are now in numerical order
	samples = samples.map(Number);
	let half = Math.floor(samples.length / 2);
	let q1 = samples[Math.floor(half / 2)];
	let q3 = samples[Math.floor(samples.length - (half / 2))];
	let stdDev = arr.standardDeviation(samples);
	let stdError = stdDev / Math.sqrt(samples.length);
	let mean = arr.mean(samples);
	let marginOfError = confidenceLevel * stdError;
	summaries[language] = {
		min: +samples[0],
		q1: +q1,
		median: arr.median(samples),
		q3: +q3,
		max: +samples[samples.length - 1],
		iqr: q3 - q1,
		stdDev: stdDev,
		mean: mean,
		marginOfError: marginOfError,
		confidenceInterval: [mean - marginOfError, mean + marginOfError]
	}
	let s = summaries[language];
}

fs.writeFileSync("summaries.json", JSON.stringify(summaries, null, 2), (err) => {});