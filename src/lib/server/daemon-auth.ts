import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env['DAEMON_JWT_SECRET'] ?? 'dev-secret';
const RATE_LIMIT_WINDOW = 60000;
const RATE_LIMIT_MAX = 30;

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string): boolean {
	const now = Date.now();
	const entry = rateLimitMap.get(key);
	if (!entry || now > entry.resetAt) {
		rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
		return true;
	}
	if (entry.count >= RATE_LIMIT_MAX) return false;
	entry.count++;
	return true;
}

export function generateDaemonToken(daemonId: string): string {
	return jwt.sign({ id: daemonId, type: 'daemon' }, JWT_SECRET, { expiresIn: '24h' });
}

export function verifyDaemonToken(token: string): { id: string; type: string } | null {
	try {
		const decoded = jwt.verify(token, JWT_SECRET) as { id: string; type: string };
		return decoded;
	} catch {
		return null;
	}
}

export function generateBrowserToken(userId: string): string {
	return jwt.sign({ id: userId, type: 'browser' }, JWT_SECRET, { expiresIn: '1h' });
}

export function getJwtSecret(): string {
	return JWT_SECRET;
}

export function getDaemonTokenExpiry(): string {
	return '24h';
}
