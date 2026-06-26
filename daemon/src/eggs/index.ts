import type { EggDefinition, EggVersion } from '../types';
import { vanillaEgg } from './vanilla';
import { paperEgg } from './paper';
import { purpurEgg } from './purpur';
import { fabricEgg } from './fabric';
import { forgeEgg } from './forge';
import { neoforgeEgg } from './neoforge';
import { quiltEgg } from './quilt';
import { spigotEgg } from './spigot';
import { foliaEgg } from './folia';
import { bukkitEgg } from './bukkit';

const eggRegistry = new Map<string, EggDefinition>();

export function registerEgg(egg: EggDefinition): void {
	eggRegistry.set(egg.id, egg);
}

export function getEgg(id: string): EggDefinition | undefined {
	return eggRegistry.get(id);
}

export function getAllEggs(): EggDefinition[] {
	return Array.from(eggRegistry.values());
}

export function getEggsForGame(game: string): EggDefinition[] {
	return Array.from(eggRegistry.values()).filter(e => e.game === game);
}

export function getEggForPlatform(platform: string): EggDefinition | undefined {
	return Array.from(eggRegistry.values()).find(
		e => e.platform === platform || e.id === platform
	);
}

registerEgg(vanillaEgg);
registerEgg(paperEgg);
registerEgg(purpurEgg);
registerEgg(fabricEgg);
registerEgg(forgeEgg);
registerEgg(neoforgeEgg);
registerEgg(quiltEgg);
registerEgg(spigotEgg);
registerEgg(foliaEgg);
registerEgg(bukkitEgg);

export const eggDefinitions: Record<string, { id: string; name: string; loader: string; platform: string }[]> = {
	minecraft: getAllEggs().filter(e => e.game === 'minecraft').map(e => ({
		id: e.id,
		name: e.name,
		loader: e.loader,
		platform: e.platform,
	})),
};
