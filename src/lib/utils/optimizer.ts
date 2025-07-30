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

/** Internal representation of a free space during calculation */
interface FreeRectangle extends Rectangle {
  // Could potentially add scoring properties here later if needed
}

// ============================================================================
// === Output Structures ======================================================
// ============================================================================

/** Represents a generic geometric rectangle with position and size */
export interface Rectangle {
  x: number;      // Position of the top-left corner (in mm)
  y: number;      // Position of the top-left corner (in mm)
  width: number;  // Width in mm
  length: number; // Length (height) in mm
}

/** Represents a single piece successfully placed onto a board */
export interface PlacedPiece {
  id: string;             // ID from the original CutPiece
  name: string;           // Name from the original CutPiece
  boardIndex: number;     // 0-indexed ID of the board it's placed on
  isRotated: boolean;     // Was the piece rotated 90 degrees for placement?
  // Dimensions *as placed* on the board (accounts for rotation)
  placedWidthMm: number;
  placedLengthMm: number;
  // Position on the board (top-left corner relative to board origin 0,0)
  x: number;              // Position in mm
  y: number;              // Position in mm
  // Optional: Include original index or object if needed downstream
  // originalPiece: CutPiece;
}

/** Represents a leftover rectangle of material large enough to be usable scrap */
export interface UsableScrap extends Rectangle {
  boardIndex: number;     // Which board this scrap piece is on
  areaMm2: number;        // Calculated area
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
// === Internal Helper Structures (Example) ==================================
// ============================================================================

/** Internal representation of a free space during calculation */
interface FreeRectangle extends Rectangle {
  // We might add scoring properties here later for different heuristics
}

// ============================================================================
// === Main Optimizer Function ================================================
// ============================================================================


/**
 * Calculates an optimized cutting layout for 2D panels based on input pieces and settings.
 * Uses a Guillotine algorithm, attempting Best-Short-Side-Fit (BSSF) heuristic.
 *
 * @param input - Object containing board dimensions, piece list, and settings.
 * @returns A LayoutResult object detailing the placement, waste, statistics, etc.
 */
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

// ============================================================================
// === Helper Function Definitions (Signatures & Placeholders) ==============
// ============================================================================

/** Internal result type for findBestPlacementOnBoard */
interface PlacementCandidate {
  nodeIndex: number; // Index of the free rectangle used within its board's list
  placementRect: Rectangle; // Position and dimensions of the placed piece
  isRotated: boolean;
  score: number; // Heuristic score (lower is better for BSSF)
}

/**
* Finds the best position for a piece within a given list of free rectangles
* using the Best Short Side Fit (BSSF) heuristic. Checks rotation if allowed.
* Returns details of the best placement found, or null if the piece doesn't fit anywhere.
*/
function findBestPlacementOnBoard(
  piece: Readonly<CutPiece>, // Input piece is read-only here
  freeRectangles: ReadonlyArray<FreeRectangle>, // Input list is read-only here
  settings: Readonly<CutSettings>
): PlacementCandidate | null {
  let bestPlacement: PlacementCandidate | null = null;
  let bestScore = Infinity; // Lower score is better for BSSF

  for (let i = 0; i < freeRectangles.length; i++) {
    const rect = freeRectangles[i];

    // --- Try Normal Orientation ---
    // Check if piece dimensions fit within the free rectangle dimensions
    if (piece.widthMm <= rect.width && piece.lengthMm <= rect.length) {
      // Calculate BSSF score: the smaller leftover dimension
      const score = Math.min(rect.width - piece.widthMm, rect.length - piece.lengthMm);
      // If this score is better than the best found so far, update bestPlacement
      if (score < bestScore) {
        bestScore = score;
        bestPlacement = {
          nodeIndex: i,
          placementRect: { x: rect.x, y: rect.y, width: piece.widthMm, length: piece.lengthMm },
          isRotated: false,
          score: bestScore,
        };
      }
      // Optional tie-breaker: if scores are equal, maybe prefer node earlier in the list (index i)
      // or prefer node with smaller area, etc. For now, first best score wins.
    }

    // --- Try Rotated Orientation (if allowed) ---
    const canRotate = settings.respectGrain ? piece.grainDirection === 'none' : true;
    // Check if rotated dimensions fit
    if (canRotate && piece.lengthMm <= rect.width && piece.widthMm <= rect.length) {
      // Calculate BSSF score for the rotated placement
      const score = Math.min(rect.width - piece.lengthMm, rect.length - piece.widthMm);
      // If this score is better than the best found so far (including non-rotated), update bestPlacement
      if (score < bestScore) {
        bestScore = score;
        bestPlacement = {
          nodeIndex: i,
          // Note: width/length are swapped here for the rotated piece
          placementRect: { x: rect.x, y: rect.y, width: piece.lengthMm, length: piece.widthMm },
          isRotated: true,
          score: bestScore,
        };
      }
      // Optional tie-breaker for rotation goes here if needed
    }
  } // End loop through free rectangles

  return bestPlacement; // Return the best candidate found, or null if none fit
}


/**
 * Splits a free rectangle based on where a piece was placed within it, using a Guillotine cut approach.
 * This implementation uses the 'Split Longer Leftover Axis' (SLLA) heuristic.
 * Assumes the placed piece is positioned at the top-left corner (x, y) of the free rectangle.
 * Accounts for kerf (saw blade thickness) when calculating dimensions of new rectangles adjacent to the cut.
 *
 * @param freeRect The free space rectangle where the piece was placed.
 * @param placedRect The rectangle representing the area occupied by the placed piece (dimensions account for rotation).
 * @param settings Contains kerfMm for calculation.
 * @returns An array containing 0, 1, or 2 new FreeRectangle objects created by the split.
 */
function splitFreeRectangle(
  freeRect: Readonly<FreeRectangle>,
  placedRect: Readonly<Rectangle>,
  settings: Readonly<CutSettings>
): FreeRectangle[] {
  const newRects: FreeRectangle[] = [];
  const k = settings.kerfMm; // Saw blade thickness
  const epsilon = 1e-5;     // Tolerance for floating point comparisons

  // Basic validation: placedRect must be positive and within freeRect
  if (placedRect.width <= epsilon || placedRect.length <= epsilon ||
    placedRect.x < freeRect.x - epsilon || placedRect.y < freeRect.y - epsilon ||
    (placedRect.x + placedRect.width) > (freeRect.x + freeRect.width) + epsilon ||
    (placedRect.y + placedRect.length) > (freeRect.y + freeRect.length) + epsilon) {
    console.error("Internal Error: Placed rectangle is invalid or outside free rectangle during split.", { freeRect, placedRect });
    return []; // Return empty array to signify error/no valid split
  }

  // Calculate leftover dimensions along each axis
  const leftoverW = freeRect.width - placedRect.width;
  const leftoverL = freeRect.length - placedRect.length;

  // --- Apply SLLA Heuristic ---
  // Choose the primary cut direction based on the longer leftover dimension

  if (leftoverW <= leftoverL) {
    // --- Cut Vertically First (Longer leftover axis is Length, or they are equal) ---
    // The primary cut is vertical, to the right of the placed piece.

    // 1. Rectangle potentially to the 'Right' of the placed piece
    // Width is leftover minus kerf; Length is the full original freeRect length
    const rightWidth = leftoverW - k;
    if (rightWidth > epsilon) {
      newRects.push({
        x: freeRect.x + placedRect.width + k, // Position starts after piece + kerf
        y: freeRect.y,
        width: rightWidth,
        length: freeRect.length
      });
    }

    // 2. Rectangle potentially 'Below' the placed piece area
    // Length is the full leftover length; Width matches the placed piece
    // No kerf applied here relative to the primary vertical cut.
    const belowLength = leftoverL;
    if (belowLength > epsilon) {
      newRects.push({
        x: freeRect.x,
        y: freeRect.y + placedRect.length, // Position starts directly below piece
        width: placedRect.width,          // Only as wide as the placed piece
        length: belowLength
      });
    }

  } else { // leftoverW > leftoverL
    // --- Cut Horizontally First (Longer leftover axis is Width) ---
    // The primary cut is horizontal, below the placed piece.

    // 1. Rectangle potentially 'Below' the placed piece
    // Length is leftover minus kerf; Width is the full original freeRect width
    const belowLength = leftoverL - k;
    if (belowLength > epsilon) {
      newRects.push({
        x: freeRect.x,
        y: freeRect.y + placedRect.length + k, // Position starts after piece + kerf
        width: freeRect.width,
        length: belowLength
      });
    }

    // 2. Rectangle potentially to the 'Right' of the placed piece area
    // Width is the full leftover width; Length matches the placed piece
    // No kerf applied here relative to the primary horizontal cut.
    const rightWidth = leftoverW;
    if (rightWidth > epsilon) {
      newRects.push({
        x: freeRect.x + placedRect.width, // Position starts directly right of piece
        y: freeRect.y,
        width: rightWidth,
        length: placedRect.length // Only as long as the placed piece
      });
    }
  }

  // console.log(`Split (${freeRect.width.toFixed(1)}x${freeRect.length.toFixed(1)}) after placing (${placedRect.width.toFixed(1)}x${placedRect.length.toFixed(1)}) -> ${newRects.length} new free rects.`);
  return newRects; // Already filtered for > epsilon dimensions indirectly
}


/**
 * Prunes the list of free rectangles by removing any rectangle that is fully
 * contained within another in the list. Improves efficiency slightly.
 * Does NOT currently merge adjacent rectangles.
 *
 * @param rectangles - The current list of free rectangles for a board.
 * @returns A potentially smaller list of free rectangles with contained ones removed.
 */
function pruneFreeRectangles(rectangles: FreeRectangle[]): FreeRectangle[] {
  if (rectangles.length < 2) {
    return rectangles; // No pruning needed
  }

  const keptIndices = new Set<number>(Array.from({ length: rectangles.length }, (_, i) => i));
  const epsilon = 1e-5; // Tolerance

  for (let i = 0; i < rectangles.length; i++) {
    if (!keptIndices.has(i)) continue; // Skip if already marked for removal

    for (let j = i + 1; j < rectangles.length; j++) {
      if (!keptIndices.has(j)) continue; // Skip if already marked for removal

      const rectI = rectangles[i];
      const rectJ = rectangles[j];

      // Check if i is contained in j (within epsilon)
      const i_in_j = rectI.x >= rectJ.x - epsilon &&
        rectI.y >= rectJ.y - epsilon &&
        (rectI.x + rectI.width) <= (rectJ.x + rectJ.width) + epsilon &&
        (rectI.y + rectI.length) <= (rectJ.y + rectJ.length) + epsilon;

      // Check if j is contained in i (within epsilon)
      const j_in_i = rectJ.x >= rectI.x - epsilon &&
        rectJ.y >= rectI.y - epsilon &&
        (rectJ.x + rectJ.width) <= (rectI.x + rectI.width) + epsilon &&
        (rectJ.y + rectJ.length) <= (rectI.y + rectI.length) + epsilon;

      if (i_in_j && j_in_i) {
        // Rectangles are identical within tolerance, remove the one with higher index (j)
        keptIndices.delete(j);
      } else if (i_in_j) {
        // i is contained in j, remove i
        keptIndices.delete(i);
        break; // No need to compare i further
      } else if (j_in_i) {
        // j is contained in i, remove j
        keptIndices.delete(j);
        // Continue checking i against others
      }
    }
  }

  if (keptIndices.size === rectangles.length) {
    return rectangles; // No changes made
  } else {
    // console.log(`Pruned ${rectangles.length - keptIndices.size} contained rectangles.`); // Debug
    return Array.from(keptIndices).map(index => rectangles[index]);
  }

  // --- Merging Logic (TODO if needed) ---
  // Would go here, potentially in a loop that re-runs pruning after merges.
}


/**
 * Calculates usable scrap from the final free rectangles.
 *
 * @param finalBoardData - Array containing the final state of free rectangles for each board.
 * @param settings - Contains minScrapWidthMm and minScrapLengthMm.
 * @returns Object containing the list of usable scrap rectangles.
 */
function calculateStatisticsAndScrap(
  finalBoardData: Array<{ index: number; freeRectangles: FreeRectangle[] }>,
  settings: Readonly<CutSettings>
): { usableScrap: UsableScrap[] } {
  // console.log("Calculating usable scrap..."); // Debug
  const usableScrapList: UsableScrap[] = [];
  const minW = settings.minScrapWidthMm;
  const minL = settings.minScrapLengthMm;
  const epsilon = 1e-5;

  finalBoardData.forEach(board => {
    board.freeRectangles.forEach(rect => {
      if (rect.width <= epsilon || rect.length <= epsilon) return; // Skip zero-size rects

      // Check if meets min size criteria (allowing rotation of the scrap piece)
      const meetsMinSize = (rect.width >= minW - epsilon && rect.length >= minL - epsilon) ||
        (rect.width >= minL - epsilon && rect.length >= minW - epsilon);

      if (meetsMinSize) {
        usableScrapList.push({
          ...rect, // x, y, width, length
          boardIndex: board.index,
          areaMm2: rect.width * rect.length
        });
      }
    });
  });

  // Optional: Sort scrap, e.g., by area descending
  usableScrapList.sort((a, b) => b.areaMm2 - a.areaMm2);

  // console.log(`Found ${usableScrapList.length} usable scrap pieces.`); // Debug
  return { usableScrap: usableScrapList }; // Fixed return statement (as you noted!)
}
