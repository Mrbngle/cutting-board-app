import { writable, type Writable } from 'svelte/store';
import { browser } from '$app/environment'; // Crucial for SvelteKit to check if running in browser

/**
 * Creates a Svelte writable store that automatically persists its state
 * to localStorage and rehydrates from it on initialization.
 *
 * - Only operates in the browser environment.
 * - Handles potential errors during localStorage access or JSON parsing.
 * - Uses JSON.stringify/parse for serialization.
 *
 * @template T The type of the data stored in the store.
 * @param {string} key The unique key to use for localStorage. It's recommended to use
 * versioning in the key (e.g., 'my-app-settings-v1') to avoid
 * issues if the data structure changes later.
 * @param {T} initialValue The default value to use if nothing is found in localStorage,
 * if parsing fails, or if running in a non-browser environment.
 * @returns {Writable<T>} A Svelte Writable store instance with persistence behavior.
 */
export function createPersistentStore<T>(key: string, initialValue: T): Writable<T> {
	let storeValue: T = initialValue; // Start with the default
	let isBrowserAndStorageAvailable = false;

	// --- Check for Browser and localStorage Availability ---
	if (browser) {
		try {
			// Test if localStorage is actually available and writable (can fail in private Browse/some settings)
			localStorage.setItem(key + '__test', '1');
			localStorage.removeItem(key + '__test');
			isBrowserAndStorageAvailable = true;

			// --- Attempt to Load Stored Data ---
			const storedJson = localStorage.getItem(key);
			if (storedJson) {
				try {
					storeValue = JSON.parse(storedJson); // Try parsing stored JSON
					console.log(`PersistentStore: Loaded state for key "${key}" from localStorage.`);
				} catch (e) {
					console.error(
						`PersistentStore: Error parsing JSON for key "${key}". Using initial value.`,
						e
					);
					storeValue = initialValue; // Use initial value if parsing fails
					// Optionally remove the corrupted item to prevent future errors
					localStorage.removeItem(key);
				}
			} else {
				// console.log(`PersistentStore: No data found for key "${key}". Using initial value.`); // Optional log
			}
		} catch (e) {
			console.warn(
				`PersistentStore: localStorage not available or writable for key "${key}". Persistence disabled.`,
				e
			);
			isBrowserAndStorageAvailable = false; // Ensure flag is false if test write failed
			storeValue = initialValue; // Use initial value if storage is unavailable
		}
	} else {
		console.log(`PersistentStore: Not in browser context for key "${key}". Using initial value.`); // Optional log
	}

	// --- Create the Svelte Store ---
	const store: Writable<T> = writable(storeValue);

	// --- Subscribe to Save Changes (only if possible) ---
	if (isBrowserAndStorageAvailable) {
		store.subscribe(($currentValue: T) => {
			try {
				const jsonToStore = JSON.stringify($currentValue);
				localStorage.setItem(key, jsonToStore);
				// console.log(`PersistentStore: Saved state for key "${key}"`); // Can be noisy, uncomment for debugging
			} catch (e) {
				console.error(
					`PersistentStore: Failed to save state for key "${key}" to localStorage. (Quota exceeded?)`,
					e
				);
			}
		});
	}

	// Return the enhanced store
	return store;
}
