import { writable } from 'svelte/store';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
	id: string;
	type: ToastType;
	title: string;
	message?: string;
	duration?: number;
}

function createToastStore() {
	const { subscribe, update } = writable<Toast[]>([]);

	function add(toast: Omit<Toast, 'id'>) {
		const id = crypto.randomUUID();
		update((t) => [...t, { ...toast, id }]);
		const duration = toast.duration ?? 5000;
		if (duration > 0) {
			setTimeout(() => {
				remove(id);
			}, duration);
		}
		return id;
	}

	function remove(id: string) {
		update((t) => t.filter((toast) => toast.id !== id));
	}

	function success(title: string, message?: string) {
		add({ type: 'success', title, message, duration: 4000 });
	}

	function error(title: string, message?: string) {
		add({ type: 'error', title, message, duration: 8000 });
	}

	function info(title: string, message?: string) {
		add({ type: 'info', title, message, duration: 5000 });
	}

	function warning(title: string, message?: string) {
		add({ type: 'warning', title, message, duration: 6000 });
	}

	function clear() {
		update(() => []);
	}

	return { subscribe, add, remove, success, error, info, warning, clear };
}

export const toasts = createToastStore();
