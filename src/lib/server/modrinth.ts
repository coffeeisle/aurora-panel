import type { ModrinthSearchResult, ModrinthVersion, ModrinthVersionFile } from '$lib/types/modrinth';

const BASE = 'https://api.modrinth.com/v2';

function buildFacets(filters: Record<string, string[]>): string {
	const parts: string[] = [];
	for (const [key, values] of Object.entries(filters)) {
		if (values.length > 0) {
			const quoted = values.map((v) => `"${v}"`).join(',');
			parts.push(`[${quoted}]`);
		}
	}
	return parts.length > 0 ? `[${parts.join(',')}]` : '';
}

export async function searchMods(params: {
	query: string;
	projectType: string;
	gameVersions: string[];
	loaders: string[];
	categories: string[];
	environment?: string;
	offset: number;
	limit: number;
	index?: string;
}): Promise<ModrinthSearchResult> {
	const facets: Record<string, string[]> = {
		project_type: [params.projectType]
	};

	if (params.gameVersions.length > 0) facets.versions = params.gameVersions;
	if (params.loaders.length > 0) facets.categories = params.loaders;
	if (params.categories.length > 0) {
		facets.categories = [...(facets.categories ?? []), ...params.categories];
	}
	if (params.environment === 'client') {
		facets['client_side'] = ['required'];
	} else if (params.environment === 'server') {
		facets['server_side'] = ['required'];
	} else if (params.environment === 'both') {
		facets['client_side'] = ['required'];
		facets['server_side'] = ['required'];
	}

	const url = new URL(`${BASE}/search`);
	url.searchParams.set('query', params.query);
	url.searchParams.set('facets', buildFacets(facets));
	url.searchParams.set('offset', String(params.offset));
	url.searchParams.set('limit', String(params.limit));
	url.searchParams.set('index', 'relevance');

	const res = await fetch(url.toString(), {
		headers: { 'User-Agent': 'AuroraPanel/0.1' }
	});

	if (!res.ok) {
		throw new Error(`Modrinth API error: ${res.status} ${res.statusText}`);
	}

	return res.json() as Promise<ModrinthSearchResult>;
}

export async function getProjectVersions(
	projectId: string,
	gameVersions?: string[],
	loaders?: string[]
): Promise<ModrinthVersion[]> {
	const url = new URL(`${BASE}/project/${projectId}/version`);
	if (gameVersions && gameVersions.length > 0) {
		for (const v of gameVersions) url.searchParams.append('game_versions', JSON.stringify(v));
	}
	if (loaders && loaders.length > 0) {
		for (const l of loaders) url.searchParams.append('loaders', JSON.stringify(l));
	}

	const res = await fetch(url.toString(), {
		headers: { 'User-Agent': 'AuroraPanel/0.1' }
	});

	if (!res.ok) throw new Error(`Modrinth API error: ${res.status}`);
	return res.json() as Promise<ModrinthVersion[]>;
}

export async function getProject(projectId: string) {
	const res = await fetch(`${BASE}/project/${projectId}`, {
		headers: { 'User-Agent': 'AuroraPanel/0.1' }
	});
	if (!res.ok) throw new Error(`Modrinth API error: ${res.status}`);
	return res.json();
}

export async function getVersion(versionId: string): Promise<ModrinthVersion> {
	const res = await fetch(`${BASE}/version/${versionId}`, {
		headers: { 'User-Agent': 'AuroraPanel/0.1' }
	});
	if (!res.ok) throw new Error(`Modrinth API error: ${res.status}`);
	return res.json() as Promise<ModrinthVersion>;
}

export interface ResolvedInstall {
	version: ModrinthVersion;
	file: ModrinthVersionFile;
	dependencies: ResolvedInstall[];
}

export async function resolveInstall(
	projectId: string,
	opts?: { gameVersions?: string[]; loaders?: string[] }
): Promise<ResolvedInstall> {
	const versions = await getProjectVersions(projectId, opts?.gameVersions, opts?.loaders);
	if (versions.length === 0) {
		throw new Error(`No compatible versions found for project ${projectId}`);
	}
	const version = versions.find((v) => v.featured) ?? versions[0]!;
	const primaryFile = version.files.find((f) => f.primary) ?? version.files[0];
	if (!primaryFile) throw new Error(`No downloadable files for version ${version.id}`);

	const dependencies: ResolvedInstall[] = [];
	for (const dep of version.dependencies) {
		if (dep.dependency_type === 'required' && dep.project_id) {
			try {
				const resolved = await resolveInstall(dep.project_id, opts);
				dependencies.push(resolved);
			} catch {
				// Skip unresolvable dependencies
			}
		}
	}

	return { version, file: primaryFile, dependencies };
}

export async function downloadVersionFile(fileUrl: string): Promise<ArrayBuffer> {
	const res = await fetch(fileUrl, {
		headers: { 'User-Agent': 'AuroraPanel/0.1' }
	});
	if (!res.ok) throw new Error(`Download failed: ${res.status}`);
	return res.arrayBuffer();
}

export function getTargetFolder(projectType: string): string {
	switch (projectType) {
		case 'mod': return 'mods';
		case 'plugin': return 'plugins';
		case 'datapack': return 'world/datapacks';
		case 'modpack': return '';
		default: return 'mods';
	}
}

export function checkCompatibility(
	version: ModrinthVersion,
	serverGameVersion: string,
	serverLoader: string
): { compatible: boolean; reasons: string[] } {
	const reasons: string[] = [];

	const versionMatch = version.game_versions.some(
		(v) => v === serverGameVersion || serverGameVersion.startsWith(v.split('.')[0]!)
	);
	if (!versionMatch) {
		reasons.push(`Game version mismatch: server is ${serverGameVersion}, mod supports ${version.game_versions.join(', ')}`);
	}

	const loaderKey = serverLoader.toLowerCase();
	const loaderMatch = version.loaders.some(
		(l) => l.toLowerCase() === loaderKey
	);
	if (!loaderMatch) {
		reasons.push(`Loader mismatch: server is ${serverLoader}, mod supports ${version.loaders.join(', ')}`);
	}

	return { compatible: versionMatch && loaderMatch, reasons };
}
