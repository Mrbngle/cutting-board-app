<script lang="ts">
	import { derived, type Readable } from 'svelte/store';
	import { boardStore, INCHES_TO_MM, type BoardState } from '$lib/stores/boardStore';

	// --- Derived Store for Display ---
	// This creates a reactive variable 'displayDimensions' based on the boardStore.
	// It converts the internal mm values to the currently selected units for display.
	const displayDimensions: Readable<{
		width: number;
		length: number;
		thickness: number;
		units: 'mm' | 'inches';
	}> = derived(
		boardStore,
		// This function runs whenever boardStore changes
		(
			$boardStore: BoardState
		): { width: number; length: number; thickness: number; units: 'mm' | 'inches' } => {
			/** Helper function to round a number to a specific number of decimal places */
			const round = (val: number, decimals: number): number => {
				const factor = Math.pow(10, decimals);
				return Math.round(val * factor) / factor;
			};

			if ($boardStore.units === 'inches') {
				// Convert mm to inches and round for display (e.g., 3 decimal places for precision)
				return {
					width: round($boardStore.widthMm / INCHES_TO_MM, 3),
					length: round($boardStore.lengthMm / INCHES_TO_MM, 3),
					thickness: round($boardStore.thicknessMm / INCHES_TO_MM, 3),
					units: 'inches'
				};
			} else {
				// Display mm, rounded (e.g., 1 decimal place, or 0 for whole numbers)
				return {
					width: round($boardStore.widthMm, 1),
					length: round($boardStore.lengthMm, 1),
					thickness: round($boardStore.thicknessMm, 1),
					units: 'mm'
				};
			}
		}
	);

	// --- Input Handlers ---
	// Called when the user types in an input field.
	// It takes the raw value from the input event.
	function handleInput(event: Event, dimension: 'width' | 'length' | 'thickness'): void {
		const target = event.target as HTMLInputElement;
		// Pass the dimension name and the *raw input value* to the store.
		// The store's updateDimension method handles parsing, converting (if necessary), and updating the state.
		boardStore.updateDimension(dimension, target.value);
	}

	// --- Unit Selection Handler ---
	// Called when a unit radio button's state changes.
	function handleUnitChange(event: Event): void {
		const target = event.target as HTMLInputElement;
		// Assert the value is one of our expected unit types
		const newUnit = target.value as 'mm' | 'inches';
		boardStore.setUnits(newUnit);
		// The 'displayDimensions' derived store will automatically react to this change,
		// causing the input fields' displayed values to update.
	}
</script>

<div class="board-setup-card">
	<h2>Board Setup</h2>

	<div class="unit-selection">
		<span class="label">Units:</span>
		<div class="radio-group">
			<label>
				<input
					type="radio"
					name="units"
					value="mm"
					checked={$displayDimensions.units === 'mm'}
					on:change={handleUnitChange}
				/>
				mm
			</label>
			<label>
				<input
					type="radio"
					name="units"
					value="inches"
					checked={$displayDimensions.units === 'inches'}
					on:change={handleUnitChange}
				/>
				inches
			</label>
		</div>
	</div>

	<div class="dimension-inputs">
		<div class="input-group">
			<label for="board-width">Width ({$displayDimensions.units}):</label>
			<input
				type="number"
				id="board-width"
				name="width"
				placeholder="Enter width"
				value={$displayDimensions.width}
				on:input={(e) => handleInput(e, 'width')}
				step="any"
				min="0"
			/>
		</div>

		<div class="input-group">
			<label for="board-length">Length ({$displayDimensions.units}):</label>
			<input
				type="number"
				id="board-length"
				name="length"
				placeholder="Enter length"
				value={$displayDimensions.length}
				on:input={(e) => handleInput(e, 'length')}
				step="any"
				min="0"
			/>
		</div>

		<div class="input-group">
			<label for="board-thickness">Thickness ({$displayDimensions.units}):</label>
			<input
				type="number"
				id="board-thickness"
				name="thickness"
				placeholder="Enter thickness"
				value={$displayDimensions.thickness}
				on:input={(e) => handleInput(e, 'thickness')}
				step="any"
				min="0"
			/>
		</div>
	</div>

	<div class="actions">
		<button on:click={() => boardStore.reset()} title="Reset dimensions to defaults">
			Reset Dimensions
		</button>
	</div>
</div>

<style lang="scss" src="./BoardSetup.scss"></style>
