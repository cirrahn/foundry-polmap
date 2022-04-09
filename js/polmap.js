import PoliticalMapLayer from "../classes/PoliticalMapLayer.js";
import PoliticalMapMigrations from "../classes/PoliticalMapMigrations.js";
import config from "./config.js";
import {polmapLog} from "./helpers.js";

Hooks.once("init", () => {
	polmapLog("Initializing polmap", true);

	// Register global module settings
	config.forEach((cfg) => {
		game.settings.register("polmap", cfg.name, cfg.data);
	});
});

Hooks.once("canvasInit", () => {
	canvas.polmap = new PoliticalMapLayer();
	canvas.primary.addChild(canvas.polmap);

	// TODO(Future) use libWrapper?
	const layers = Canvas.layers;
	layers.polmap = PoliticalMapLayer;
	Object.defineProperty(Canvas, "layers", {get: function () {
		return layers;
	}});
});

Hooks.once("ready", () => {
	PoliticalMapMigrations.check().then(() => polmapLog("Migrations complete!"));
});
