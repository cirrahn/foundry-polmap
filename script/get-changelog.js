import fs from "fs";
import {Command} from "commander";

const program = new Command()
	.requiredOption("--tag <tag>", "Tag to find changelog for")
;

program.parse(process.argv);
const params = program.opts();

class ChangelogGetter {
	static run () {
		const lines = fs.readFileSync("CHANGELOG.md", "utf-8")
			.split("\n")
			.map(it => it.trimEnd());

		const tagClean = params.tag.replace(/^v/, "");

		const reVersion = new RegExp(`^#+\\s*v?${tagClean}$`, "i");
		const ixStart = lines.findIndex(l => reVersion.test(l));

		if (!~ixStart) return console.log("(No notable changes.)");

		let ixEnd = ixStart + 1;
		const reOtherVersion = new RegExp(`^#+\\s*v?\\d+\\.\\d+\\.\\d+`, "i");
		for (; ixEnd <= lines.length; ++ixEnd) {
			const l = lines[ixEnd];
			if (reOtherVersion.test(l)) break;
		}

		const linesOut = lines.slice(ixStart + 1, ixEnd);
		const ixFirstContentLine = linesOut.findIndex(l => !!l.trim());
		if (!~ixFirstContentLine) return console.log("(No notable changes.)");

		console.log(linesOut.slice(ixFirstContentLine).join("\n").trimEnd());
	}
}

ChangelogGetter.run();
