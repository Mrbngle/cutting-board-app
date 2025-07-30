import { get, type Writable } from 'svelte/store'; // Keep 'get'
import { createPersistentStore } from '$lib/utils/persistentStore'; // Adjust path if needed
import { boardStore, INCHES_TO_MM, type BoardState } from './boardStore'; // Keep imports needed for methods

// Keep CutSettings interface
export interface CutSettings {
	kerfMm: number;
	edgeTrimMm: number;
	minScrapWidthMm: number;
	minScrapLengthMm: number;
	respectGrain: boolean;
	optimizationAlgo: 'waste' | 'cuts' | 'priority';
}

// Keep default settings constant
const defaultSettings: CutSettings = {
	kerfMm: 3,
	edgeTrimMm: 5,
	minScrapWidthMm: 50,
	minScrapLengthMm: 50,
	respectGrain: true,
	optimizationAlgo: 'waste'
};

// Define a unique key for localStorage
const STORAGE_KEY = 'plywood_settings_v1';

// Keep SettingsStore interface
export interface SettingsStore extends Pick<Writable<CutSettings>, 'subscribe' | 'set'> {
	updateSetting: <K extends keyof CutSettings>(
		settingName: K,
		value: CutSettings[K] | string | number | boolean
	) => void;
	resetSettings: () => void;
}

function createSettingsStore(): SettingsStore {
	// Use createPersistentStore instead of writable
	const { subscribe, set, update }: Writable<CutSettings> = createPersistentStore<CutSettings>(
		STORAGE_KEY,
		defaultSettings
	);

	// --- Methods remain the same ---
	// They use 'update', 'set', and 'get(boardStore)' correctly
	const updateSetting = <K extends keyof CutSettings>(settingName: K, value: any): void => {
		update((currentState: CutSettings): CutSettings => {
			const newState = { ...currentState };
			const dimensionKeysMm: Array<keyof CutSettings> = [
				'kerfMm',
				'edgeTrimMm',
				'minScrapWidthMm',
				'minScrapLengthMm'
			];
			let currentUnits: 'mm' | 'inches' | undefined;
			if (dimensionKeysMm.includes(settingName)) {
				currentUnits = get(boardStore).units;
			}

			try {
				if (dimensionKeysMm.includes(settingName)) {
					let numericValue = parseFloat(String(value)) || 0;
					numericValue = Math.max(0, numericValue);
					const valueMm = currentUnits === 'inches' ? numericValue * INCHES_TO_MM : numericValue;
					newState[
						settingName as 'kerfMm' | 'edgeTrimMm' | 'minScrapWidthMm' | 'minScrapLengthMm'
					] = valueMm;
				} else if (settingName === 'respectGrain') {
					newState.respectGrain = Boolean(value);
				} else if (settingName === 'optimizationAlgo') {
					if (value === 'waste' || value === 'cuts' || value === 'priority') {
						newState.optimizationAlgo = value;
					} else {
						console.warn(`SettingsStore: Invalid value "${value}" provided for optimizationAlgo.`);
						return currentState;
					}
				} else {
					console.warn(`SettingsStore: Unknown setting "${String(settingName)}"`);
					return currentState;
				}
			} catch (error) {
				console.error(`SettingsStore: Error updating "${String(settingName)}":`, error);
				return currentState;
			}
			return newState;
		});
	};

	const resetSettings = (): void => {
		// Set store back to the defined default settings
		set(defaultSettings);
	};

	return {
		subscribe,
		set,
		updateSetting,
		resetSettings
	};
}

// Export the created store instance
export const settingsStore: SettingsStore = createSettingsStore();
