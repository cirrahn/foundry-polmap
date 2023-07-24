/*
 * Global PolMap Configuration Options
 */

import OverlayLayer from "./classes/OverlayLayer.js";

export default [
	{
		name: "migrationVersion",
		data: {
			name: "Political Map Overlay Migration Version",
			scope: "world",
			config: false,
			type: Number,
			default: 0,
		},
	},
	{
		name: "zIndex",
		data: {
			name: "Political Map Overlay Z-Index",
			hint: "The z-index determines the order in which various layers are rendered within the Foundry canvas.  A higher number will be rendered on top of lower numbered layers (and the objects on that layer).  This allows for the adjustment of the z-index to allow for the Political Map Overlay to be rendered above/below other layers; particularly ones added by other modules. Going below 200 will intermingle with Foundry layers such as the foreground image (200), tokens (100), etc...  (Default: 215)",
			scope: "world",
			config: true,
			default: 215,
			type: Number,
			onChange: OverlayLayer.refreshZIndex,
		},
	},
];
