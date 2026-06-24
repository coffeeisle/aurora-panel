import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env['DAEMON_JWT_SECRET'] ?? 'dev-secret';

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
