import PoliticalMapMigrations from "./classes/PoliticalMapMigrations.js";
import config from "./config.js";
import {polmapLog} from "./helpers.js";
import PoliticalMapLayer from "./layers/PoliticalMapLayer.js";
import OverlayLayer from "./layers/OverlayLayer.js";

Hooks.once("init", () => {
	polmapLog("Initializing polmap", true);

	// Register global module settings
	config.forEach((cfg) => {
		game.settings.register("polmap", cfg.name, cfg.data);
	});

	CONFIG.Canvas.layers.polmap = {group: "interface", layerClass: PoliticalMapLayer};

	Object.defineProperty(canvas, "polmap", {
		value: new PoliticalMapLayer(),
		configurable: true,
		writable: true,
		enumerable: false,
	});
});

Hooks.once("canvasInit", (cvs) => {
	canvas.polmap.canvasInit(cvs);
});

Hooks.once("ready", () => {
	PoliticalMapMigrations.check().then(() => polmapLog("Migrations complete!"));

	OverlayLayer.refreshZIndex();
});
