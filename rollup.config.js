import * as fs from "fs";
import * as path from "path";
import copy from "rollup-plugin-copy";
import watch from "rollup-plugin-watch";
import scss from "rollup-plugin-scss";
import {getBuildPath} from "./foundry-path.js";
import {RollupManifestBuilder} from "./build/rollup-plugin-manifest-builder.js";

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf-8"));

const systemPath = getBuildPath(packageJson.name);

console.log(`Bundling to ${systemPath}`);

export default cliArgs => {
	return ({
		input: ["module/js/main.js"],
		output: {
			file: path.join(systemPath, "module.js"),
		},
		plugins: [
			RollupManifestBuilder.getPlugin(systemPath),
			scss({fileName: "css/module.css"}),
			copy({
				targets: [
					{src: "module/lang/*", dest: path.join(systemPath, "lang")},
					{src: "module/templates/*", dest: path.join(systemPath, "templates")},
				].filter(Boolean),
			}),
			process.env.NODE_ENV === "production"
				? null
				// FIXME this does not track *new* files, only changes/deletions to existing files
				: watch({
					dir: path.join(process.cwd(), "module"),
					include: [
						/module\/(lang|scss|templates)(\/.*)?/,
					],
				}),
		].filter(Boolean),
	});
};
