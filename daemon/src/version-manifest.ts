import type { EggVersion } from './types';

// ── Cache Configuration ──
const CACHE_TTL = 5 * 60 * 1000;
let cachedManifest: VersionManifest | null = null;
let lastFetch = 0;
let fetchPromise: Promise<VersionManifest> | null = null;

// Persistent cache file survives daemon restarts
const PERSISTENT_CACHE_PATH = process.env.DATA_DIR
	? `${process.env.DATA_DIR}/version-cache.json`
	: './data/version-cache.json';

export interface VersionManifest {
	fetchedAt: number;
	minecraft: {
		vanilla: EggVersion[];
		paper: EggVersion[];
		purpur: EggVersion[];
		fabric: EggVersion[];
		forge: EggVersion[];
		neoforge: EggVersion[];
		quilt: EggVersion[];
		spigot: EggVersion[];
		folia: EggVersion[];
		bukkit: EggVersion[];
	};
	allGameVersions: string[];
}

const FETCH_TIMEOUT = 15_000;

async function fetchWithTimeout(url: string, timeoutMs = FETCH_TIMEOUT): Promise<Response> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const res = await fetch(url, { signal: controller.signal });
		return res;
	} finally {
		clearTimeout(timer);
	}
}

// Minimum versions for platforms that don't support very old MC
const MIN_FABRIC_VERSION = '1.14';
const MIN_QUILT_VERSION = '1.14';
const MIN_PAPER_VERSION = '1.16.5';
const MIN_PURPUR_VERSION = '1.16.5';
const MIN_FOLIA_VERSION = '1.20';
const MIN_NEOFORGE_VERSION = '1.20.1';
const MIN_SPIGOT_VERSION = '1.2.5';

function semverGte(a: string, b: string): boolean {
	const pa = a.split('.').map(Number);
	const pb = b.split('.').map(Number);
	for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
		const na = pa[i] ?? 0;
		const nb = pb[i] ?? 0;
		if (na !== nb) return na > nb;
	}
	return true;
}

// ── Mojang Version Manifest ──
const MOJANG_MANIFEST = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json';

async function fetchMojangVersions(): Promise<EggVersion[]> {
	const res = await fetchWithTimeout(MOJANG_MANIFEST);
	if (!res.ok) throw new Error(`Mojang API error: ${res.status}`);
	const data = (await res.json()) as {
		latest: { release: string; snapshot: string };
		versions: { id: string; type: string; url: string; time: string; releaseTime: string }[];
	};

	return data.versions.map(v => ({
		id: v.id,
		name: v.id,
		version: v.id,
		releaseType: mapMojangType(v.type),
		isLatest: v.id === data.latest.release,
		isRecommended: v.id === data.latest.release,
	}));
}

function mapMojangType(type: string): EggVersion['releaseType'] {
	switch (type) {
		case 'release': return 'release';
		case 'snapshot': return 'snapshot';
		case 'old_beta': return 'old_beta';
		case 'old_alpha': return 'old_alpha';
		default: return 'release';
	}
}

// ── PaperMC API (Paper + Folia) ──
async function fetchPaperStyleVersions(project: string, apiBase: string, minVersion?: string): Promise<EggVersion[]> {
	const res = await fetchWithTimeout(apiBase);
	if (!res.ok) throw new Error(`${project} API error: ${res.status}`);
	const data = (await res.json()) as { versions: string[] };

	const results: EggVersion[] = [];
	for (const v of data.versions) {
		if (minVersion && !semverGte(v, minVersion)) continue;
		try {
			const buildRes = await fetchWithTimeout(`${apiBase}/versions/${v}/builds`);
			if (!buildRes.ok) continue;
			const buildData = (await buildRes.json()) as { builds: { build: number; channel: string }[] };
			const latestBuild = buildData.builds[buildData.builds.length - 1];
			if (latestBuild) {
				results.push({
					id: `${v}-build-${latestBuild.build}`,
					name: `${v} (build ${latestBuild.build})`,
					version: v,
					releaseType: latestBuild.channel === 'default' ? 'release' : 'beta',
					build: latestBuild.build,
					isLatest: false,
					isRecommended: false,
				});
			}
		} catch {
			// skip versions that fail
		}
	}
	return results;
}

// ── Purpur API ──
async function fetchPurpurVersions(): Promise<EggVersion[]> {
	const res = await fetchWithTimeout('https://api.purpurmc.org/v2/purpur');
	if (!res.ok) throw new Error(`Purpur API error: ${res.status}`);
	const data = (await res.json()) as {
		versions: { [key: string]: { builds: { latest: string; all: string[] } } };
	};
	const versions: EggVersion[] = [];
	for (const [ver, info] of Object.entries(data.versions)) {
		if (!semverGte(ver, MIN_PURPUR_VERSION)) continue;
		const latestBuild = info.builds.latest;
		versions.push({
			id: `${ver}-build-${latestBuild}`,
			name: `${ver} (build ${latestBuild})`,
			version: ver,
			releaseType: 'release',
			build: parseInt(latestBuild),
			isLatest: false,
			isRecommended: false,
		});
	}
	return versions;
}

// ── Fabric Meta API ──
async function fetchFabricVersions(): Promise<EggVersion[]> {
	const [gameRes, loaderRes] = await Promise.all([
		fetchWithTimeout('https://meta.fabricmc.net/v2/versions/game').then(r => r.json()).catch(() => []),
		fetchWithTimeout('https://meta.fabricmc.net/v2/versions/loader').then(r => r.json()).catch(() => []),
	]);

	const gameVersions = gameRes as { version: string; stable: boolean }[];
	const loaderVersions = loaderRes as { version: string; stable: boolean }[];
	const latestStableLoader = loaderVersions.find(l => l.stable)?.version || loaderVersions[0]?.version || '0.16.10';

	return gameVersions
		.filter(v => semverGte(v.version, MIN_FABRIC_VERSION))
		.map(v => ({
			id: `fabric-${v.version}-${latestStableLoader}`,
			name: `${v.version} (Fabric ${latestStableLoader})`,
			version: v.version,
			releaseType: v.stable ? 'release' : 'snapshot',
			isLatest: false,
			isRecommended: v.stable,
			build: 0,
		}));
}

// ── Forge Promotions API ──
async function fetchForgeVersions(): Promise<EggVersion[]> {
	const res = await fetchWithTimeout('https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json');
	if (!res.ok) throw new Error(`Forge API error: ${res.status}`);
	const data = (await res.json()) as { promos: Record<string, string> };

	const versions: EggVersion[] = [];
	const seen = new Set<string>();
	for (const [key, value] of Object.entries(data.promos)) {
		if (key.endsWith('-latest')) {
			const mcVersion = key.replace('-latest', '');
			const forgeVersion = value;
			const fullVersion = `${mcVersion}-${forgeVersion}`;
			if (!seen.has(mcVersion)) {
				seen.add(mcVersion);
				versions.push({
					id: fullVersion,
					name: `${mcVersion} (Forge ${forgeVersion})`,
					version: mcVersion,
					releaseType: 'release',
					isLatest: data.promos[`${mcVersion}-recommended`] === forgeVersion,
					isRecommended: data.promos[`${mcVersion}-recommended`] === forgeVersion,
				});
			}
		}
	}

	return versions.sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }));
}

// ── NeoForge Maven API ──
async function fetchNeoForgeVersions(): Promise<EggVersion[]> {
	const res = await fetchWithTimeout('https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge');
	if (!res.ok) throw new Error(`NeoForge API error: ${res.status}`);
	const data = (await res.json()) as { versions: string[] };

	const filtered = data.versions.filter(v => {
		const match = v.match(/^(\d+)\.(\d+)(?:\.(\d+))?(?:-.*)?$/);
		if (!match) return false;
		const major = parseInt(match[1]);
		const minor = parseInt(match[2]);
		const patch = match[3] ? parseInt(match[3]) : 0;
		if (major < 1) return false;
		if (major === 1 && minor < 20) return false;
		if (major === 1 && minor === 20 && patch === 0) return false;
		return true;
	});

	const versionSet = new Map<string, string>();
	for (const v of filtered) {
		const match = v.match(/^(\d+)\.(\d+)(?:\.(\d+))?/);
		if (!match) continue;
		const patchStr = match[3] ? `.${match[3]}` : '';
		const mcKey = `${match[1]}.${match[2]}${patchStr}`;
		if (!versionSet.has(mcKey) || v > versionSet.get(mcKey)!) {
			versionSet.set(mcKey, v);
		}
	}

	const versions: EggVersion[] = [];
	for (const [mcVersion, neoforgeVer] of versionSet) {
		versions.push({
			id: `neoforge-${mcVersion}-${neoforgeVer}`,
			name: `${mcVersion} (NeoForge ${neoforgeVer})`,
			version: mcVersion,
			releaseType: 'release',
			isLatest: false,
			isRecommended: false,
		});
	}
	return versions;
}

// ── Quilt Meta API ──
async function fetchQuiltVersions(): Promise<EggVersion[]> {
	const [gameRes, loaderRes] = await Promise.all([
		fetchWithTimeout('https://meta.quiltmc.org/v3/versions/game').then(r => r.json()).catch(() => []),
		fetchWithTimeout('https://meta.quiltmc.org/v3/versions/loader').then(r => r.json()).catch(() => []),
	]);

	const gameVersions = gameRes as { version: string; stable: boolean }[];
	const loaders = loaderRes as { version: string }[];
	const latestLoader = loaders[0]?.version || '0.26.0';

	return gameVersions
		.filter(v => semverGte(v.version, MIN_QUILT_VERSION))
		.map(v => ({
			id: `quilt-${v.version}-${latestLoader}`,
			name: `${v.version} (Quilt ${latestLoader})`,
			version: v.version,
			releaseType: v.stable ? 'release' : 'snapshot',
			isLatest: false,
			isRecommended: v.stable,
		}));
}

// ── Spigot / Bukkit (static fallback extended from Mojang manifest) ──
const KNOWN_SPIGOT_VERSIONS = [
	'1.2.5', '1.3.1', '1.3.2', '1.4.2', '1.4.4', '1.4.5', '1.4.6', '1.4.7',
	'1.5.1', '1.5.2', '1.6.1', '1.6.2', '1.6.4', '1.7.2', '1.7.4', '1.7.5',
	'1.7.6', '1.7.7', '1.7.8', '1.7.9', '1.7.10', '1.8', '1.8.1', '1.8.3',
	'1.8.4', '1.8.5', '1.8.6', '1.8.7', '1.8.8', '1.8.9', '1.9', '1.9.1',
	'1.9.2', '1.9.3', '1.9.4', '1.10', '1.10.1', '1.10.2', '1.11', '1.11.1',
	'1.11.2', '1.12', '1.12.1', '1.12.2', '1.13', '1.13.1', '1.13.2', '1.14',
	'1.14.1', '1.14.2', '1.14.3', '1.14.4', '1.15', '1.15.1', '1.15.2',
	'1.16.1', '1.16.2', '1.16.3', '1.16.4', '1.16.5', '1.17', '1.17.1',
	'1.18', '1.18.1', '1.18.2', '1.19', '1.19.1', '1.19.2', '1.19.3', '1.19.4',
	'1.20', '1.20.1', '1.20.2', '1.20.3', '1.20.4', '1.20.5', '1.20.6',
	'1.21', '1.21.1', '1.21.2', '1.21.3', '1.21.4', '1.21.5',
];

async function makeSpigotVersions(): Promise<EggVersion[]> {
	const base = KNOWN_SPIGOT_VERSIONS.map(v => ({
		id: v,
		name: v,
		version: v,
		releaseType: 'release' as const,
		isLatest: false,
		isRecommended: false,
	}));

	try {
		const res = await fetchWithTimeout(MOJANG_MANIFEST, 5000);
		if (res.ok) {
			const data = await res.json() as { versions: { id: string; type: string }[] };
			const releaseVersions = data.versions
				.filter(v => v.type === 'release' && semverGte(v.id, MIN_SPIGOT_VERSION))
				.map(v => v.id);

			const seen = new Set(KNOWN_SPIGOT_VERSIONS);
			for (const v of releaseVersions) {
				if (!seen.has(v)) {
					seen.add(v);
					base.push({
						id: v,
						name: v,
						version: v,
						releaseType: 'release' as const,
						isLatest: false,
						isRecommended: false,
					});
				}
			}
		}
	} catch {
		// Use static list only if Mojang manifest fetch fails
	}

	return base.sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }));
}

async function makeBukkitVersions(): Promise<EggVersion[]> {
	const base = KNOWN_SPIGOT_VERSIONS.map(v => ({
		id: v,
		name: v,
		version: v,
		releaseType: 'release' as const,
		isLatest: false,
		isRecommended: false,
	}));

	try {
		const res = await fetchWithTimeout(MOJANG_MANIFEST, 5000);
		if (res.ok) {
			const data = await res.json() as { versions: { id: string; type: string }[] };
			const releaseVersions = data.versions
				.filter(v => v.type === 'release' && semverGte(v.id, MIN_SPIGOT_VERSION))
				.map(v => v.id);

			const seen = new Set(KNOWN_SPIGOT_VERSIONS);
			for (const v of releaseVersions) {
				if (!seen.has(v)) {
					seen.add(v);
					base.push({
						id: v,
						name: v,
						version: v,
						releaseType: 'release' as const,
						isLatest: false,
						isRecommended: false,
					});
				}
			}
		}
	} catch {
		// Use static list only if Mojang manifest fetch fails
	}

	return base.sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }));
}

// ── Persistent Cache ──
async function loadPersistentCache(): Promise<VersionManifest | null> {
	try {
		const { existsSync, readFileSync } = await import('node:fs');
		if (existsSync(PERSISTENT_CACHE_PATH)) {
			const raw = readFileSync(PERSISTENT_CACHE_PATH, 'utf-8');
			const data = JSON.parse(raw) as VersionManifest;
			if (data && data.fetchedAt && data.minecraft && data.allGameVersions) {
				return data;
			}
		}
	} catch {
		// Silent fail on cache read
	}
	return null;
}

async function savePersistentCache(manifest: VersionManifest): Promise<void> {
	try {
		const { mkdirSync, writeFileSync } = await import('node:fs');
		const { dirname } = await import('node:path');
		mkdirSync(dirname(PERSISTENT_CACHE_PATH), { recursive: true });
		writeFileSync(PERSISTENT_CACHE_PATH, JSON.stringify(manifest, null, 2));
	} catch {
		// Silent fail on cache write
	}
}

// ── Build Full Manifest ──
async function buildManifest(): Promise<VersionManifest> {
	const [vanilla, paper, purpur, fabric, forge, neoforge, quilt, folia, spigot, bukkit] = await Promise.all([
		fetchMojangVersions().catch(e => { console.error('[Manifest] Mojang fetch failed:', e); return [] as EggVersion[]; }),
		fetchPaperStyleVersions('Paper', 'https://api.papermc.io/v2/projects/paper', MIN_PAPER_VERSION).catch(e => {
			console.error('[Manifest] Paper fetch failed:', e); return [] as EggVersion[];
		}),
		fetchPurpurVersions().catch(e => { console.error('[Manifest] Purpur fetch failed:', e); return [] as EggVersion[]; }),
		fetchFabricVersions().catch(e => { console.error('[Manifest] Fabric fetch failed:', e); return [] as EggVersion[]; }),
		fetchForgeVersions().catch(e => { console.error('[Manifest] Forge fetch failed:', e); return [] as EggVersion[]; }),
		fetchNeoForgeVersions().catch(e => { console.error('[Manifest] NeoForge fetch failed:', e); return [] as EggVersion[]; }),
		fetchQuiltVersions().catch(e => { console.error('[Manifest] Quilt fetch failed:', e); return [] as EggVersion[]; }),
		fetchPaperStyleVersions('Folia', 'https://api.papermc.io/v2/projects/folia', MIN_FOLIA_VERSION).catch(e => {
			console.error('[Manifest] Folia fetch failed:', e); return [] as EggVersion[];
		}),
		makeSpigotVersions().catch(e => { console.error('[Manifest] Spigot versions failed:', e); return [] as EggVersion[]; }),
		makeBukkitVersions().catch(e => { console.error('[Manifest] Bukkit versions failed:', e); return [] as EggVersion[]; }),
	]);

	const allVersionsSet = new Set<string>();
	for (const list of [vanilla, paper, purpur, fabric, forge, neoforge, quilt, spigot, folia, bukkit]) {
		for (const v of list) {
			allVersionsSet.add(v.version);
		}
	}

	const allGameVersions = Array.from(allVersionsSet).sort((a, b) => {
		return b.localeCompare(a, undefined, { numeric: true });
	});

	const manifest: VersionManifest = {
		fetchedAt: Date.now(),
		minecraft: { vanilla, paper, purpur, fabric, forge, neoforge, quilt, spigot, folia, bukkit },
		allGameVersions,
	};

	void savePersistentCache(manifest);

	return manifest;
}

// ── Public API ──
export async function getVersionManifest(forceRefresh = false): Promise<VersionManifest> {
	const now = Date.now();
	if (!forceRefresh && cachedManifest && now - lastFetch < CACHE_TTL) {
		return cachedManifest;
	}

	if (fetchPromise) return fetchPromise;

	fetchPromise = (async () => {
		if (!cachedManifest) {
			const persisted = await loadPersistentCache();
			if (persisted) {
				cachedManifest = persisted;
				lastFetch = persisted.fetchedAt;
				if (!forceRefresh && now - persisted.fetchedAt < CACHE_TTL) {
					fetchPromise = null;
					return cachedManifest;
				}
			}
		}

		try {
			const manifest = await buildManifest();
			cachedManifest = manifest;
			lastFetch = Date.now();
			return manifest;
		} catch (e) {
			if (cachedManifest) {
				console.warn('[Manifest] Refresh failed, using stale cache:', e);
				return cachedManifest;
			}
			throw e;
		} finally {
			fetchPromise = null;
		}
	})();

	return fetchPromise;
}

export async function getVersionsForPlatform(platform: string, forceRefresh = false): Promise<EggVersion[]> {
	const manifest = await getVersionManifest(forceRefresh);
	const key = platform.toLowerCase() as keyof typeof manifest.minecraft;
	return (manifest.minecraft[key] as EggVersion[]) ?? [];
}

export async function refreshManifest(): Promise<VersionManifest> {
	cachedManifest = null;
	lastFetch = 0;
	return getVersionManifest(true);
}
