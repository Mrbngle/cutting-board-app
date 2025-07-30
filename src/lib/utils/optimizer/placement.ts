import type { CutPiece } from '../../stores/piecesStore';
import type { CutSettings } from '../../stores/settingsStore';
import type { FreeRectangle, Rectangle } from '../optimizer';

/** Internal result type for findBestPlacementOnBoard */
export interface PlacementCandidate {
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
export function findBestPlacementOnBoard(
	piece: Readonly<CutPiece>,
	freeRectangles: ReadonlyArray<FreeRectangle>,
	settings: Readonly<CutSettings>
): PlacementCandidate | null {
	let bestPlacement: PlacementCandidate | null = null;
	let bestScore = Infinity;

	for (let i = 0; i < freeRectangles.length; i++) {
		const rect = freeRectangles[i];

		if (piece.widthMm <= rect.width && piece.lengthMm <= rect.length) {
			const score = Math.min(rect.width - piece.widthMm, rect.length - piece.lengthMm);
			if (score < bestScore) {
				bestScore = score;
				bestPlacement = {
					nodeIndex: i,
					placementRect: { x: rect.x, y: rect.y, width: piece.widthMm, length: piece.lengthMm },
					isRotated: false,
					score: bestScore
				};
			}
		}

		const canRotate = settings.respectGrain ? piece.grainDirection === 'none' : true;
		if (canRotate && piece.lengthMm <= rect.width && piece.widthMm <= rect.length) {
			const score = Math.min(rect.width - piece.lengthMm, rect.length - piece.widthMm);
			if (score < bestScore) {
				bestScore = score;
				bestPlacement = {
					nodeIndex: i,
					placementRect: { x: rect.x, y: rect.y, width: piece.lengthMm, length: piece.widthMm },
					isRotated: true,
					score: bestScore
				};
			}
		}
	}

	return bestPlacement;
}
