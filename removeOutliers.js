let results = require("./results");
let summaries = require("./summaries");
const fs = require("fs");


for (language in results) {
	let samples = results[language];
	let q1 = +summaries[language].q1;
	let q3 = +summaries[language].q3;
	let iqr = +summaries[language].iqr;
	let outlierMin = q1 - 1.5 * iqr;
	let outlierMax = q3 + 1.5 * iqr;
	for (i = 0; i < samples.length; i++) {
		let val = +samples[i];
		if (val < outlierMin || val > outlierMax) {
			samples.splice(i, 1);
		}
	}
}

fs.writeFileSync("results-outliers-removed.json", JSON.stringify(results, null, 2), (err) => {});