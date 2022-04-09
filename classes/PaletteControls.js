import {hexToWeb, webToHex} from "../js/helpers.js";
import {RGB_BASIC} from "../js/consts.js";

export default class PaletteControls extends FormApplication {
	constructor (...args) {
		super(...args);

		this._isErasing = false;
	}

	static get defaultOptions () {
		return mergeObject(super.defaultOptions, {
			classes: ["form"],
			closeOnSubmit: false,
			submitOnChange: true,
			submitOnClose: true,
			popOut: false,
			editable: game.user.isGM,
			template: "modules/polmap/templates/palette-controls.hbs",
			id: "filter-config",
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
			colors: RGB_BASIC,
			paletteColor: hexToWeb(canvas.polmap.getUserSetting("paletteColor")),
		};
	}

	/* -------------------------------------------- */
	/*  Event Listeners and Handlers                */
	/* -------------------------------------------- */

	/** @override */
	activateListeners ($html) {
		super.activateListeners($html);

		const toggleErasing = (val) => {
			this._isErasing = val ?? !this._isErasing;
			$btnErase.toggleClass(`polmap__btn-erase--active`, this._isErasing);
		};

		const $iptColor = $(`[name="paletteColor"]`)
			.change(async evt => {
				toggleErasing(false);
				await this._onSubmit(evt, {preventClose: true, preventRender: true});
			});

		$(`[name="btn-color"]`)
			.click(async evt => {
				toggleErasing(false);
				const rgb = evt.currentTarget.dataset.hex;
				$iptColor.val(rgb);
				await this._onSubmit(evt, {preventClose: true, preventRender: true});
			});

		const $btnErase = $(`[name="btn-erase"]`)
			.click(async evt => {
				toggleErasing();
				await this._onSubmit(evt, {preventClose: true, preventRender: true});
			});
	}

	/**
   * This method is called upon form submission after form data is validated
   * @param event {Event}       The initial triggering submission event
   * @param formData {Object}   The object of validated form data with which to update the object
   * @private
   */
	async _updateObject (event, formData) {
		await canvas.polmap.setUserSetting("paletteColor", webToHex(formData.paletteColor));
		canvas.polmap.setTempSetting("isErasing", this._isErasing);
		canvas.polmap.setPreviewTint();
	}
}
