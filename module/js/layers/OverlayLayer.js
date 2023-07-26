import {polmapLog} from "../helpers.js";
import {MODULE_ID} from "../consts.js";
import {HistorySocketInterface} from "../socket/history.js";

export default class OverlayLayer extends InteractionLayer {
	static _TINT_ERASER = 0xFF00FF;

	constructor () {
		super();
		this._historyBuffer = [];
		this._pointer = 0;
		this._gridLayout = {};
		this._BRUSH_TYPES = {
			BOX: 1,
			POLYGON: 3,
		};
		this._DEFAULTS = {
			visible: false,
		};
		this._tempSettings = {};
		this._layerTexture = null;
		this._layer = null;

		// Allow zIndex prop to function for items on this layer
		this.sortableChildren = true;
	}

	static get layerOptions () {
		return mergeObject(super.layerOptions, {
			baseClass: InteractionLayer,
			zIndex: 19, // Below drawings (which is 20)
		});
	}

	// So you can hit escape on the keyboard and it will bring up the menu
	get controlled () { return {}; }

	/* -------------------------------------------- */
	/*  Init                                        */
	/* -------------------------------------------- */

	/**
   * Called on canvas init, creates the canvas layers and various objects and registers listeners
   *
   * Important objects:
   *
   * layer        - PIXI Sprite which holds all the region elements
   * layerTexture - renderable texture that holds the actual region data
   */
	async pInitOverlay () {
		// Check if layer is flagged visible
		let v = this.getSetting("visible");
		if (v === undefined) v = false;
		this.visible = v;

		await this.setAlpha(this.getAlpha());

		this._layerTexture = this.constructor._getLayerTexture();
		this._layer = new PIXI.Sprite(this._layerTexture);
		this.setClear();

		// Render initial history stack
		await this.pRenderStack();
	}

	/* -------------------------------------------- */
	/*  History & Buffer                            */
	/* -------------------------------------------- */

	static _getLayerTexture () {
		const d = canvas.dimensions;
		let res = 1.0;
		if (d.width * d.height > 16000 ** 2) res = 0.25;
		else if (d.width * d.height > 8000 ** 2) res = 0.5;

		return PIXI.RenderTexture.create({
			width: canvas.dimensions.width,
			height: canvas.dimensions.height,
			resolution: res,
		});
	}

	/**
   * Gets and sets various layer wide properties
   * Some properties have different values depending on if user is a GM or player
   */
	getSetting (name, {scene = null} = {}) {
		scene = scene || canvas.scene;

		let setting = scene.getFlag(MODULE_ID, name);
		if (setting === undefined) setting = this.getUserSetting(name);
		if (setting === undefined) setting = this._DEFAULTS[name];
		return setting;
	}

	async setSetting (name, value, {scene = null} = {}) {
		scene = scene || canvas.scene;

		return scene.setFlag(MODULE_ID, name, value);
	}

	getUserSetting (name) {
		let setting = game.user.getFlag(MODULE_ID, name);
		if (setting === undefined) setting = this._DEFAULTS[name];
		return setting;
	}

	async setUserSetting (name, value) {
		return game.user.setFlag(MODULE_ID, name, value);
	}

	getTempSetting (name) {
		return this._tempSettings[name];
	}

	setTempSetting (name, value) {
		this._tempSettings[name] = value;
	}

	/**
   * Renders the history stack to the regions
   * @param history {Array}       A collection of history events
   * @param start {Number}        The position in the history stack to begin rendering from
   * @param stop {Number}        The position in the history stack to stop rendering
   */
	async pRenderStack (
		history = canvas.scene.getFlag(MODULE_ID, "history"),
		start = this._pointer,
		stop = undefined,
	) {
		// If history is blank, do nothing
		if (history === undefined) return;

		const events = history.events.filter(arr => arr?.length);

		// If history is zero, reset scene overlay
		if (events.length === 0) return this.pResetLayer(false);

		if (start === undefined) start = 0;
		stop = stop === undefined ? events.length : stop;

		// If pointer precedes the stop, reset and start from 0
		if (stop <= this._pointer) {
			await this.pResetLayer(false);
			start = 0;
		}

		polmapLog(`Rendering from: ${start} to ${stop}`);
		// Render all ops starting from pointer
		for (let i = start; i < stop; i += 1) {
			for (let j = 0; j < events[i].length; j += 1) {
				this._renderBrushGraphic(events[i][j], false);
			}
		}
		// Update local pointer
		this._pointer = stop;
	}

	/**
   * Add buffered history stack to scene flag and clear buffer
   */
	async commitHistory () {
		// Do nothing if no history to be committed, otherwise get history
		if (this._historyBuffer.length === 0) return;

		const isApproved = await HistorySocketInterface.pCommitHistory(game.userId, this._historyBuffer);
		polmapLog(`Pushed ${this._historyBuffer.length} updates (via GM socket).`);
		this._historyBuffer = [];

		if (!isApproved) await this.pRenderStack();
	}

	/**
   * Resets the layer
   * @param save {Boolean} If true, also resets the layer history
   */
	async pResetLayer (save = true) {
		// Clear the layer
		this.setClear();

		if (!save) return;

		// If save, also unset history and reset pointer
		const isApproved = await HistorySocketInterface.pResetHistory(game.userId);
		this._pointer = 0;

		if (!isApproved) await this.pRenderStack();
	}

	/* -------------------------------------------- */
	/*  Shapes, sprites and PIXI objs               */
	/* -------------------------------------------- */

	/**
   * Creates a PIXI graphic using the given brush parameters
   * @param data {Object}       A collection of brush parameters
   * @returns {Object}          PIXI.Graphics() instance
   *
   * @example
   * const myBrush = this.brush({
   *      shape: <brush type>,
   *      x: 0,
   *      y: 0,
   *      fill: 0x000000,
   *      width: 50,
   *      height: 50,
   *      alpha: 1,
   *      visible: true
   * });
   */
	_getBrushGraphic (data) {
		// Get new graphic & begin filling
		const alpha = typeof data.alpha === "undefined" ? 1 : data.alpha;
		const visible = typeof data.visible === "undefined" ? true : data.visible;
		const brush = new PIXI.Graphics();
		brush.beginFill(data.fill);
		// Draw the shape depending on type of brush
		switch (data.shape) {
			case this._BRUSH_TYPES.BOX:
				brush.drawRect(0, 0, data.width, data.height);
				break;
			case this._BRUSH_TYPES.POLYGON:
				brush.drawPolygon(data.vertices);
				break;
		}
		// End fill and set the basic props
		brush.endFill();
		brush.alpha = alpha;
		brush.visible = visible;
		brush.x = data.x;
		brush.y = data.y;
		brush.zIndex = data.zIndex;
		if (data.blend) brush.blendMode = PIXI.BLEND_MODES[data.blend];
		return brush;
	}

	/**
   * Gets a brush using the given parameters, renders it to layer and saves the event to history
   * @param data {Object}       A collection of brush parameters
   * @param save {Boolean}      If true, will add the operation to the history buffer
   */
	_renderBrushGraphic (data, save = true) {
		const brush = this._getBrushGraphic(data);
		this._doRenderBrushToLayer(brush);
		brush.destroy();
		if (save) this._historyBuffer.push(data);
	}

	/**
	 * Renders the given brush to the layer
	 * @param brush {Object}       PIXI Object to be used as brush
	 * @param isClear              If layer should be cleared.
	 */
	_doRenderBrushToLayer (brush, {isClear = false} = {}) {
		canvas.app.renderer.render(brush, {
			renderTexture: this._layerTexture,
			clear: isClear,
			transform: null,
			skipUpdateTransform: false,
		});
	}

	/**
   * Clears the layer
   */
	setClear () {
		const fill = new PIXI.Graphics();
		this._doRenderBrushToLayer(fill, {isClear: true});
		fill.destroy();
	}

	/**
   * Toggles visibility of primary layer
   */
	toggle () {
		const v = this.getSetting("visible");
		this.visible = !v;
		this.setSetting("visible", !v);
	}

	/**
   * Actions upon layer becoming active
   */
	activate () {
		super.activate();
		this.eventMode = "static";
	}

	/**
   * Actions upon layer becoming inactive
   */
	deactivate () {
		super.deactivate();
		this.eventMode = "passive";
	}

	async draw () {
		const out = await super.draw();
		await this.pInitOverlay();
		this.addChild(this._layer);
		return out;
	}

	static refreshZIndex () {
		canvas.polmap.zIndex = game.settings.get(MODULE_ID, "zIndex");
	}
}
