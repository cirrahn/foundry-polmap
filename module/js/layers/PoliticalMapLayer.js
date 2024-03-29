import OverlayLayer from "./OverlayLayer.js";
import {Layout} from "../libs/hexagons.js";
import {hexObjsToArr} from "../helpers.js";
import {MODULE_ID} from "../consts.js";

export default class PoliticalMapLayer extends OverlayLayer {
	static _LINE_OPTS_ERASE = {
		width: 7,
		color: 0xFF0000,
		cap: PIXI.LINE_CAP.ROUND,
		alpha: 1,
	};

	constructor () {
		super();

		// Register event listeners
		this._registerMouseListeners();

		this._DEFAULTS = Object.assign(this._DEFAULTS, {
			gmAlpha: 0.5,
			playerAlpha: 0.5,
			previewColor: "0x00FFFF",
			paletteColor: "0xFFFFFF",
		});

		// React to changes to current scene
		Hooks.on("updateScene", (scene, data) => this._updateScene(scene, data));

		this._boxPreview = null;
		this._polygonPreview = null;
		this._erasePreview = null;

		// Right-click tracking
		this._rcDist = null;
		this._rcPos = null;

		this._dupes = [];
	}

	init () {
		// Preview brush objects
		this._boxPreview = this._getBrushGraphic({
			shape: this._BRUSH_TYPES.BOX,
			x: 0,
			y: 0,
			fill: 0xFFFFFF,
			alpha: 1,
			width: 100,
			height: 100,
			visible: false,
			zIndex: 10,
		});
		this._polygonPreview = this._getBrushGraphic({
			shape: this._BRUSH_TYPES.POLYGON,
			x: 0,
			y: 0,
			vertices: [],
			fill: 0xFFFFFF,
			alpha: 1,
			visible: false,
			zIndex: 10,
		});
		this._erasePreview = this._getBrushGraphic({
			shape: this._BRUSH_TYPES.POLYGON,
			x: 0,
			y: 0,
			vertices: [],
			fill: 0xFFFFFF,
			alpha: 1,
			visible: false,
			zIndex: 10,
		});
	}

	canvasInit () {
		// Set default flags if they dont exist already
		Object.keys(this._DEFAULTS).forEach((key) => {
			if (!game.user.isGM) return;
			// Check for existing scene specific setting
			if (this.getSetting(key) !== undefined) return;
			// Check for custom default
			const def = this.getUserSetting(key);
			// If user has custom default, set it for scene
			if (def !== undefined) this.setSetting(key, def);
			// Otherwise fall back to module default
			else this.setSetting(key, this._DEFAULTS[key]);
		});
	}

	/* -------------------------------------------- */
	/*  Misc helpers                                */
	/* -------------------------------------------- */

	static _isSquareGrid (gridType) {
		return gridType === 1;
	}

	static _isHexGrid (gridType) {
		return [2, 3, 4, 5].includes(gridType);
	}

	/* -------------------------------------------- */
	/*  Getters and setters for layer props         */
	/* -------------------------------------------- */

	// Alpha has special cases because it can differ between GM & Players

	getAlpha () {
		let alpha;
		if (game.user.isGM) alpha = this.getSetting("gmAlpha");
		else alpha = this.getSetting("playerAlpha");
		if (!alpha) {
			if (game.user.isGM) alpha = this._DEFAULTS.gmAlpha;
			else alpha = this._DEFAULTS.playerAlpha;
		}
		return alpha;
	}

	/**
	* Sets the scene's alpha for the primary layer.
	* @param alpha {Number} 0-1 opacity representation
	*/
	async setAlpha (alpha) {
		this.alpha = alpha;
	}

	/* -------------------------------------------- */
	/*  Event Listeners and Handlers                */
	/* -------------------------------------------- */

	/**
	* React to updates of canvas.scene flags
	*/
	async _updateScene (scene, data) {
		// Check if update applies to current viewed scene
		if (!scene._view) return;
		// React to visibility change
		if (hasProperty(data, `flags.${MODULE_ID}.visible`)) {
			canvas[MODULE_ID].visible = data.flags[MODULE_ID].visible;
		}
		// React to brush history change
		if (hasProperty(data, `flags.${MODULE_ID}.history`)) {
			await canvas[MODULE_ID].pRenderStack(data.flags[MODULE_ID].history);
		}
		// React to alpha/tint changes
		if (!game.user.isGM && hasProperty(data, `flags.${MODULE_ID}.playerAlpha`)) {
			await canvas[MODULE_ID].setAlpha(data.flags[MODULE_ID].playerAlpha);
		}
		if (game.user.isGM && hasProperty(data, `flags.${MODULE_ID}.gmAlpha`)) {
			await canvas[MODULE_ID].setAlpha(data.flags[MODULE_ID].gmAlpha);
		}
	}

	/**
	* Adds the mouse listeners to the layer
	*/
	_registerMouseListeners () {
		this.addListener("pointerdown", this._pointerDown);
		this.addListener("pointerup", this._pointerUp);
		this.addListener("pointermove", this._pointerMove);
	}

	/**
	 * Sets the active tool & shows preview for grid tool.
	 */
	setActiveTool (tool) {
		this.clearActiveTool();
		this.activeTool = tool;
		this.setPreviewTint();

		// Note: this `setActiveTool` method gets called on changing scene or scene dimensions, as the scene controls
		//   are reset, and the user has to click on the polmap tools again. This may break in a future Foundry update; if
		//   it does, wire this up to e.g. a "scene update" event.
		this._initGrid();

		switch (tool) {
			case "grid": {
				if (this.constructor._isSquareGrid(canvas.scene.grid.type)) {
					this._boxPreview.width = canvas.scene.grid.size;
					this._boxPreview.height = canvas.scene.grid.size;
					this._boxPreview.visible = true;
					break;
				}

				if (this.constructor._isHexGrid(canvas.scene.grid.type)) {
					this._polygonPreview.visible = true;
				}
			}
		}
	}

	setPreviewTint () {
		const previews = [
			this._boxPreview,
			this._polygonPreview,
		];

		if (this.getTempSetting("isErasing") || this.getTempSetting("isErasingRightClick")) {
			previews.forEach(preview => preview.tint = this.constructor._TINT_ERASER);
			return;
		}

		const tint = this.getSetting("paletteColor");
		previews.forEach(preview => preview.tint = tint);
	}

	/**
	* Aborts any active drawing tools
	*/
	clearActiveTool () {
		// Box preview
		if (this._boxPreview) this._boxPreview.visible = false;
		// Shape preview
		if (this._polygonPreview) {
			this._polygonPreview.clear();
			this._polygonPreview.visible = false;
		}
		// Erase preview
		if (this._erasePreview) {
			this._erasePreview.clear();
			this._erasePreview.visible = false;
		}
		// Cancel op flag
		this.op = false;
		// Clear history buffer
		this._historyBuffer = [];
	}

	/**
	 * Get mouse position translated to canvas coords
	 */
	_getRoundedLocalPosition (evt) {
		const p = evt.data.getLocalPosition(canvas.app.stage);
		// Round positions to nearest pixel
		p.x = Math.round(p.x);
		p.y = Math.round(p.y);
		return p;
	}

	/**
	* Mouse handlers for canvas layer interactions
	*/
	_pointerDown (evt) {
		// Don't allow new action if history push still in progress
		if (this._historyBuffer.length > 0) {
			console.warn(`Discarded input; still got ${this._historyBuffer.length} to sync :(`);
			return;
		}

		switch (evt.data.button) {
			// LMB
			case 0: {
				const p = this._getRoundedLocalPosition(evt);

				this.op = true;
				// Check active tool
				switch (this.activeTool) {
					case "grid": this._pointerDownGrid(p, evt); break;
				}
				// Call _pointermove so single click will still draw brush if mouse does not move
				this._pointerMove(evt);
				break;
			}

			// RMB
			case 2: {
				this._rcDist = 0;
				this._rcPos = this._getRoundedLocalPosition(evt);
			}
		}
	}

	_pointerMove (evt) {
		const p = this._getRoundedLocalPosition(evt);

		switch (this.activeTool) {
			case "grid": this._pointerMoveGrid(p, evt); break;
		}

		if (this._rcPos != null) {
			const dx = Math.abs(p.x - this._rcPos.x);
			const dy = Math.abs(p.y - this._rcPos.y);
			this._rcDist += dx + dy;
		}
	}

	_pointerUp (evt) {
		switch (evt.data.button) {
			// LMB
			case 0: {
				// Translate click to canvas position
				const p = evt.data.getLocalPosition(canvas.app.stage);
				// Round positions to nearest pixel
				p.x = Math.round(p.x);
				p.y = Math.round(p.y);
				// Reset operation
				this.op = false;
				// Push the history buffer
				this.commitHistory();
				break;
			}

			// RMB
			case 2: {
				// If the mouse has moved too great a distance between starting and finishing the right-click, ignore it
				const isClick = this._rcDist < 5;
				this._rcDist = null;
				this._rcPos = null;
				if (!isClick) return;

				// Allow right-click to erase
				this.op = "grid";
				this.setTempSetting("isErasingRightClick", true);
				this._pointerMove(evt);
				this.setTempSetting("isErasingRightClick", false);
				// Reset operation
				this.op = false;
				// Push the history buffer
				this.commitHistory();
			}
		}
	}

	/**
	* Grid Tool
	*/
	_pointerDownGrid () {
		this.op = "grid";
		this._dupes = [];
	}

	_pointerMoveGrid (p) {
		const {size: grid, type: gridType} = canvas.scene.grid;

		const isErasingVisual = this.getTempSetting("isErasing");
		const isErasing = isErasingVisual || this.getTempSetting("isErasingRightClick");

		const fill = isErasingVisual
			? 1
			: this.getSetting("paletteColor");

		if (this.constructor._isSquareGrid(gridType)) {
			const gridx = Math.floor(p.x / grid);
			const gridy = Math.floor(p.y / grid);
			const x = gridx * grid;
			const y = gridy * grid;

			this._boxPreview.visible = !isErasingVisual;
			this._erasePreview.visible = isErasingVisual;

			if (isErasingVisual) {
				this._erasePreview.clear();
				this._erasePreview
					.lineStyle(this.constructor._LINE_OPTS_ERASE)
					.moveTo(x + grid, y + grid)
					.lineTo(x, y);
			} else {
				this._boxPreview.x = x;
				this._boxPreview.y = y;
				this._boxPreview.width = grid;
				this._boxPreview.height = grid;
			}

			// If drag operation has not started, bail out
			if (!this.op) return;

			// Avoid duplicating data within a single drag
			const coord = `${x},${y}`;
			if (this._dupes.includes(coord)) return;
			this._dupes.push(coord);

			// Save info to history
			const brush = {
				shape: this._BRUSH_TYPES.BOX,
				x,
				y,
				width: grid,
				height: grid,
				fill,
			};
			if (isErasing) brush.blend = "ERASE";
			this._renderBrushGraphic(brush);

			return;
		}

		if (this.constructor._isHexGrid(gridType)) {
			// Convert pixel coord to hex coord
			const qr = this._gridLayout.pixelToHex(p).round();
			// Get current grid coord verts
			const vertices = this._gridLayout.polygonCorners({ q: qr.q, r: qr.r });
			// Convert to array of individual verts
			const vertexArray = hexObjsToArr(vertices);

			// Update the preview shape
			this._polygonPreview.visible = !isErasingVisual;
			this._erasePreview.visible = isErasingVisual;

			if (isErasingVisual) {
				this._erasePreview.clear();
				this._erasePreview
					.lineStyle(this.constructor._LINE_OPTS_ERASE)
					.moveTo(vertexArray[2], vertexArray[3])
					.lineTo(vertexArray[8], vertexArray[9]);
			} else {
				this._polygonPreview.clear();
				this._polygonPreview.beginFill(0xFFFFFF);
				this._polygonPreview.drawPolygon(vertexArray);
				this._polygonPreview.endFill();
			}

			// If drag operation has not started, bail out
			if (!this.op) return;

			// Avoid duplicating data within a single drag
			const coord = `${qr.q},${qr.r}`;
			if (this._dupes.includes(coord)) return;
			this._dupes.push(coord);

			// Save info to history
			const brush = {
				shape: this._BRUSH_TYPES.POLYGON,
				vertices: vertexArray,
				x: 0,
				y: 0,
				fill,
			};
			if (isErasing) brush.blend = "ERASE";
			this._renderBrushGraphic(brush);
		}
	}

	/*
	* Checks grid type, creating a hex grid layout if required
	*/
	_initGrid () {
		const grid = canvas.scene.grid.size;

		if (canvas.scene.flags.core?.legacyHex) {
			switch (canvas.scene.grid.type) {
				// Pointy Hex Odd
				case 2:
					this._gridLayout = new Layout(
						Layout.pointy,
						{ x: grid / 2, y: grid / 2 },
						{ x: 0, y: grid / 2 },
					);
					break;
				// Pointy Hex Even
				case 3:
					this._gridLayout = new Layout(
						Layout.pointy,
						{ x: grid / 2, y: grid / 2 },
						{ x: Math.sqrt(3) * grid / 4, y: grid / 2 },
					);
					break;
				// Flat Hex Odd
				case 4:
					this._gridLayout = new Layout(
						Layout.flat,
						{ x: grid / 2, y: grid / 2 },
						{ x: grid / 2, y: 0 },
					);
					break;
				// Flat Hex Even
				case 5:
					this._gridLayout = new Layout(
						Layout.flat,
						{ x: grid / 2, y: grid / 2 },
						{ x: grid / 2, y: Math.sqrt(3) * grid / 4 },
					);
					break;
				// Square grid
				default:
					break;
			}
		} else {
			switch (canvas.scene.grid.type) {
				// Pointy Hex Odd
				case 2:
					this._gridLayout = new Layout(
						Layout.pointy,
						{ x: grid / Math.sqrt(3), y: grid / Math.sqrt(3)},
						{ x: 0, y: grid / Math.sqrt(3)},
					);
					break;
				// Pointy Hex Even
				case 3:
					this._gridLayout = new Layout(
						Layout.pointy,
						{ x: grid / Math.sqrt(3), y: grid / Math.sqrt(3)},
						{ x: grid / 2, y: grid / Math.sqrt(3) },
					);
					break;
				// Flat Hex Odd
				case 4:
					this._gridLayout = new Layout(
						Layout.flat,
						{ x: grid / Math.sqrt(3), y: grid / Math.sqrt(3)},
						{ x: grid / Math.sqrt(3), y: 0 },
					);
					break;
				// Flat Hex Even
				case 5:
					this._gridLayout = new Layout(
						Layout.flat,
						{ x: grid / Math.sqrt(3), y: grid / Math.sqrt(3)},
						{ x: grid / Math.sqrt(3), y: grid / 2},
					);
					break;
				// Square grid
				default:
					break;
			}
		}
	}

	async draw () {
		const out = await super.draw();
		this.init();
		this.addChild(this._boxPreview);
		this.addChild(this._polygonPreview);
		this.addChild(this._erasePreview);
		return out;
	}
}
