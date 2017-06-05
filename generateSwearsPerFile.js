let results = require("./results");
const fs = require("fs");

let swearsPerFile = {};

for (language in results) {
	swearsPerFile[language] = {
		"1": 0,
		"2": 0,
		"3": 0,
		"4": 0,
		"5": 0,
		"6": 0,
		"7": 0,
		"8": 0,
		"9": 0,
		"10": 0,
		"11+": 0
	}
	let samples = results[language];
	for (i in samples) {
		let sample = samples[i];
		switch(+sample) {
			case 1:
				swearsPerFile[language]["1"]++;
				break;
			case 2:
				swearsPerFile[language]["2"]++;
				break;
			case 3:
				swearsPerFile[language]["3"]++;
				break;
			case 4:
				swearsPerFile[language]["4"]++;
				break;
			case 5:
				swearsPerFile[language]["5"]++;
				break;
			case 6:
				swearsPerFile[language]["6"]++;
				break;
			case 7:
				swearsPerFile[language]["7"]++;
				break;
			case 8:
				swearsPerFile[language]["8"]++;
				break;
			case 9:
				swearsPerFile[language]["9"]++;
				break;
			case 10:
				swearsPerFile[language]["10"]++;
				break;
			default:
				swearsPerFile[language]["11+"]++;
				break;
		}
	}
}

fs.writeFile("swearsPerFile.json", JSON.stringify(swearsPerFile, null, 2), (err) => {});