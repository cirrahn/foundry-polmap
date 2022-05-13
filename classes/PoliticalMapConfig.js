export default class PoliticalMapConfig extends FormApplication {
	constructor ({scene}) {
		super();
		this._scene = scene;
	}

	static get defaultOptions () {
		return mergeObject(super.defaultOptions, {
			classes: ["form"],
			closeOnSubmit: false,
			submitOnChange: true,
			submitOnClose: true,
			popOut: true,
			editable: game.user.isGM,
			width: 500,
			template: "modules/polmap/templates/scene-config.hbs",
			id: "polmap-scene-config",
			title: game.i18n.localize("POLMAP.Political Map Options"),
		});
	}

	/* -------------------------------------------- */

	/**
   * Obtain module metadata and merge it with game settings which track current module visibility
   * @return {Object}   The data provided to the template when rendering the form
   */
	getData () {
		// Return data to the template
		return {
			gmAlpha: Math.round(canvas.polmap.getSetting("gmAlpha", {scene: this._scene}) * 100),
			playerAlpha: Math.round(canvas.polmap.getSetting("playerAlpha", {scene: this._scene}) * 100),
		};
	}

	/* -------------------------------------------- */
	/*  Event Listeners and Handlers                */
	/* -------------------------------------------- */

	/**
   * This method is called upon form submission after form data is validated
   * @param event {Event}       The initial triggering submission event
   * @param formData {Object}   The object of validated form data with which to update the object
   * @private
   */
	async _updateObject (event, formData) {
		await Promise.allSettled(
			Object.entries(formData)
				.map(async ([key, val]) => {
					// If setting is an opacity slider, convert from 1-100 to 0-1
					if (["gmAlpha", "playerAlpha"].includes(key)) val /= 100;
					// Save settings to scene
					await canvas.polmap.setSetting(key, val, {scene: this._scene});
					// If saveDefaults button clicked, also save to user's defaults
					if (event.submitter?.name === "saveDefaults") {
						canvas.polmap.setUserSetting(key, val);
					}
				}),
		);

		// If save button was clicked, close app
		if (event.submitter?.name === "submit") {
			Object.values(ui.windows).forEach((val) => {
				if (val.id === "polmap-scene-config") val.close();
			});
		}
	}
}
