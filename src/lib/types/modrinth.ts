export interface ModrinthProject {
	slug: string;
	title: string;
	description: string;
	categories: string[];
	client_side: 'required' | 'optional' | 'unsupported';
	server_side: 'required' | 'optional' | 'unsupported';
	project_type: 'mod' | 'plugin' | 'modpack' | 'datapack' | 'shader';
	downloads: number;
	icon_url: string | null;
	author: string;
	latest_version: string;
	versions: string[];
	game_versions: string[];
	loaders: string[];
	follows: number;
	date_created: string;
	date_modified: string;
}

export interface ModrinthSearchResult {
	hits: ModrinthProject[];
	total_hits: number;
	offset: number;
	limit: number;
}

export interface ModrinthVersion {
	id: string;
	project_id: string;
	name: string;
	version_number: string;
	game_versions: string[];
	loaders: string[];
	featured: boolean;
	date_published: string;
	downloads: number;
	changelog: string;
	files: {
		url: string;
		filename: string;
		primary: boolean;
		size: number;
		hashes: { sha512: string; sha1: string };
	}[];
}

export interface ModrinthSearchFilters {
	query: string;
	gameVersions: string[];
	loaders: string[];
	categories: string[];
	environment: '' | 'client' | 'server' | 'both';
	projectType: 'mod' | 'plugin' | 'modpack' | 'datapack';
	offset: number;
	limit: number;
}
