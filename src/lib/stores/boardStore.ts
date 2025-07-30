import { type Writable } from 'svelte/store'; // Only need Writable type here now
// Import our persistent store creator
import { createPersistentStore } from '$lib/utils/persistentStore'; // Adjust path if needed
// Keep INCHES_TO_MM if exported/used elsewhere, or define locally if only used here
export const INCHES_TO_MM: number = 25.4;

// Interface for the store's state remains the same
export interface BoardState {
	widthMm: number;
	lengthMm: number;
	thicknessMm: number;
	units: 'mm' | 'inches';
}

// Default state remains the same
const defaultBoardState: BoardState = {
	widthMm: 2440,
	lengthMm: 1220,
	thicknessMm: 18,
	units: 'mm'
};

// Define a unique key for localStorage
const STORAGE_KEY = 'plywood_board_v1';

// Interface for the exported store methods remains the same
export interface BoardStore extends Pick<Writable<BoardState>, 'subscribe' | 'set'> {
	updateDimension: (dimension: 'width' | 'length' | 'thickness', value: number | string) => void;
	setUnits: (newUnit: 'mm' | 'inches') => void;
	reset: () => void;
}

function createBoardStore(): BoardStore {
	// Use createPersistentStore instead of writable
	const { subscribe, set, update }: Writable<BoardState> = createPersistentStore<BoardState>(
		STORAGE_KEY,
		defaultBoardState
	);

	// --- Methods remain the same ---
	// They operate on the 'update' and 'set' functions provided by the store instance1
	const updateDimension = (
		dimension: 'width' | 'length' | 'thickness',
		value: number | string
	): void => {
		update((state: BoardState): BoardState => {
			let numericValue: number = parseFloat(String(value)) || 0;
			let valueMm: number = state.units === 'inches' ? numericValue * INCHES_TO_MM : numericValue;
			valueMm = Math.max(0, valueMm);
			const keyMm = `${dimension}Mm` as keyof BoardState;
			if (keyMm in defaultBoardState) {
				return { ...state, [keyMm]: valueMm };
			} else {
				console.warn(`boardStore: Invalid dimension specified - ${dimension}`);
				return state;
			}
		});
	};

	const setUnits = (newUnit: 'mm' | 'inches'): void => {
		update((state: BoardState): BoardState => {
			if ((newUnit === 'mm' || newUnit === 'inches') && state.units !== newUnit) {
				return { ...state, units: newUnit };
			}
			return state;
		});
	};

	const reset = (): void => {
		// Set store back to the defined default state
		set(defaultBoardState);
	};

	return {
		subscribe,
		updateDimension,
		setUnits,
		set,
		reset
	};
}

// Export the created store instance
export const boardStore: BoardStore = createBoardStore();
