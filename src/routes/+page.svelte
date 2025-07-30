<script lang="ts">
	// Stores & Components
	import { boardStore } from '$lib/stores/boardStore';
	import { piecesStore } from '$lib/stores/piecesStore';
	import { settingsStore } from '$lib/stores/settingsStore';
	import BoardSetup from '$lib/components/BoardSetup.svelte';
	import PieceList from '$lib/components/PieceList.svelte';
	import CutParameters from '$lib/components/CutParameters.svelte';
	import LayoutViewer2D from '$lib/components/LayoutViewer2D.svelte'; // <-- Import the new component

	// Optimizer
	import { calculateLayout, type OptimizerInput, type LayoutResult } from '$lib/utils/optimizer';
	import { get } from 'svelte/store';

	// State for results and loading
	let layoutResult: LayoutResult | null = null;
	let isLoading: boolean = false;
	let errorMessage: string | null = null;

	// runOptimization function remains the same
	async function runOptimization() {
		console.log('Run Optimization clicked...');
		isLoading = true;
		layoutResult = null;
		errorMessage = null;
		await new Promise((resolve) => setTimeout(resolve, 20)); // Allow UI update
		try {
			const currentBoard = get(boardStore);
			const currentPieces = get(piecesStore);
			const currentSettings = get(settingsStore);
			const optimizerInput: OptimizerInput = {
				board: { widthMm: currentBoard.widthMm, lengthMm: currentBoard.lengthMm },
				pieces: currentPieces.map((p) => ({ ...p })),
				settings: { ...currentSettings }
			};
			const result = calculateLayout(optimizerInput); // Sync calculation
			layoutResult = result;
			console.log('Optimization result:', layoutResult);
		} catch (error) {
			console.error('Error during optimization process:', error);
			errorMessage = `An unexpected error occurred: ${error instanceof Error ? error.message : String(error)}`;
			layoutResult = null;
		} finally {
			isLoading = false;
		}
	}
</script>

<div class="page-content">
	<section class="config-section" aria-labelledby="section1-heading">
		<h2 id="section1-heading">1. Configure Your Stock Board</h2>
		<p>Define the dimensions and units for the board material.</p>
		<BoardSetup />
	</section>

	<hr class="section-divider" />

	<section class="config-section" aria-labelledby="section2-heading">
		<h2 id="section2-heading">2. Define Pieces to Cut</h2>
		<p>Add each required piece below.</p>
		<PieceList />
	</section>

	<hr class="section-divider" />

	<section class="config-section" aria-labelledby="section3-heading">
		<h2 id="section3-heading">3. Set Cutting Parameters</h2>
		<p>Specify saw kerf, margins, and other settings.</p>
		<CutParameters />
	</section>

	<hr class="section-divider" />

	<section class="results-section" aria-labelledby="section4-heading">
		<h2 id="section4-heading">4. Optimize & View Results</h2>

		<div class="run-controls">
			<button class="run-button" on:click={runOptimization} disabled={isLoading}>
				{#if isLoading}
					<span class="spinner"></span> Calculating...
				{:else}
					Run Cutting Optimization
				{/if}
			</button>
		</div>

		{#if isLoading}
			<div class="loading-indicator">
				<span class="spinner large"></span> Optimizing layout...
			</div>
		{/if}

		{#if errorMessage && !isLoading}
			<div class="error-message"><strong>Error:</strong> {errorMessage}</div>
		{/if}

		{#if layoutResult && !isLoading}
			<div class="results-container">
				<div class="results-summary card">
					<h3>Optimization Summary</h3>
					{#if layoutResult.errors && layoutResult.errors.length > 0}
						<div class="result-errors">
							<h4>Errors:</h4>
							<ul>
								{#each layoutResult.errors as error}
									<li>{error}</li>
								{/each}
							</ul>
						</div>
					{/if}
					{#if layoutResult.warnings && layoutResult.warnings.length > 0}
						<div class="result-warnings">
							<h4>Warnings:</h4>
							<ul>
								{#each layoutResult.warnings as warning}
									<li>{warning}</li>
								{/each}
							</ul>
						</div>
					{/if}
					{#if !(layoutResult.errors && layoutResult.errors.length > 0)}
						<div class="result-stats">
							<p>Boards Required: <strong>{layoutResult.boardsUsed}</strong></p>
							<p>
								Estimated Waste: <strong
									>{layoutResult.wastePercentage.toFixed(1)}%</strong
								>
							</p>
							<p>
								Calculation Time: <strong
									>{layoutResult.processingTimeMs?.toFixed(0) ?? 'N/A'} ms</strong
								>
							</p>
						</div>
						{#if layoutResult.unplacedPieces.length > 0}
							<div class="unplaced-info result-warnings">
								<h4>Unplaced Pieces:</h4>
								<p>
									Could not place <strong
										>{layoutResult.unplacedPieces.length}</strong
									> original piece type(s):
								</p>
								<ul>
									{#each layoutResult.unplacedPieces as piece (piece.id)}
										<li>
											{piece.name || piece.id} ({piece.widthMm.toFixed(
												0
											)}x{piece.lengthMm.toFixed(0)}mm)
										</li>
									{/each}
								</ul>
							</div>
						{:else if layoutResult.placedPieces.length > 0}
							<p style="color: green; font-weight: bold;">
								All requested pieces placed!
							</p>
						{/if}
					{/if}
				</div>

				<div class="visualization-area">
					{#if layoutResult.placedPieces.length > 0 || layoutResult.usableScrap.length > 0}
						<LayoutViewer2D {layoutResult} />
					{:else if !(layoutResult.errors && layoutResult.errors.length > 0)}
						<p class="no-visualization">No layout to display (no pieces placed).</p>
					{/if}
				</div>
			</div>
		{/if} 
	</section>
</div>

<style>
	/* --- Paste ALL Previous Styles Here --- */
	/* .page-content, .config-section, h2, p, :global(...), .section-divider, etc. */
	/* .run-controls, .run-button, .spinner, .loading-indicator, .error-message */
	/* .results-summary, .card, h3, .result-stats, .result-errors, .result-warnings, .unplaced-info */
	/* --- Including these: --- */
	.page-content {
		max-width: 960px;
		margin: 1.5rem auto 4rem auto;
		padding: 0 1rem;
	}
	.config-section {
		margin-bottom: 2.5rem;
		text-align: center;
	}
	.config-section h2 {
		font-size: 1.7rem;
		margin-bottom: 0.75rem;
		color: #333;
		font-weight: 600;
	}
	.config-section p {
		font-size: 1rem;
		color: #555;
		max-width: 650px;
		margin: 0 auto 2rem auto;
		line-height: 1.6;
	}
	:global(.board-setup-card),
	:global(.piece-manager),
	:global(.cut-parameters-card) {
		margin-left: auto;
		margin-right: auto;
	}
	:global(.piece-manager > .card) {
		margin-left: auto;
		margin-right: auto;
	}
	.section-divider {
		border: none;
		border-top: 1px solid #e5e5e5;
		margin: 3.5rem auto;
		width: 75%;
	}
	.results-section h2 {
		font-size: 1.7rem;
		margin-bottom: 1.5rem;
		color: #333;
		font-weight: 600;
		text-align: center;
	}
	.run-controls {
		display: flex;
		justify-content: center;
		margin-bottom: 2rem;
	}
	.run-button {
		padding: 0.8rem 2rem;
		font-size: 1.1rem;
		font-weight: 600;
		cursor: pointer;
		background-color: #007bff;
		color: white;
		border: none;
		border-radius: 5px;
		transition:
			background-color 0.2s ease,
			opacity 0.2s ease;
		display: inline-flex;
		align-items: center;
		gap: 0.6rem;
	}
	.run-button:hover:not(:disabled) {
		background-color: #0056b3;
	}
	.run-button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
	.spinner {
		border: 3px solid rgba(255, 255, 255, 0.3);
		border-radius: 50%;
		border-top-color: #fff;
		width: 16px;
		height: 16px;
		animation: spin 1s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	.loading-indicator {
		text-align: center;
		padding: 2rem 1rem;
		font-size: 1.1rem;
		font-style: italic;
		color: #555;
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 0.8rem;
	}
	.spinner.large {
		width: 24px;
		height: 24px;
		border-top-color: #007bff;
		border-right-color: transparent;
		border-bottom-color: transparent;
		border-left-color: transparent;
	}
	.error-message {
		background-color: #f8d7da;
		color: #721c24;
		border: 1px solid #f5c6cb;
		padding: 1rem;
		border-radius: 4px;
		margin: 1.5rem auto;
		max-width: 700px;
		text-align: center;
	}
	.results-summary {
		border: 1px solid #e0e0e0;
		border-radius: 6px;
		padding: 1.5rem 2rem;
		background-color: #ffffff;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
		margin-top: 2rem;
		max-width: 700px;
		margin-left: auto;
		margin-right: auto;
	}
	.results-summary h3 {
		margin-top: 0;
		margin-bottom: 1.5rem;
		color: #333;
		font-size: 1.3rem;
		border-bottom: 1px solid #eee;
		padding-bottom: 0.8rem;
		text-align: center;
	}
	.results-summary p {
		margin: 0.5rem 0;
		font-size: 1rem;
		color: #333;
	}
	.results-summary .result-stats p {
		margin: 0.8rem 0;
	}
	.results-summary strong {
		color: #0056b3;
	}
	.result-errors,
	.result-warnings {
		margin: 1.5rem 0;
		padding: 0.8rem 1.2rem;
		border-radius: 4px;
	}
	.result-errors {
		background-color: #f8d7da;
		color: #721c24;
		border: 1px solid #f5c6cb;
	}
	.result-warnings {
		background-color: #fff3cd;
		color: #856404;
		border: 1px solid #ffeeba;
	}
	.result-errors h4,
	.result-warnings h4 {
		margin-top: 0;
		margin-bottom: 0.5rem;
		font-size: 1rem;
		font-weight: bold;
	}
	.result-errors ul,
	.result-warnings ul {
		margin-bottom: 0;
		padding-left: 20px;
		font-size: 0.9rem;
	}
	.unplaced-info {
		margin-top: 1.5rem;
	}
	.unplaced-info ul {
		margin-top: 0.5rem;
	}
	.unplaced-info li {
		font-size: 0.9rem;
	}

	/* --- New Styles for Results Layout --- */
	.results-container {
		margin-top: 2rem;
	}
	.visualization-area {
		margin-top: 2rem;
		width: 100%;
	}
	.no-visualization {
		text-align: center;
		font-style: italic;
		color: #666;
		margin-top: 1.5rem;
		padding: 1rem;
		background-color: #f8f9fa;
		border-radius: 4px;
	}
</style>
