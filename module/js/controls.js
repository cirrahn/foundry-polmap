import PoliticalMapConfig from "./classes/PoliticalMapConfig.js";
import PaletteControls from "./classes/PaletteControls.js";

let $wrpPaletteControls;

const _doCacheControls = () => {
	if (!$wrpPaletteControls?.length) $wrpPaletteControls = $("#polmap-palette");
};

/**
 * Add control buttons
 */
Hooks.on("getSceneControlButtons", (controls) => {
	if (!game.user.isGM) return;
	controls.push({
		name: "polmap",
		title: game.i18n.localize("POLMAP.Political Map Overlay"),
		icon: "fas fa-handshake",
		layer: "polmap",
		activeTool: "grid",
		tools: [
			{
				name: "polmaptoggle",
				title: game.i18n.localize("POLMAP.Enable/Disable Political Map Overlay"),
				icon: "fas fa-eye",
				onClick: () => {
					canvas.polmap.toggle();
				},
				active: canvas.polmap?.visible,
				toggle: true,
			},
			{
				name: "grid",
				title: game.i18n.localize("POLMAP.Marker Tool"),
				icon: "fas fa-border-none",
			},
			{
				name: "sceneConfig",
				title: game.i18n.localize("POLMAP.Scene Configuration"),
				icon: "fas fa-cog",
				onClick: () => {
					new PoliticalMapConfig({scene: canvas.scene}).render(true);
				},
				button: true,
			},
			{
				name: "clearfog",
				title: game.i18n.localize("POLMAP.Reset Political Map Overlay"),
				icon: "fas fa-trash",
				onClick: () => {
					const dg = new Dialog({
						title: game.i18n.localize("POLMAP.Reset Political Map Overlay"),
						content: game.i18n.localize("POLMAP.Are you sure? Political map areas will be reset."),
						buttons: {
							blank: {
								icon: "<i class=\"fas fa-eye\"></i>",
								label: "Blank",
								callback: () => canvas.polmap.resetLayer(),
							},
							cancel: {
								icon: "<i class=\"fas fa-times\"></i>",
								label: "Cancel",
							},
						},
						default: "reset",
					});
					dg.render(true);
				},
				button: true,
			},
		],
	});
});

/**
 * Handles adding the custom brush controls palette
 * and switching active brush flag
 */
Hooks.on("renderSceneControls", (controls) => {
	// Switching to layer
	if (canvas.polmap == null) return;

	if (controls.activeControl === "polmap" && controls.activeTool != null) {
		// Open brush tools if not already open
		_doCacheControls();
		if (!$wrpPaletteControls.length) new PaletteControls().render(true);
		// Set active tool
		const tool = controls.controls.find((control) => control.name === "polmap").activeTool;
		canvas.polmap.setActiveTool(tool);
		return;
	}

	// region Switching away from layer
	// Clear active tool
	canvas.polmap.clearActiveTool();
	// Remove brush tools if open
	_doCacheControls();
	$wrpPaletteControls.remove();
	$wrpPaletteControls = null;
	// endregion
});

/**
 * Sets Y position of the brush controls to account for scene navigation buttons
 */
const setPaletteControlPos = () => {
	_doCacheControls();
	if (!$wrpPaletteControls.length) return;

	const h = $("#navigation").height();
	$wrpPaletteControls.css({top: `${h + 40}px`});
};

// Reset position when brush controls are rendered or sceneNavigation changes
Hooks.on("renderPaletteControls", setPaletteControlPos);
Hooks.on("renderSceneNavigation", setPaletteControlPos);
