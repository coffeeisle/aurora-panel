import { writable } from 'svelte/store';
export const installedProjects = writable<Set<string>>(new Set());
