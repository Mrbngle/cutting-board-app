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

<style>
	.board-setup-card {
		border: 1px solid #e0e0e0; /* Lighter border */
		border-radius: 6px;
		padding: 1.5rem 2rem; /* More padding */
		background-color: #ffffff;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
		max-width: 600px; /* Slightly wider */
		margin-bottom: 2rem; /* Space below card */
	}

	.board-setup-card h2 {
		margin-top: 0;
		margin-bottom: 1.5rem;
		color: #333;
		font-size: 1.4rem;
		border-bottom: 1px solid #eee;
		padding-bottom: 0.8rem;
	}

	.unit-selection {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-bottom: 1.5rem;
		flex-wrap: wrap;
	}

	.unit-selection .label {
		font-weight: 600; /* Slightly bolder */
		color: #444;
		font-size: 0.95rem;
	}

	.radio-group {
		display: flex;
		gap: 1.5rem; /* Wider spacing */
	}

	.radio-group label {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		cursor: pointer;
		font-size: 0.95rem;
	}
	/* Style radio button itself slightly */
	.radio-group input[type='radio'] {
		cursor: pointer;
		accent-color: #007bff; /* Color the radio button */
	}

	.dimension-inputs {
		display: grid;
		/* Adjust column width based on content/available space */
		grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
		gap: 1.2rem; /* Slightly more gap */
		margin-bottom: 1.5rem;
	}

	.input-group {
		display: flex;
		flex-direction: column;
	}

	.input-group label {
		margin-bottom: 0.4rem;
		font-weight: 500; /* Medium weight */
		color: #555;
		font-size: 0.9rem;
	}

	.input-group input[type='number'] {
		padding: 0.7rem 0.8rem; /* Slightly more padding */
		border: 1px solid #ccc;
		border-radius: 4px;
		font-size: 1rem;
		background-color: #fdfdfd;
		transition:
			border-color 0.2s ease,
			box-shadow 0.2s ease;
		/* Remove spinners */
		-moz-appearance: textfield;
		appearance: textfield;
	}
	.input-group input[type='number']::-webkit-outer-spin-button,
	.input-group input[type='number']::-webkit-inner-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}
	.input-group input[type='number']:focus {
		border-color: #007bff;
		box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
		outline: none;
	}

	.actions {
		display: flex;
		justify-content: flex-end; /* Align button to the right */
		margin-top: 1rem;
	}

	.actions button {
		padding: 0.6rem 1.2rem;
		font-size: 0.9rem;
		font-weight: 500;
		cursor: pointer;
		background-color: #6c757d;
		color: white;
		border: none;
		border-radius: 4px;
		transition: background-color 0.2s ease;
	}

	.actions button:hover {
		background-color: #5a6268;
	}
</style>
