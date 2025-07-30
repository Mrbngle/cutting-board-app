<script lang="ts">
	import { derived, type Readable } from 'svelte/store';
	import { settingsStore, type CutSettings } from '$lib/stores/settingsStore';
	// Import boardStore only to get units for display and conversion context
	import { boardStore, INCHES_TO_MM, type BoardState } from '$lib/stores/boardStore';

	// --- Type definition for the derived store's output ---
	// This holds values formatted for display in the current units
	interface DisplaySettings {
		kerf: number;
		edgeTrim: number;
		minScrapWidth: number;
		minScrapLength: number;
		respectGrain: boolean; // Pass boolean directly
		optimizationAlgo: CutSettings['optimizationAlgo']; // Pass algorithm choice directly
		units: 'mm' | 'inches'; // Include current units for easy access in the template
	}

	// --- Derived store for calculated display values ---
	// Reacts to changes in both settingsStore and boardStore (for units)
	const displaySettings: Readable<DisplaySettings> = derived(
		[settingsStore, boardStore], // Array of stores this derived store depends on
		([$settingsStore, $boardStore]): DisplaySettings => {
			// Destructure values from the stores
			const { units } = $boardStore;
			const {
				kerfMm,
				edgeTrimMm,
				minScrapWidthMm,
				minScrapLengthMm,
				respectGrain,
				optimizationAlgo
			} = $settingsStore;

			// Helper function to convert mm value to the current display units
			const convert = (valMm: number): number => {
				return units === 'inches' ? valMm / INCHES_TO_MM : valMm;
			};

			// Helper function to round numbers consistently for display
			const round = (val: number, decimals: number): number => {
				const factor = Math.pow(10, decimals);
				// Use Number.EPSILON for potentially better floating point handling before rounding
				return Math.round((val + Number.EPSILON) * factor) / factor;
			};

			// Determine rounding precision based on current units
			const decimals = units === 'inches' ? 3 : 1; // e.g., 3 for inches, 1 for mm

			// Return the calculated object for display
			return {
				kerf: round(convert(kerfMm), decimals),
				edgeTrim: round(convert(edgeTrimMm), decimals),
				minScrapWidth: round(convert(minScrapWidthMm), decimals),
				minScrapLength: round(convert(minScrapLengthMm), decimals),
				respectGrain, // Pass boolean through directly
				optimizationAlgo, // Pass string literal through directly
				units // Include units for convenient use in the template
			};
		}
	);

	// --- Input Handlers ---

	/** Handles input changes for dimension-related settings (Kerf, Trim, Min Scrap) */
	function handleDimensionInput(
		event: Event,
		// Specify the keys of CutSettings that represent dimensions stored in mm
		settingKey: 'kerfMm' | 'edgeTrimMm' | 'minScrapWidthMm' | 'minScrapLengthMm'
	): void {
		const target = event.target as HTMLInputElement;
		// Send the raw input value and the corresponding internal '...Mm' key to the store.
		// The store's `updateSetting` method is responsible for parsing this value,
		// converting it back to mm based on current units, validating, and updating state.
		settingsStore.updateSetting(settingKey, target.value);
	}

	/** Handles changes for the 'Respect Grain Direction' checkbox */
	function handleRespectGrainChange(event: Event): void {
		const target = event.target as HTMLInputElement;
		// Update the 'respectGrain' setting with the checkbox's checked state (true/false)
		settingsStore.updateSetting('respectGrain', target.checked);
	}

	/** Handles changes for the 'Optimization Algorithm' select dropdown */
	function handleAlgoChange(event: Event): void {
		const target = event.target as HTMLSelectElement;
		// Assert the value type based on the known options defined in CutSettings['optimizationAlgo']
		const value = target.value as CutSettings['optimizationAlgo'];
		settingsStore.updateSetting('optimizationAlgo', value);
	}
</script>

<div class="cut-parameters-card card">
	<h3>Cutting Parameters & Settings</h3>

	<div class="form-grid">
		<div class="input-group">
			<label for="param-kerf">Saw Kerf ({$displaySettings.units}):</label>
			<input
				type="number"
				id="param-kerf"
				aria-describedby="kerf-desc"
				value={$displaySettings.kerf}
				on:input={(e) => handleDimensionInput(e, 'kerfMm')}
				step="any"
				min="0"
				required
			/>
			<small id="kerf-desc">Thickness of the blade cut.</small>
		</div>

		<div class="input-group">
			<label for="param-trim">Edge Trim ({$displaySettings.units}):</label>
			<input
				type="number"
				id="param-trim"
				aria-describedby="trim-desc"
				value={$displaySettings.edgeTrim}
				on:input={(e) => handleDimensionInput(e, 'edgeTrimMm')}
				step="any"
				min="0"
				required
			/>
			<small id="trim-desc">Margin removed from board edges.</small>
		</div>

		<div class="input-group">
			<label for="param-min-scrap-w">Min Scrap W ({$displaySettings.units}):</label>
			<input
				type="number"
				id="param-min-scrap-w"
				aria-describedby="min-scrap-w-desc"
				value={$displaySettings.minScrapWidth}
				on:input={(e) => handleDimensionInput(e, 'minScrapWidthMm')}
				step="any"
				min="0"
				required
			/>
			<small id="min-scrap-w-desc">Min width of leftover to save.</small>
		</div>

		<div class="input-group">
			<label for="param-min-scrap-l">Min Scrap L ({$displaySettings.units}):</label>
			<input
				type="number"
				id="param-min-scrap-l"
				aria-describedby="min-scrap-l-desc"
				value={$displaySettings.minScrapLength}
				on:input={(e) => handleDimensionInput(e, 'minScrapLengthMm')}
				step="any"
				min="0"
				required
			/>
			<small id="min-scrap-l-desc">Min length of leftover to save.</small>
		</div>

		<div class="input-group checkbox-group full-span">
			<label for="param-grain">
				<input
					type="checkbox"
					id="param-grain"
					checked={$displaySettings.respectGrain}
					on:change={handleRespectGrainChange}
				/>
				Respect Grain Direction
			</label>
			<span class="description"
				>Enforce piece grain orientation constraints during optimization.</span
			>
		</div>

		<div class="input-group">
			<label for="param-algo">Optimize For:</label>
			<select
				id="param-algo"
				value={$displaySettings.optimizationAlgo}
				on:change={handleAlgoChange}
				title="Choose the primary goal for the optimizer"
			>
				<option value="waste">Minimum Waste</option>
				<option value="cuts">Fewest Cuts (Simpler Layout)</option>
				<option value="priority">Piece Priority</option>
			</select>
		</div>
	</div>

	<div class="actions">
		<button
			class="reset-button"
			type="button"
			on:click={() => settingsStore.resetSettings()}
			title="Reset all parameters to their default values"
		>
			Reset Parameters
		</button>
	</div>
</div>

<style>
	/* Using .card styles assumed to be globally available or defined in this component */
	.card {
		border: 1px solid #e0e0e0;
		border-radius: 6px;
		padding: 1.5rem 2rem;
		background-color: #ffffff;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
		margin-bottom: 2rem;
	}
	.card h3 {
		margin-top: 0;
		margin-bottom: 1.5rem;
		color: #333;
		font-size: 1.3rem;
		border-bottom: 1px solid #eee;
		padding-bottom: 0.8rem;
	}

	.form-grid {
		display: grid;
		/* Adjust min width for potentially wider content */
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1.2rem 1.8rem;
		margin-bottom: 1.5rem;
	}

	.input-group {
		display: flex;
		flex-direction: column;
	}
	.input-group label {
		margin-bottom: 0.4rem;
		font-weight: 500;
		color: #555;
		font-size: 0.9rem;
	}
	/* Common input styles */
	/* .input-group input[type='text'], */
	.input-group input[type='number'],
	.input-group select {
		padding: 0.7rem 0.8rem;
		border: 1px solid #ccc;
		border-radius: 4px;
		font-size: 0.95rem;
		background-color: #fdfdfd;
		transition:
			border-color 0.2s ease,
			box-shadow 0.2s ease;
		width: 100%;
		box-sizing: border-box;
	}
	.input-group input:focus,
	.input-group select:focus {
		border-color: #007bff;
		box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
		outline: none;
	}
	/* Remove number input spinners */
	.input-group input[type='number'] {
		-moz-appearance: textfield;
		appearance: textfield;
	}
	.input-group input[type='number']::-webkit-outer-spin-button,
	.input-group input[type='number']::-webkit-inner-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}

	/* Specific styling for checkbox group */
	.checkbox-group {
		/* Allow this group to potentially span columns if needed, adjust grid column span if necessary */
		padding-top: 0.5rem; /* Align better with text inputs */
	}
	.checkbox-group.full-span {
		grid-column: 1 / -1; /* Make checkbox span all columns */
		margin-top: 0.5rem; /* Add some space above */
	}
	.checkbox-group label {
		display: flex;
		align-items: center;
		gap: 0.6rem; /* Increased gap */
		cursor: pointer;
		font-weight: 500;
		color: #555;
		font-size: 0.95rem;
		margin-bottom: 0.3rem; /* Space before description */
	}
	.checkbox-group input[type='checkbox'] {
		width: 18px; /* Slightly larger checkbox */
		height: 18px;
		cursor: pointer;
		accent-color: #007bff;
		margin-top: -2px; /* Fine-tune vertical alignment */
	}
	.checkbox-group .description {
		font-size: 0.8rem;
		color: #777;
		/* Indent description to align with text part of label */
		padding-left: calc(18px + 0.6rem);
		margin-top: -2px; /* Adjust spacing */
	}

	/* Description text for inputs */
	.input-group small {
		font-size: 0.8rem;
		color: #777;
		margin-top: 0.3rem;
	}

	.actions {
		display: flex;
		justify-content: flex-end; /* Align button right */
		margin-top: 1.5rem; /* More space above button */
	}
	.reset-button {
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
	.reset-button:hover {
		background-color: #5a6268;
	}
</style>
