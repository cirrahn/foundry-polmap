import {polmapLog} from "../helpers.js";

export default class OverlayLayer extends InteractionLayer {
	static _TINT_ERASER = 0xFF00FF;

	constructor (layername) {
		super();
		this.lock = false;
		this.layername = layername;
		this.historyBuffer = [];
		this.pointer = 0;
		this.gridLayout = {};
		this.dragStart = {x: 0, y: 0}; // Not actually used, just to prevent foundry from complaining
		this.history = [];
		this.BRUSH_TYPES = {
			BOX: 1,
			POLYGON: 3,
		};
		this.DEFAULTS = {
			visible: false,
		};
		this._tempSettings = {};
	}

	static get layerOptions () {
		return mergeObject(super.layerOptions, {
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
	overlayInit () {
		// Check if layer is flagged visible
		let v = this.getSetting("visible");
		if (v === undefined) v = false;
		this.visible = v;

		this.setAlpha(this.getAlpha());

		this.layerTexture = OverlayLayer.getLayerTexture();
		this.layer = new PIXI.Sprite(this.layerTexture);
		this.setClear();

		// Allow zIndex prop to function for items on this layer
		this.sortableChildren = true;

		// Render initial history stack
		this.renderStack();
	}

	/* -------------------------------------------- */
	/*  History & Buffer                            */
	/* -------------------------------------------- */

	static getLayerTexture () {
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

		let setting = scene.getFlag(this.layername, name);
		if (setting === undefined) setting = this.getUserSetting(name);
		if (setting === undefined) setting = this.DEFAULTS[name];
		return setting;
	}

	async setSetting (name, value, {scene = null} = {}) {
		scene = scene || canvas.scene;

		return scene.setFlag(this.layername, name, value);
	}

	getUserSetting (name) {
		let setting = game.user.getFlag(this.layername, name);
		if (setting === undefined) setting = this.DEFAULTS[name];
		return setting;
	}

	async setUserSetting (name, value) {
		return game.user.setFlag(this.layername, name, value);
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
	renderStack (
		history = canvas.scene.getFlag(this.layername, "history"),
		start = this.pointer,
		stop = canvas.scene.getFlag(this.layername, "history.pointer"),
	) {
		// If history is blank, do nothing
		if (history === undefined) {
			return;
		}
		// If history is zero, reset scene overlay
		if (history.events.length === 0) this.resetLayer(false);
		if (start === undefined) start = 0;
		if (stop === undefined) stop = history.events.length;
		// If pointer precedes the stop, reset and start from 0
		if (stop <= this.pointer) {
			this.resetLayer(false);
			start = 0;
		}

		polmapLog(`Rendering from: ${start} to ${stop}`);
		// Render all ops starting from pointer
		for (let i = start; i < stop; i += 1) {
			for (let j = 0; j < history.events[i].length; j += 1) {
				this.renderBrush(history.events[i][j], false);
			}
		}
		// Update local pointer
		this.pointer = stop;
	}

	/**
   * Add buffered history stack to scene flag and clear buffer
   */
	async commitHistory () {
		// Do nothing if no history to be committed, otherwise get history
		if (this.historyBuffer.length === 0) return;
		if (this.lock) return;
		this.lock = true;
		let history = canvas.scene.getFlag(this.layername, "history");
		// If history storage doesn't exist, create it
		if (!history) {
			history = {
				events: [],
				pointer: 0,
			};
		}
		// If pointer is less than history length (f.x. user undo), truncate history
		history.events = history.events.slice(0, history.pointer);
		// Push the new history buffer to the scene
		history.events.push(this.historyBuffer);
		history.pointer = history.events.length;
		await canvas.scene.unsetFlag(this.layername, "history");
		await this.setSetting("history", history);
		polmapLog(`Pushed ${this.historyBuffer.length} updates.`);
		// Clear the history buffer
		this.historyBuffer = [];
		this.lock = false;
	}

	/**
   * Resets the layer
   * @param save {Boolean} If true, also resets the layer history
   */
	async resetLayer (save = true) {
		// Clear the layer
		this.setClear();
		// If save, also unset history and reset pointer
		if (save) {
			await canvas.scene.unsetFlag(this.layername, "history");
			await canvas.scene.setFlag(this.layername, "history", {
				events: [],
				pointer: 0,
			});
			this.pointer = 0;
		}
	}

	/**
   * Steps the history buffer back X steps and redraws
   * @param steps {Integer} Number of steps to undo, default 1
   */
	async undo (steps = 1) {
		polmapLog(`Undoing ${steps} steps.`);
		// Grab existing history
		// Todo: this could probably just grab and set the pointer for a slight performance improvement
		let history = canvas.scene.getFlag(this.layername, "history");
		if (!history) {
			history = {
				events: [],
				pointer: 0,
			};
		}
		let newpointer = this.pointer - steps;
		if (newpointer < 0) newpointer = 0;
		// Set new pointer & update history
		history.pointer = newpointer;
		await canvas.scene.unsetFlag(this.layername, "history");
		await canvas.scene.setFlag(this.layername, "history", history);
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
	brush (data) {
		// Get new graphic & begin filling
		const alpha = typeof data.alpha === "undefined" ? 1 : data.alpha;
		const visible = typeof data.visible === "undefined" ? true : data.visible;
		const brush = new PIXI.Graphics();
		brush.beginFill(data.fill);
		// Draw the shape depending on type of brush
		switch (data.shape) {
			case this.BRUSH_TYPES.BOX:
				brush.drawRect(0, 0, data.width, data.height);
				break;
			case this.BRUSH_TYPES.POLYGON:
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
	renderBrush (data, save = true) {
		const brush = this.brush(data);
		this.composite(brush);
		brush.destroy();
		if (save) this.historyBuffer.push(data);
	}

	/**
	 * Renders the given brush to the layer
	 * @param brush {Object}       PIXI Object to be used as brush
	 * @param isClear              If layer should be cleared.
	 */
	composite (brush, {isClear = false} = {}) {
		canvas.app.renderer.render(brush, this.layerTexture, isClear, null, false);
	}

	/**
   * Clears the layer
   */
	setClear () {
		const fill = new PIXI.Graphics();
		this.composite(fill, {isClear: true});
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
		this.interactive = true;
	}

	/**
   * Actions upon layer becoming inactive
   */
	deactivate () {
		super.deactivate();
		this.interactive = false;
	}

	async draw () {
		const out = await super.draw();
		this.overlayInit();
		this.addChild(this.layer);
		return out;
	}

	static refreshZIndex () {
		canvas.polmap.zIndex = game.settings.get("polmap", "zIndex");
	}
}
