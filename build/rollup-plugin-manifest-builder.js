import fs from "fs";
import path from "path";

export class RollupManifestBuilder {
	static _generateBundle ({systemPath}) {
		const packageJson = JSON.parse(fs.readFileSync("package.json", "utf-8"));

		const manifestJson = {
			"id": packageJson.name,
			"title": "Political Map Overlay",
			"description": `Color hexes/squares according to who owns the territory.`,
			"version": packageJson.version,
			"authors": [
				{
					"name": "cirrahn",
					"url": "https://www.patreon.com/cirrahn",
					"discord": "cirrahn",
					"flags": {
						"patreon": "cirrahn",
						"github": "cirrahn",
					},
				},
				// endregion
			],
			"keywords": [
				"visuals",
				"tools",
			],
			"readme": "README.md",
			"license": "MIT",
			"manifest": `https://github.com/cirrahn/foundry-${packageJson.name}/releases/latest/download/module.json`,
			"download": `https://github.com/cirrahn/foundry-${packageJson.name}/releases/download/v${packageJson.version}/${packageJson.name}.zip`,
			"changelog": `https://raw.githubusercontent.com/cirrahn/foundry-${packageJson.name}/main/CHANGELOG.md`,

			"compatibility": {
				"minimum": "11",
				"verified": "11.306",
			},

			"esmodules": [
				"module.js",
			],
			"styles": [
				"css/module.css",
			],
			"languages": [
				{
					"lang": "en",
					"name": "English",
					"path": "lang/en.json",
				},
			],
			"socket": true,
			"requires": [
				{
					"id": "socketlib",
					"type": "module",
					"compatibility": {
						"minimum": "1.0.13",
					},
				},
			],
		};

		fs.mkdirSync(systemPath, {recursive: true});
		fs.writeFileSync(path.join(systemPath, "module.json"), JSON.stringify(manifestJson, null, "\t"), "utf-8");
	}

	static getPlugin (systemPath) {
		return {
			name: "buildManifest",
			generateBundle: this._generateBundle.bind(this, {systemPath}),
		};
	}
}
