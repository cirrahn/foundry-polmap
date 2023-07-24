import {polmapLog} from "../helpers.js";

export default class PoliticalMapMigrations {
	static async check () {
		if (!game.user.isGM) return;
		polmapLog("Checking migrations");

		let ver = game.settings.get("polmap", "migrationVersion");

		if (ver == null || !isNaN(ver)) return; // Disable example migration--remove as required

		ver = await this.migration1(ver);
		// ... etc. ...
	}

	static async migration1 (ver) {
		if (ver > 1) return;
		polmapLog("Performing migration #1", true);
		// (Implement as required)
		await game.settings.set("polmap", "migrationVersion", 1);
		return 1;
	}
}
