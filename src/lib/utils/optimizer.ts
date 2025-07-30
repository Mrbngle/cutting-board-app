import type { CutPiece } from '$lib/stores/piecesStore'; // Adjust path if stores are elsewhere
import type { CutSettings } from '$lib/stores/settingsStore'; // Adjust path if stores are elsewhere

import { get } from 'svelte/store'; // Need get if we were using it here, currently not needed for validation/prep
import { boardStore, INCHES_TO_MM, type BoardState } from '$lib/stores/boardStore'; // Still needed later potentially

// ============================================================================
// === Input Structures =======================================================
// ============================================================================

/** Basic board dimensions */
interface BoardDimensions {
	widthMm: number;
	lengthMm: number;
}

/** Input data bundle for the optimizer function */
export interface OptimizerInput {
	board: BoardDimensions;
	pieces: ReadonlyArray<CutPiece>; // Use ReadonlyArray as input shouldn't be modified
	settings: Readonly<CutSettings>; // Use Readonly for settings
}

// ============================================================================
// === Output Structures ======================================================
// ============================================================================

/** Represents a generic geometric rectangle with position and size */
export interface Rectangle {
	x: number; // Position of the top-left corner (in mm)
	y: number; // Position of the top-left corner (in mm)
	width: number; // Width in mm
	length: number; // Length (height) in mm
}

/** Internal representation of a free space during calculation */
export interface FreeRectangle extends Rectangle {
	// Could potentially add scoring properties here later if needed
}

/** Represents a single piece successfully placed onto a board */
export interface PlacedPiece {
	id: string; // ID from the original CutPiece
	name: string; // Name from the original CutPiece
	boardIndex: number; // 0-indexed ID of the board it's placed on
	isRotated: boolean; // Was the piece rotated 90 degrees for placement?
	// Dimensions *as placed* on the board (accounts for rotation)
	placedWidthMm: number;
	placedLengthMm: number;
	// Position on the board (top-left corner relative to board origin 0,0)
	x: number; // Position in mm
	y: number; // Position in mm
	// Optional: Include original index or object if needed downstream
	// originalPiece: CutPiece;
}

/** Represents a leftover rectangle of material large enough to be usable scrap */
export interface UsableScrap extends Rectangle {
	boardIndex: number; // Which board this scrap piece is on
	areaMm2: number; // Calculated area
}

/** The final result object returned by the calculateLayout function */
export interface LayoutResult {
	/** List of pieces successfully placed on boards */
	placedPieces: PlacedPiece[];
	/** List of original CutPiece objects that could not be placed */
	unplacedPieces: CutPiece[];
	/** Total number of stock boards used for the layout (>= 1 if any pieces placed) */
	boardsUsed: number;
	/** Dimensions of the stock board used */
	boardDimensions: BoardDimensions;
	/** The settings configuration used for this optimization run */
	settingsUsed: CutSettings;
	/** The total area of all pieces *requested* (mm^2) */
	totalPiecesAreaMm2: number;
	/** The total area of all pieces *successfully placed* (mm^2) */
	totalPlacedPieceAreaMm2: number;
	/** The total area of all stock boards used (mm^2) */
	totalBoardsAreaMm2: number;
	/** Calculated waste percentage: 100 * (1 - totalPlacedPieceArea / totalBoardsAreaMm2) */
	wastePercentage: number;
	/** List of leftover rectangles meeting the minimum scrap size criteria */
	usableScrap: UsableScrap[];
	/** Optional: Time taken for the calculation */
	processingTimeMs?: number;
	/** Optional: Any errors or warnings encountered */
	errors?: string[];
	warnings?: string[];
}

// ============================================================================
// === Main Optimizer Function ================================================
// ============================================================================

import { findBestPlacementOnBoard, type PlacementCandidate } from './optimizer/placement';
import { splitFreeRectangle, pruneFreeRectangles } from './optimizer/geometry';
import { calculateStatisticsAndScrap } from './optimizer/stats';

export function calculateLayout(input: OptimizerInput): LayoutResult {
  const startTime = performance.now();
  const { board, pieces, settings } = input;
  const errors: string[] = [];
  const warnings: string[] = [];

  console.log("Starting layout calculation...", { board, pieces_count: pieces.length, settings });

  // --- 1. Validate Inputs ---
  if (board.widthMm <= 0 || board.lengthMm <= 0) { errors.push("Board dimensions must be positive."); }
  if (settings.kerfMm < 0) { errors.push("Kerf cannot be negative."); }
  if (settings.edgeTrimMm < 0) { errors.push("Edge trim cannot be negative."); }
  if (settings.minScrapWidthMm < 0 || settings.minScrapLengthMm < 0) { errors.push("Minimum scrap dimensions cannot be negative."); }
  const usableWidthMm = board.widthMm - 2 * settings.edgeTrimMm;
  const usableLengthMm = board.lengthMm - 2 * settings.edgeTrimMm;
  if (usableWidthMm <= 0 || usableLengthMm <= 0) { if (settings.edgeTrimMm > 0) { errors.push(`Edge trim (${settings.edgeTrimMm}mm) is too large for board dimensions.`); } }
  const unplaceablePiecesDueToSize = pieces.filter(p => {
    const canFitNormally = (p.widthMm <= usableWidthMm && p.lengthMm <= usableLengthMm);
    const canRotate = settings.respectGrain ? p.grainDirection === 'none' : true;
    const canFitRotated = canRotate && (p.lengthMm <= usableWidthMm && p.widthMm <= usableLengthMm);
    return !(canFitNormally || canFitRotated);
  });
  if (unplaceablePiecesDueToSize.length > 0) { warnings.push(`Found ${unplaceablePiecesDueToSize.length} piece type(s) larger than the usable board area: ${unplaceablePiecesDueToSize.map(p => p.name || p.id).join(', ')}`); }
  if (errors.length > 0) {
    console.error("Input validation failed:", errors);
    const totalPiecesArea = pieces.reduce((sum, p) => sum + (p.widthMm * p.lengthMm * Math.max(0, p.quantity)), 0);
    return { /* Return error LayoutResult */ placedPieces: [], unplacedPieces: [...pieces], boardsUsed: 0, boardDimensions: board, settingsUsed: settings, totalPiecesAreaMm2: totalPiecesArea, totalPlacedPieceAreaMm2: 0, totalBoardsAreaMm2: 0, wastePercentage: 100, usableScrap: [], processingTimeMs: performance.now() - startTime, errors, warnings };
  }

  // --- 2. Prepare Piece List for Placement ---
  const pieceInstances: CutPiece[] = pieces.flatMap(piece => {
    const quantity = Math.max(0, Math.round(piece.quantity || 0));
    if (quantity === 0) return [];
    return Array(quantity).fill(null).map(() => ({ ...piece, quantity: 1 }));
  });
  pieceInstances.sort((a, b) => { // Sort by Desc Length, then Desc Width
    if (b.lengthMm !== a.lengthMm) { return b.lengthMm - a.lengthMm; }
    return b.widthMm - a.widthMm;
  });
  console.log(`Prepared ${pieceInstances.length} total piece instances for placement.`);

  // --- 3. Initialize State ---
  const placedPiecesList: PlacedPiece[] = [];
  const originalPieceMap = new Map(pieces.map(p => [p.id, p])); // Map to get original piece data if needed
  const finalUnplacedPiecesSet = new Set<string>(); // Use Set to track IDs of unplaced originals

  const initialUsableRect: FreeRectangle | null = (usableWidthMm > 0 && usableLengthMm > 0) ? { x: settings.edgeTrimMm, y: settings.edgeTrimMm, width: usableWidthMm, length: usableLengthMm } : null;
  let boardData: Array<{ index: number; freeRectangles: FreeRectangle[] }> = [];
  if (initialUsableRect) { boardData.push({ index: 0, freeRectangles: [initialUsableRect] }); }
  else { warnings.push("No usable area on board after edge trim."); }

  // --- 4. Main Placement Loop ---
  console.log("Starting placement loop...");
  for (const piece of pieceInstances) {
    let piecePlaced = false;
    let bestPlacementForPiece: (PlacementCandidate & { boardIndex: number }) | null = null;

    // Try placing on existing boards first
    for (let i = 0; i < boardData.length; i++) {
      const currentBoard = boardData[i];
      const placementAttempt = findBestPlacementOnBoard(piece, currentBoard.freeRectangles, settings); // Pass current board's free rects

      if (placementAttempt) {
        // Found the first suitable spot on this board
        bestPlacementForPiece = { boardIndex: i, ...placementAttempt };
        piecePlaced = true;
        break; // Place on the first board it fits, then move to next piece
      }
    }

    // If not placed on existing boards, try adding a new board (if possible)
    if (!piecePlaced && initialUsableRect) {
      const newBoardIndex = boardData.length;
      // Check if piece could even fit on a new empty board (redundant if validation is perfect, but safe)
      const canFitNew = findBestPlacementOnBoard(piece, [initialUsableRect], settings);
      if (canFitNew) {
        console.log(`Piece ${piece.name || piece.id} didn't fit on ${boardData.length} board(s), adding new board ${newBoardIndex}.`);
        const newBoard = { index: newBoardIndex, freeRectangles: [initialUsableRect] }; // New board starts fresh
        boardData.push(newBoard);

        // Try placement again only on the newly added board
        const placementAttempt = findBestPlacementOnBoard(piece, newBoard.freeRectangles, settings);
        if (placementAttempt) { // Should always find the same fit as 'canFitNew'
          bestPlacementForPiece = { boardIndex: newBoardIndex, ...placementAttempt };
          piecePlaced = true;
        } else {
          // Should not happen if canFitNew was true, indicates logic error
          console.error(`Logic Error: Piece fit check passed but placement failed on new board for ${piece.name || piece.id}`);
          warnings.push(`Placement logic error for piece ${piece.name || piece.id} on new board.`);
        }
      } else {
        // Piece cannot fit even on an empty usable board area
        // Warning generated during validation, this confirms it.
      }
    }

    // Process the placement if one was determined
    if (piecePlaced && bestPlacementForPiece) {
      const { boardIndex, nodeIndex, placementRect, isRotated } = bestPlacementForPiece;
      const targetBoard = boardData[boardIndex];
      const usedNode = targetBoard.freeRectangles[nodeIndex];

      // Add to the list of successfully placed pieces
      placedPiecesList.push({
        id: piece.id, name: piece.name, boardIndex, isRotated,
        placedWidthMm: placementRect.width, placedLengthMm: placementRect.length,
        x: placementRect.x, y: placementRect.y,
      });

      // Update the free rectangles list on the target board
      // Remove the rectangle that was used for placement
      const removedRect = targetBoard.freeRectangles.splice(nodeIndex, 1)[0];
      // Split the removed rectangle into new smaller free rectangles around the placed piece
      const newFreeRects = splitFreeRectangle(removedRect, placementRect, settings);
      // Add the newly created free rectangles back to the list
      targetBoard.freeRectangles.push(...newFreeRects);

      // Optional but recommended: Clean up the free rectangles list
      targetBoard.freeRectangles = pruneFreeRectangles(targetBoard.freeRectangles);

    } else {
      // Piece could not be placed on any existing board or a new board
      console.log(`Failed to place piece instance ${piece.name || piece.id} (${piece.widthMm}x${piece.lengthMm})`);
      finalUnplacedPiecesSet.add(piece.id); // Add the ID of the original piece type
    }

  } // End of pieceInstances loop
  console.log("Finished placement loop.");


  // --- 5. Post-Processing ---
  const { usableScrap: finalUsableScrap } = calculateStatisticsAndScrap(boardData, settings);
  // TODO: Calculate final statistics (placed area, waste %, boards used count) accurately
  // TODO: Potentially move other stat calculations here too

  console.warn("Post-processing (stats, scrap identification) still needs full implementation!");

  // TODO: Calculate usableScrap from final boardData.freeRectangles based on settings
  const usableScrapList: UsableScrap[] = []; // Placeholder

  const totalPiecesArea = pieces.reduce((sum, p) => sum + (p.widthMm * p.lengthMm * Math.max(0, p.quantity)), 0);

  // Calculate final statistics accurately
  const finalPlacedPieceArea = placedPiecesList.reduce((sum, p) => sum + p.placedWidthMm * p.placedLengthMm, 0);
  const finalBoardsUsedCount = boardData.length > 0 && placedPiecesList.length > 0 ? boardData.length : 0;
  const finalTotalBoardArea = finalBoardsUsedCount * board.widthMm * board.lengthMm;
  const finalWastePerc = finalTotalBoardArea > 0
    ? Math.max(0, 100 * (1 - finalPlacedPieceArea / finalTotalBoardArea))
    : (totalPiecesArea > 0 ? 100 : 0); // Handle division by zero / no boards used case

  // Convert Set of unplaced IDs back to list of original CutPiece objects
  const finalUnplacedList = pieces.filter(p => finalUnplacedPiecesSet.has(p.id));

  // --- Return Final Result ---
  const endTime = performance.now();

  const finalResult: LayoutResult = {
    placedPieces: placedPiecesList,
    unplacedPieces: finalUnplacedList,
    boardsUsed: finalBoardsUsedCount,
    boardDimensions: { ...board },
    settingsUsed: { ...settings },
    totalPiecesAreaMm2: totalPiecesArea,
    totalPlacedPieceAreaMm2: finalPlacedPieceArea,
    totalBoardsAreaMm2: finalTotalBoardArea,
    wastePercentage: finalWastePerc,
    usableScrap: finalUsableScrap,
    processingTimeMs: endTime - startTime,
    errors,
    warnings,
  };

  console.log(`Layout calculation finished in ${finalResult.processingTimeMs?.toFixed(1)}ms.`);
  console.log(`Result: ${finalResult.placedPieces.length} pieces placed, ${finalResult.unplacedPieces.length} original piece types unplaced, ${finalResult.boardsUsed} boards used, Waste: ${finalResult.wastePercentage.toFixed(1)}%`);

  return finalResult;
}
