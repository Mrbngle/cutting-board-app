<script lang="ts">
	// Stores & Components
	import { boardStore } from '$lib/stores/boardStore';
	import { piecesStore } from '$lib/stores/piecesStore';
	import { settingsStore } from '$lib/stores/settingsStore';
	import BoardSetup from '$lib/components/BoardSetup.svelte';
	import PieceList from '$lib/components/PieceList.svelte';
	import CutParameters from '$lib/components/CutParameters.svelte';
	import LayoutViewer2D from '$lib/components/LayoutViewer2D.svelte'; // <-- Import the new component
	import LayoutViewer3D from '$lib/components/LayoutViewer3D.svelte'; // <-- Import the new 3D component

	// Optimizer
	import { calculateLayout, type OptimizerInput, type LayoutResult } from '$lib/utils/optimizer';
	import { get } from 'svelte/store';

	// --- Component State ---
	let layoutResult: LayoutResult | null = null;
	let isLoading: boolean = false;
	let errorMessage: string | null = null;
	let currentView: '2D' | '3D' = '2D'; // State to toggle between views

	// Ref for hidden project file input
	let projectFileInputRef: HTMLInputElement;

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

	/** Exports the current state of all stores to a JSON file. */
	function exportProject() {
		try {
			// 1. Gather the current state from all stores
			const projectData = {
				board: get(boardStore),
				pieces: get(piecesStore),
				settings: get(settingsStore),
				// Add metadata for future compatibility
				meta: {
					version: '1.0.0',
					exportedAt: new Date().toISOString()
				}
			};

			// 2. Convert to a JSON string
			const jsonString = JSON.stringify(projectData, null, 2); // Pretty-print with 2 spaces

			// 3. Create a blob and trigger download
			const blob = new Blob([jsonString], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;
			link.download = `plywood-project-${Date.now()}.json`;
			document.body.appendChild(link);
			link.click();

			// 4. Clean up
			document.body.removeChild(link);
			URL.revokeObjectURL(url);
		} catch (error) {
			console.error('Failed to export project:', error);
			alert('An error occurred while exporting the project.');
		}
	}

	/** Programmatically clicks the hidden file input for project import. */
	function triggerProjectImport() {
		projectFileInputRef && projectFileInputRef?.click();
	}

	/** Handles the file selection for project import. */
	function handleProjectFileSelect(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];

		if (!file) return;

		const reader = new FileReader();
		reader.onload = (e) => {
			try {
				const text = e.target?.result as string;
				const parsedData = JSON.parse(text);

				// **Crucial Validation Step**
				if (parsedData && parsedData.board && parsedData.pieces && parsedData.settings) {
					// Load the data into the stores
					boardStore.set(parsedData.board);
					piecesStore.set(parsedData.pieces);
					settingsStore.set(parsedData.settings);

					// Clear any previous results
					layoutResult = null;
					alert('Project loaded successfully!');
				} else {
					throw new Error('Invalid project file format.');
				}
			} catch (error) {
				console.error('Failed to import project:', error);
				alert(
					`Failed to import project file. Please ensure it's a valid project file. Error: ${error instanceof Error ? error.message : 'Unknown'}`
				);
			} finally {
				// Reset the input so the same file can be loaded again
				target.value = '';
			}
		};
		reader.readAsText(file);
	}
</script>

<div class="page-content">
	<section class="project-management card">
		<h2 class="project-title">Project Management</h2>
		<div class="project-buttons">
			<button class="project-btn import" on:click={triggerProjectImport}>Import Project</button>
			<button class="project-btn export" on:click={exportProject}>Export Project</button>
			<input
				type="file"
				accept=".json, application/json"
				bind:this={projectFileInputRef}
				on:change={handleProjectFileSelect}
				style="display: none;"
			/>
		</div>
	</section>

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
								Estimated Waste: <strong>{layoutResult.wastePercentage.toFixed(1)}%</strong>
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
									Could not place <strong>{layoutResult.unplacedPieces.length}</strong> original piece
									type(s):
								</p>
								<ul>
									{#each layoutResult.unplacedPieces as piece (piece.id)}
										<li>
											{piece.name || piece.id} ({piece.widthMm.toFixed(0)}x{piece.lengthMm.toFixed(
												0
											)}mm)
										</li>
									{/each}
								</ul>
							</div>
						{:else if layoutResult.placedPieces.length > 0}
							<p style="color: green; font-weight: bold;">All requested pieces placed!</p>
						{/if}
					{/if}
				</div>

				<div class="visualization-area">
					{#if layoutResult.placedPieces.length > 0 || layoutResult.usableScrap.length > 0}
						<div class="view-toggle">
							<button on:click={() => (currentView = '2D')} class:active={currentView === '2D'}>
								2D View
							</button>
							<button on:click={() => (currentView = '3D')} class:active={currentView === '3D'}>
								3D View
							</button>
						</div>

						{#if currentView === '2D'}
							<div class="viewer-container">
								<LayoutViewer2D {layoutResult} />
							</div>
						{:else if currentView === '3D'}
							{#key JSON.stringify(layoutResult.placedPieces)}
								<div class="viewer-container">
									<LayoutViewer3D {layoutResult} />
								</div>
							{/key}
						{/if}
					{:else if !(layoutResult.errors && layoutResult.errors.length > 0)}
						<p class="no-visualization">No layout to display (no pieces placed).</p>
					{/if}
				</div>
			</div>
		{/if}
	</section>
</div>

<style lang="scss" src="./+page.scss"></style>
