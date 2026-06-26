import { cpus, totalmem, freemem, uptime, hostname } from 'node:os';
import { existsSync, statSync } from 'node:fs';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { SystemStats } from './types';

let prevCpuTimes: { idle: number; total: number } | null = null;

function getCpuLoad(): { load: number; cores: number } {
	const cores = cpus().length;
	const cpusInfo = cpus();

	let idle = 0;
	let total = 0;
	for (const cpu of cpusInfo) {
		idle += cpu.times.idle;
		total += cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.idle + cpu.times.irq;
	}

	if (prevCpuTimes) {
		const idleDelta = idle - prevCpuTimes.idle;
		const totalDelta = total - prevCpuTimes.total;
		const load = totalDelta > 0 ? 100 - (idleDelta / totalDelta) * 100 : 0;
		prevCpuTimes = { idle, total };
		return { load: Math.round(load * 100) / 100, cores };
	}

	prevCpuTimes = { idle, total };
	return { load: 0, cores };
}

function getDiskUsage(serversDir: string): { total: number; used: number; free: number } {
	try {
		if (!existsSync(serversDir)) {
			return { total: 0, used: 0, free: 0 };
		}
		let totalSize = 0;
		function walk(dir: string) {
			try {
				const entries = readdirSync(dir, { withFileTypes: true });
				for (const entry of entries) {
					const fullPath = join(dir, entry.name);
					try {
						if (entry.isDirectory()) {
							walk(fullPath);
						} else if (entry.isFile()) {
							totalSize += statSync(fullPath).size;
						}
					} catch {}
				}
			} catch {}
		}
		walk(serversDir);
		return { total: 1024 * 1024 * 1024, used: totalSize, free: 1024 * 1024 * 1024 - totalSize };
	} catch {
		return { total: 0, used: 0, free: 0 };
	}
}

export function getSystemStats(config: { serversDir: string; daemonId: string; version: string; serversCount: number }): SystemStats {
	const cpu = getCpuLoad();
	const memTotal = totalmem();
	const memFree = freemem();
	const disk = getDiskUsage(config.serversDir);

	return {
		cpu: {
			load: cpu.load,
			cores: cpu.cores,
		},
		memory: {
			total: Math.round(memTotal / 1024 / 1024),
			used: Math.round((memTotal - memFree) / 1024 / 1024),
			free: Math.round(memFree / 1024 / 1024),
		},
		disk: {
			total: Math.round(disk.total / 1024 / 1024),
			used: Math.round(disk.used / 1024 / 1024),
			free: Math.round(disk.free / 1024 / 1024),
		},
		uptime: Math.floor(process.uptime()),
		version: config.version,
		daemonId: config.daemonId,
		serversCount: config.serversCount,
	};
}

export function getHostInfo() {
	return {
		hostname: hostname(),
		platform: process.platform,
		arch: process.arch,
		bunVersion: process.version,
	};
}
