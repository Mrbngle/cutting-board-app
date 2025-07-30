<script lang="ts">
	// Import types from the optimizer output definitions
	import type { LayoutResult, PlacedPiece, UsableScrap, Rectangle } from '$lib/utils/optimizer'; // Adjust path if needed

	// Input prop: the result object from calculateLayout()
	export let layoutResult: LayoutResult | null = null;

	// --- Helper Function for Consistent Piece Colors ---
	// Uses a simple hashing approach to assign a color from a predefined palette
	// based on the piece ID or name, helping to visually group identical pieces.
	function getPieceColor(idOrName: string): string {
		// Example palette (ColorBrewer Set3 / Paired - expanded) - feel free to customize
		const colors = [
			'#a6cee3',
			'#1f78b4',
			'#b2df8a',
			'#33a02c',
			'#fb9a99',
			'#e31a1c',
			'#fdbf6f',
			'#ff7f00',
			'#cab2d6',
			'#6a3d9a',
			'#ffff99',
			'#b15928',
			'#8dd3c7',
			'#ffffb3',
			'#bebada',
			'#fb8072',
			'#80b1d3',
			'#fdb462',
			'#b3de69',
			'#fccde5',
			'#d9d9d9',
			'#bc80bd',
			'#ccebc5',
			'#ffed6f'
		];
		let hash = 0;
		if (!idOrName || idOrName.length === 0) return colors[0]; // Default color for empty ID/Name
		for (let i = 0; i < idOrName.length; i++) {
			const char = idOrName.charCodeAt(i);
			hash = (hash << 5) - hash + char;
			hash |= 0; // Convert to 32bit integer
		}
		const index = Math.abs(hash) % colors.length;
		return colors[index];
	}

	// --- Helper for formatting dimension text inside rectangles ---
	function formatDimensionText(width: number, length: number): string {
		// Basic format, rounds to nearest whole number for display in text
		return `${width.toFixed(0)}x${length.toFixed(0)}`;
	}

	// Reactive statements to easily access board dimensions when layoutResult is available
	$: boardW = layoutResult?.boardDimensions.widthMm ?? 0;
	$: boardL = layoutResult?.boardDimensions.lengthMm ?? 0;
</script>

<div class="layout-viewer-2d">
	{#if layoutResult && layoutResult.boardsUsed > 0 && layoutResult.placedPieces.length > 0}
		{#each { length: layoutResult.boardsUsed } as _, i (i)}
			<div class="board-layout card">
				<h3>Layout for Board {i + 1} of {layoutResult.boardsUsed}</h3>
				<svg
					class="layout-svg"
					viewBox="0 0 {boardW} {boardL}"
					preserveAspectRatio="xMidYMid meet"
					xmlns="http://www.w3.org/2000/svg"
					role="img"
					aria-labelledby="board-title-{i + 1}"
				>
					<title id="board-title-{i + 1}">Cutting Layout Board {i + 1}</title>

					<rect class="board-rect" x="0" y="0" width={boardW} height={boardL} />

					{#each layoutResult.placedPieces.filter((p) => p.boardIndex === i) as piece (piece.id + '-' + piece.x + '-' + piece.y)}
						{@const pieceColor = getPieceColor(piece.name || piece.id)}
						{@const minDim = Math.min(piece.placedWidthMm, piece.placedLengthMm)}
						<!-- {#comment} Adjust font size based on smaller dimension of the piece  -->
						{@const fontSize = Math.max(6, Math.min(14, minDim / 6))}

						<g class="placed-piece-group">
							<!-- {#comment} Tooltip shows details on hover `` -->
							<title
								>{piece.name} ({piece.placedWidthMm.toFixed(0)} x {piece.placedLengthMm.toFixed(
									0
								)}) at ({piece.x.toFixed(0)}, {piece.y.toFixed(0)}) {piece.isRotated
									? '(R)'
									: ''}</title
							>
							<rect
								class="placed-piece"
								x={piece.x}
								y={piece.y}
								width={piece.placedWidthMm}
								height={piece.placedLengthMm}
								fill={pieceColor}
								stroke-width={Math.max(0.2, Math.min(1, 20 / minDim))}
							/>
							<!-- {#comment} Add text label only if piece is large enough `` -->
							{#if minDim > 40}
								<text
									class="piece-label"
									x={piece.x + piece.placedWidthMm / 2}
									y={piece.y + piece.placedLengthMm / 2}
									font-size="{fontSize}px"
								>
									{piece.name || 'Piece'}
								</text>
								{#if minDim > 60}
									`` Show dims only on even larger pieces ``
									<text
										class="piece-dims"
										x={piece.x + piece.placedWidthMm / 2}
										y={piece.y + piece.placedLengthMm / 2 + fontSize * 1.1}
										font-size="{fontSize * 0.8}px"
									>
										({formatDimensionText(
											piece.placedWidthMm,
											piece.placedLengthMm
										)})
									</text>
								{/if}
							{/if}
						</g>
					{/each}

					{#each layoutResult.usableScrap.filter((s) => s.boardIndex === i) as scrap (scrap.x + '-' + scrap.y)}
						{@const minScrapDim = Math.min(scrap.width, scrap.length)}
						{@const scrapFontSize = Math.max(5, Math.min(10, minScrapDim / 7))}
						<g class="scrap-piece-group">
							<title
								>Usable Scrap ({scrap.width.toFixed(0)} x {scrap.length.toFixed(0)} mm)</title
							>
							<rect
								class="scrap-piece"
								x={scrap.x}
								y={scrap.y}
								width={scrap.width}
								height={scrap.length}
							/>
							{#if minScrapDim > 50}
								`` Show dims only on larger scrap ``
								<text
									class="scrap-label"
									x={scrap.x + scrap.width / 2}
									y={scrap.y + scrap.length / 2}
									font-size="{scrapFontSize}px"
								>
									{formatDimensionText(scrap.width, scrap.length)}
								</text>
							{/if}
						</g>
					{/each}
				</svg>
			</div>
		{/each}
	{:else if layoutResult}
		<!-- {#comment} Handle case where optimizer ran but placed nothing `` -->
		<div class="no-results card">
			<p>Could not place any pieces with the current input and settings.</p>
			{#if layoutResult.unplacedPieces.length > 0}
				<p>({layoutResult.unplacedPieces.length} piece type(s) were requested).</p>
			{/if}
			{#if layoutResult.warnings && layoutResult.warnings.length > 0}
				<h4>Warnings:</h4>
				<ul>
					{#each layoutResult.warnings as warning}
						<li>{warning}</li>
					{/each}
				</ul>
			{/if}
		</div>
	{/if}
</div>

<style>
	.layout-viewer-2d {
		margin-top: 1.5rem;
		width: 100%;
	}
	.board-layout {
		margin-bottom: 2rem;
	}
	/* Inherit .card style */
	.card {
		border: 1px solid #e0e0e0;
		border-radius: 6px;
		padding: 1rem 1.5rem;
		background-color: #ffffff;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
	}
	.board-layout h3 {
		margin-top: 0;
		margin-bottom: 1rem;
		text-align: center;
		color: #333;
		font-size: 1.1rem;
		font-weight: 600;
	}

	.layout-svg {
		display: block;
		width: 100%;
		/* Control max display size for usability */
		max-width: 900px;
		max-height: 600px; /* Limit height as well */
		height: auto; /* Maintain aspect ratio */
		margin: 0 auto;
		border: 1px solid #aaa;
		background-color: #fdfdfd;
	}

	.board-rect {
		fill: #ffffff;
		stroke: #1a1a1a;
		stroke-width: 1;
		vector-effect: non-scaling-stroke;
	}

	.placed-piece {
		stroke: #000000; /* fill is set inline */
		vector-effect: non-scaling-stroke;
	}
	/* Add a subtle effect on hover maybe */
	.placed-piece-group:hover .placed-piece {
		stroke: #ff0000;
		stroke-width: 1.5;
	}

	/* Common text styling */
	.piece-label,
	.piece-dims,
	.scrap-label {
		text-anchor: middle;
		dominant-baseline: middle;
		fill: #000;
		font-family: sans-serif;
		pointer-events: none; /* Allow hover on rect below */
		/* Improve text visibility */
		paint-order: stroke;
		stroke: rgba(255, 255, 255, 0.7);
		stroke-width: 2px;
		stroke-linecap: butt;
		stroke-linejoin: miter;
	}
	.piece-label {
		font-weight: bold;
	}
	.piece-dims {
		fill: #222;
	}
	.scrap-label {
		fill: #555;
		font-size: 0.9em;
	}

	/* Scrap styling */
	.scrap-piece {
		fill: none; /* No fill */
		stroke: #888888;
		stroke-width: 0.7;
		stroke-dasharray: 4, 4;
		vector-effect: non-scaling-stroke;
	}
	.scrap-piece-group:hover .scrap-piece {
		stroke: #000;
	} /* Highlight scrap on hover */

	.no-results {
		text-align: center;
		font-style: italic;
		color: #666;
		padding: 1rem;
	}
	.no-results p {
		margin: 0.5rem 0;
	}
	.no-results h4 {
		margin-top: 1rem;
		margin-bottom: 0.5rem;
		font-size: 1rem;
	}
	.no-results ul {
		font-size: 0.9rem;
		list-style: disc;
		padding-left: 30px;
	}
</style>
