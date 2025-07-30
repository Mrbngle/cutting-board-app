<script lang="ts">
	// Stores
	import { boardStore } from '$lib/stores/boardStore';
	import { piecesStore, type CutPiece } from '$lib/stores/piecesStore';
	import { get } from 'svelte/store'; // Import get to read boardStore units for context

	import pkg from 'papaparse';
	const { parse } = pkg;

	// Local state for the 'Add Piece' form inputs
	let nameInput: string = '';
	let widthInput: string = ''; // Keep as string for flexible input
	let lengthInput: string = ''; // Keep as string
	let quantityInput: number = 1;
	let priorityInput: number = 5; // Default priority
	let grainInput: CutPiece['grainDirection'] = 'none';

	// State for CSV import feedback
	let importStatusMessage: string | null = null;
	// Reference to the hidden file input element, used to trigger click and reset
	let fileInputRef: HTMLInputElement;

	// Add Piece Manually Logic (Keep existing function)
	function handleAddPiece(): void {
		const pieceData = {
			name: nameInput.trim(),
			width: widthInput, // Pass string to let store handle parsing/conversion
			length: lengthInput,
			quantity: quantityInput,
			priority: priorityInput,
			grainDirection: grainInput
		};
		const success = piecesStore.addPiece(pieceData);
		if (success) {
			// Reset form on successful addition
			nameInput = '';
			widthInput = '';
			lengthInput = '';
			quantityInput = 1;
			priorityInput = 5;
			grainInput = 'none';
			importStatusMessage = 'Piece added manually.'; // Feedback
			setTimeout(() => (importStatusMessage = null), 2000); // Clear feedback after 2s
		} else {
			// piecesStore.addPiece likely alerted the user already, or log errors there
			importStatusMessage = 'Failed to add piece manually. Check inputs/console.';
			setTimeout(() => (importStatusMessage = null), 4000);
		}
	}

	/** Programmatically clicks the hidden file input */
	function triggerFileInput(): void {
		importStatusMessage = null; // Clear previous messages before opening dialog
		fileInputRef?.click(); // Use optional chaining just in case
	}

	/** Handles the file selection event from the hidden input */
	function handleFileSelect(event: Event): void {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];

		if (!file) {
			return;
		} // No file selected or dialog cancelled

		importStatusMessage = 'Reading file...';

		// Basic file type check (less reliable than server-side)
		if (
			!file.name.toLowerCase().endsWith('.csv') &&
			file.type !== 'text/csv' &&
			file.type !== 'application/vnd.ms-excel'
		) {
			importStatusMessage = 'Invalid file type. Please select a CSV file (.csv).';
			setTimeout(() => (importStatusMessage = null), 4000);
			target.value = ''; // Reset file input
			return;
		}

		const reader = new FileReader();

		reader.onload = (e) => {
			const csvString = e.target?.result as string;
			if (typeof csvString !== 'string') {
				importStatusMessage = 'Error: Could not read file content.';
				setTimeout(() => (importStatusMessage = null), 4000);
				return;
			}

			importStatusMessage = 'Processing CSV...';

			try {
				const result = parse(csvString, {
					header: false,
					skipEmptyLines: true
				}).data as string[][];

				if (!result || result.length < 1) {
					// Need at least a header row
					importStatusMessage = 'CSV parsing error: File appears empty or has no header row.';
					setTimeout(() => (importStatusMessage = null), 5000);
					return;
				}

				// Extract and normalize headers (first row)
				const headers = result[0].map((h) => h.trim().toLowerCase());
				const dataRows = result.slice(1); // Get actual data rows

				// Validate required headers exist
				const requiredHeaders = ['width', 'length'];
				if (!requiredHeaders.every((h) => headers.includes(h))) {
					importStatusMessage = `CSV Import Failed: Required columns 'Width' and 'Length' not found. Found headers: ${headers.join(', ')}`;
					setTimeout(() => (importStatusMessage = null), 6000);
					return;
				}

				let successCount = 0;
				let failCount = 0;
				if (dataRows.length === 0) {
					importStatusMessage = 'CSV has headers but no data rows found.';
					setTimeout(() => (importStatusMessage = null), 4000);
					return;
				}
				importStatusMessage = `Processing ${dataRows.length} data rows...`;

				// Process data rows
				dataRows.forEach((dataRow, index) => {
					// Skip rows that might be completely empty after trimming
					if (dataRow.every((field) => !field || field.trim() === '')) {
						failCount++; // Count potentially empty lines skipped after header
						console.warn(
							`CSV Import: Skipping empty or whitespace-only data row ${index + 1} (CSV row ${index + 2}).`
						);
						return;
					}

					// Create an object from the row using headers
					const rowObj: { [key: string]: string | undefined } = {}; // Allow undefined for missing columns
					headers.forEach((header, colIndex) => {
						// Map header to the corresponding cell value, handle potentially short rows
						rowObj[header] = colIndex < dataRow.length ? dataRow[colIndex]?.trim() : undefined;
					});

					// Basic validation of required width/length before passing to store
					const rowWidth = rowObj.width;
					const rowLength = rowObj.length;
					if (
						rowWidth &&
						rowLength &&
						!isNaN(parseFloat(rowWidth)) &&
						!isNaN(parseFloat(rowLength))
					) {
						// Prepare data for the store's addPiece method
						const pieceData = {
							width: rowWidth,
							length: rowLength,
							name: rowObj.name,
							quantity: rowObj.quantity ? parseInt(rowObj.quantity) : undefined,
							priority: rowObj.priority ? parseInt(rowObj.priority) : undefined,
							grainDirection: ['length', 'width', 'none'].includes(
								rowObj.grain?.toLowerCase() ?? ''
							)
								? (rowObj.grain?.toLowerCase() as CutPiece['grainDirection'])
								: undefined
						};

						// Attempt to add the piece via the store (handles unit conversion, full validation)
						if (piecesStore.addPiece(pieceData)) {
							successCount++;
						} else {
							console.warn(
								`CSV Import: Store rejected piece from data row ${index + 1} (CSV row ${index + 2}). Data:`,
								rowObj
							);
							failCount++;
						}
					} else {
						console.warn(
							`CSV Import: Skipping invalid data row ${index + 1} (CSV row ${index + 2}). Missing/invalid Width or Length. Data:`,
							rowObj
						);
						failCount++;
					}
				});

				// Provide final feedback
				let feedback = `Import complete: Added ${successCount} pieces.`;
				if (failCount > 0) {
					feedback += ` Skipped ${failCount} invalid or rejected rows (check console log for details).`;
				}
				importStatusMessage = feedback;
				// Keep message displayed for a while
				setTimeout(() => (importStatusMessage = null), 8000);
			} catch (processError) {
				console.error('Error processing CSV with std/csv:', processError);
				importStatusMessage = `Error processing CSV file: ${processError instanceof Error ? processError.message : 'Unknown processing error'}. Check file format and console.`;
				setTimeout(() => (importStatusMessage = null), 6000);
			}
		};

		reader.onerror = (e) => {
			console.error('FileReader error:', reader.error);
			importStatusMessage = 'Error reading the selected file.';
			setTimeout(() => (importStatusMessage = null), 4000);
		};

		reader.readAsText(file); // Start reading the file

		// Reset the input value: Allows selecting the same file again immediately
		// Important to do this *after* initiating the read, not inside onload
		target.value = '';
	}

	// Keep dimension formatting helper
	function formatDimensionForDisplay(valueMm: number, units: 'mm' | 'inches'): string {
		// Ensure valueMm is a number before formatting
		const numValueMm = Number(valueMm);
		if (isNaN(numValueMm)) return 'NaN'; // Or some other indicator

		const decimals = units === 'inches' ? 3 : 1;
		const factor = Math.pow(10, decimals);
		const convertedValue = units === 'inches' ? numValueMm / 25.4 : numValueMm;
		// Use Number.EPSILON for slightly more robust rounding of floats
		return (Math.round((convertedValue + Number.EPSILON) * factor) / factor).toFixed(decimals);
	}
</script>

<div class="piece-manager">
	<div class="add-piece-form card">
		<h3>Add New Piece</h3>
		<form on:submit|preventDefault={handleAddPiece} class="piece-entry-form">
			<div class="form-grid">
				<div class="input-group">
					<label for="piece-name">Name:</label>
					<input type="text" id="piece-name" bind:value={nameInput} placeholder="Optional label" />
				</div>
				<div class="input-group">
					<label for="piece-width">Width ({$boardStore.units}):</label>
					<input
						type="number"
						id="piece-width"
						bind:value={widthInput}
						step="any"
						min="0"
						required
						placeholder="e.g., 100"
					/>
				</div>
				<div class="input-group">
					<label for="piece-length">Length ({$boardStore.units}):</label>
					<input
						type="number"
						id="piece-length"
						bind:value={lengthInput}
						step="any"
						min="0"
						required
						placeholder="e.g., 250"
					/>
				</div>
				<div class="input-group">
					<label for="piece-quantity">Quantity:</label>
					<input
						type="number"
						id="piece-quantity"
						bind:value={quantityInput}
						step="1"
						min="1"
						required
					/>
				</div>
				<div class="input-group">
					<label for="piece-priority">Priority:</label>
					<select id="piece-priority" bind:value={priorityInput}
						><option value={1}>1 (Highest)</option><option value={2}>2</option><option value={3}
							>3</option
						><option value={4}>4</option><option value={5}>5 (Lowest)</option></select
					>
				</div>
				<div class="input-group">
					<label for="piece-grain">Grain:</label>
					<select id="piece-grain" bind:value={grainInput}
						><option value="none">None</option><option value="length">Along Length</option><option
							value="width">Along Width</option
						></select
					>
				</div>
			</div>
			<button type="submit" class="add-button">Add Piece</button>
		</form>

		<div class="import-controls">
			<button type="button" class="import-button" on:click={triggerFileInput}
				>Import Pieces from CSV</button
			>
			<input
				type="file"
				id="csv-file-input"
				accept=".csv, text/csv, application/vnd.ms-excel"
				bind:this={fileInputRef}
				on:change={handleFileSelect}
				style="display: none;"
			/>
		</div>
		{#if importStatusMessage}
			<div class="import-status">{importStatusMessage}</div>
		{/if}
	</div>
	<div class="piece-list card">
		<h3>Required Pieces List</h3>
		{#if $piecesStore.length === 0}
			<p class="empty-message">No pieces added yet. Add pieces manually or import from CSV.</p>
		{:else}
			<div class="table-container">
				<table>
					<thead>
						<tr>
							<th>Name</th>
							<th>Width ({$boardStore.units})</th>
							<th>Length ({$boardStore.units})</th>
							<th>Qty</th>
							<th>Priority</th>
							<th>Grain</th>
							<th>Actions</th>
						</tr>
					</thead>
					<tbody>
						{#each $piecesStore as piece (piece.id)}
							<tr>
								<td>{piece.name}</td>
								<td class="dimension"
									>{formatDimensionForDisplay(piece.widthMm, $boardStore.units)}</td
								>
								<td class="dimension"
									>{formatDimensionForDisplay(piece.lengthMm, $boardStore.units)}</td
								>
								<td class="quantity">{piece.quantity}</td>
								<td class="priority">{piece.priority}</td>
								<td class="grain">{piece.grainDirection}</td>
								<td class="actions">
									<button
										class="remove-button"
										title="Remove this piece"
										on:click={() => piecesStore.removePiece(piece.id)}
									>
										&times;
									</button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<div class="list-summary">
				<span>Total unique piece types: {$piecesStore.length}</span>
				<button
					class="clear-button"
					on:click={() => piecesStore.clearPieces()}
					title="Remove all pieces from the list"
				>
					Clear All Pieces
				</button>
			</div>
		{/if}
	</div>
</div>

<style lang="scss" src="./PieceList.scss"></style>
