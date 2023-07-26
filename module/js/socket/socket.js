import {HistorySocketInterface} from "./history.js";
import {MODULE_ID} from "../consts.js";

class _SocketManager {
	static onSocketlibReady () {
		const socket = socketlib.registerModule(MODULE_ID);

		HistorySocketInterface.registerSocketBindings(socket);
	}
}

Hooks.once("socketlib.ready", () => {
	_SocketManager.onSocketlibReady();
});
