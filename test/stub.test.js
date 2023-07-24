import fs from "fs";
const packageJson = JSON.parse(fs.readFileSync("package.json", "utf-8"));

test(
	"That the framework is functioning",
	() => {
		expect(packageJson.name).toBe("polmap");
	},
);
