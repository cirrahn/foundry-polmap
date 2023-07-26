import {polmapLog} from "../helpers.js";
import {MODULE_ID} from "../consts.js";

/**
 * Queue and execute history updates in a serial fashion, from all connected GMs and players.
 *
 * Only the main, connected, GM client (the one Socketlib deems the "responsible" GM) makes modifications to the history
 * data. This avoids any race conditions (assuming client activity detection is reliable, which it *mostly* is).
 */
export class HistorySocketInterface {
	static _SOCKET = null;

	static registerSocketBindings (socket) {
		this._SOCKET = socket;

		socket.register("commitHistory", this._pCommitHistory.bind(this));
		socket.register("resetHistory", this._pResetHistory.bind(this));
	}

	/* -------------------------------------------- */

	/**
	 * From Socketlib:
	 * https://github.com/manuelVo/foundryvtt-socketlib/blob/develop/src/socketlib.js#L313C1-L315C2
	 */
	static _isActiveGM (user) {
		return user.active && user.isGM;
	}

	/**
	 * From Socketlib:
	 * https://github.com/manuelVo/foundryvtt-socketlib/blob/develop/src/socketlib.js#L306
	 */
	static _isResponsibleGM () {
		if (!game.user.isGM) return false;
		const connectedGMs = game.users.filter(this._isActiveGM.bind(this));
		return !connectedGMs.some(other => other.id < game.user.id);
	}

	static _isAnyActiveGm () {
		return game.users.some(this._isActiveGM.bind(this));
	}

	/* -------------------------------------------- */

	static _SEMAPHORE_HISTORY = new Semaphore(1);

	static _validateActiveGM () {
		if (this._isAnyActiveGm()) return true;
		ui.notifications.error(`Could not perform operation \u2014 no active GM!`);
		return false;
	}

	static _validateUserPermissions (userId) {
		if (game.user.isGM) return true;
		if (game.settings.get(MODULE_ID, "isPlayerEditable") && game.users.get(userId)?.can("DRAWING_CREATE")) return true;
		ui.notifications.error(`Could not perform operation \u2014 did not have permissions!`);
		return false;
	}

	/* ----- */

	static async pCommitHistory (userId, historyBuffer) {
		if (!this._validateUserPermissions(userId) || !this._validateActiveGM()) return false;
		await this._SOCKET.executeForAllGMs("commitHistory", historyBuffer);
		return true;
	}

	static async _pCommitHistory (historyBuffer) {
		if (historyBuffer?.length === 0) return;
		if (!this._isResponsibleGM()) return;
		await this._SEMAPHORE_HISTORY.add(this._pCommitHistoryTask.bind(this), historyBuffer);
	}

	static async _pCommitHistoryTask (historyBuffer) {
		if (!historyBuffer?.length) return;

		const history = canvas.scene.getFlag(MODULE_ID, "history")
			// If history storage doesn't exist, create it
			|| {
				events: [],
				pointer: 0,
			};

		// If pointer is less than history length (f.x. user undo), truncate history
		history.events = history.events.slice(0, history.pointer);

		// Push the new history buffer to the scene
		history.events.push(historyBuffer);
		history.pointer = history.events.length;

		await canvas.scene.setFlag(MODULE_ID, "history", history);
		polmapLog(`Pushed ${historyBuffer.length} updates.`);
	}

	/* ----- */

	static async pResetHistory (userId) {
		if (!this._validateUserPermissions(userId) || !this._validateActiveGM()) return false;
		await this._SOCKET.executeForAllGMs("resetHistory");
		return true;
	}

	static async _pResetHistory () {
		if (!this._isResponsibleGM()) return;
		await this._SEMAPHORE_HISTORY.add(this._pResetHistoryTask.bind(this));
	}

	static async _pResetHistoryTask () {
		await canvas.scene.unsetFlag(MODULE_ID, "history");
		await canvas.scene.setFlag(MODULE_ID, "history", {
			events: [],
			pointer: 0,
		});
		polmapLog(`Reset history.`);
	}
}
