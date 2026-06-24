import type { ModrinthSearchResult, ModrinthVersion } from '$lib/types/modrinth';

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
