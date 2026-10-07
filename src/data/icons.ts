// Approved raster icon family. See docs/icon-style-guide.md before adding an icon.
export const iconNames = [
	"arrow",
	"arrow-16",
	"arrow-alt-24",
	"arrow-up-right-24",
	"bar-chart",
	"briefcase",
	"briefcase-16",
	"check",
	"chevron",
	"chevron-16",
	"chip-48",
	"cloud",
	"cube-48",
	"database",
	"file",
	"filter",
	"filter-16",
	"grid-48",
	"headset-48",
	"layers",
	"layers-16",
	"lock",
	"menu-24",
	"message",
	"message-16",
	"monitor-48",
	"nav-down-12",
	"phone",
	"rocket",
	"settings",
	"settings-16",
	"shield",
	"spark",
	"thumbs-up",
	"users",
	"workflow",
	"workflow-48"
] as const;

export type IconName = (typeof iconNames)[number];

export const iconSrc = (name: IconName) => `/icons/${name}.png`;
