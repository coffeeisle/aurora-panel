type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
	id: string;
	type: ToastType;
	title: string;
	message?: string;
	duration?: number;
}

let listeners: Array<(items: Toast[]) => void> = [];
let items: Toast[] = [];
let counter = 0;

function notify() {
	for (const listener of listeners) {
		listener([...items]);
	}
}

export const toastStore = {
	subscribe(listener: (items: Toast[]) => void) {
		listeners.push(listener);
		listener([...items]);
		return () => {
			listeners = listeners.filter(l => l !== listener);
		};
	},

	add(type: ToastType, title: string, message?: string, duration = 5000) {
		const id = `toast-${++counter}`;
		items = [...items, { id, type, title, message, duration }];
		notify();
		if (duration > 0) {
			setTimeout(() => this.dismiss(id), duration);
		}
	},

	dismiss(id: string) {
		items = items.filter(t => t.id !== id);
		notify();
	},

	clear() {
		items = [];
		notify();
	},
};

export const toasts = {
	success(title: string, message?: string) { toastStore.add('success', title, message); },
	error(title: string, message?: string) { toastStore.add('error', title, message, 8000); },
	info(title: string, message?: string) { toastStore.add('info', title, message); },
	warning(title: string, message?: string) { toastStore.add('warning', title, message, 8000); },
	crash(title: string, message?: string) { toastStore.add('error', title, message, 0); },
};
