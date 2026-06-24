import { writable } from 'svelte/store';

export type InstalledEntry = {
	projectId: string;
	versionId: string;
	versionNumber: string;
	title?: string;
	installedAt: string;
};

function createInstalledStore() {
	const { subscribe, set, update } = writable<Map<string, InstalledEntry>>(new Map());

	function addEntry(projectId: string, versionId: string, versionNumber: string, title?: string) {
		update((m) => {
			m.set(projectId, { projectId, versionId, versionNumber, title, installedAt: new Date().toISOString() });
			return new Map(m);
		});
	}

	function removeEntry(projectId: string) {
		update((m) => {
			m.delete(projectId);
			return new Map(m);
		});
	}

	function fromJSON(json: Record<string, InstalledEntry>) {
		set(new Map(Object.entries(json)));
	}

	function toJSON(m: Map<string, InstalledEntry>): Record<string, InstalledEntry> {
		return Object.fromEntries(m);
	}

	return { subscribe, set, update, addEntry, removeEntry, fromJSON, toJSON };
}

export const installedProjects = createInstalledStore();
