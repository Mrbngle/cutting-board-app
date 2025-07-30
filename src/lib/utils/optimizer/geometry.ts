import type { FreeRectangle, Rectangle } from '../optimizer';
import type { CutSettings } from '../../stores/settingsStore';

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
export function splitFreeRectangle(
	freeRect: Readonly<FreeRectangle>,
	placedRect: Readonly<Rectangle>,
	settings: Readonly<CutSettings>
): FreeRectangle[] {
	const newRects: FreeRectangle[] = [];
	const k = settings.kerfMm;
	const epsilon = 1e-5;

	if (
		placedRect.width <= epsilon ||
		placedRect.length <= epsilon ||
		placedRect.x < freeRect.x - epsilon ||
		placedRect.y < freeRect.y - epsilon ||
		placedRect.x + placedRect.width > freeRect.x + freeRect.width + epsilon ||
		placedRect.y + placedRect.length > freeRect.y + freeRect.length + epsilon
	) {
		console.error(
			'Internal Error: Placed rectangle is invalid or outside free rectangle during split.',
			{ freeRect, placedRect }
		);
		return [];
	}

	const leftoverW = freeRect.width - placedRect.width;
	const leftoverL = freeRect.length - placedRect.length;

	if (leftoverW <= leftoverL) {
		const rightWidth = leftoverW - k;
		if (rightWidth > epsilon) {
			newRects.push({
				x: freeRect.x + placedRect.width + k,
				y: freeRect.y,
				width: rightWidth,
				length: freeRect.length
			});
		}

		const belowLength = leftoverL;
		if (belowLength > epsilon) {
			newRects.push({
				x: freeRect.x,
				y: freeRect.y + placedRect.length,
				width: placedRect.width,
				length: belowLength
			});
		}
	} else {
		const belowLength = leftoverL - k;
		if (belowLength > epsilon) {
			newRects.push({
				x: freeRect.x,
				y: freeRect.y + placedRect.length + k,
				width: freeRect.width,
				length: belowLength
			});
		}

		const rightWidth = leftoverW;
		if (rightWidth > epsilon) {
			newRects.push({
				x: freeRect.x + placedRect.width,
				y: freeRect.y,
				width: rightWidth,
				length: placedRect.length
			});
		}
	}

	return newRects;
}

/**
 * Prunes the list of free rectangles by removing any rectangle that is fully
 * contained within another in the list. Improves efficiency slightly.
 * Does NOT currently merge adjacent rectangles.
 *
 * @param rectangles - The current list of free rectangles for a board.
 * @returns A potentially smaller list of free rectangles with contained ones removed.
 */
export function pruneFreeRectangles(rectangles: FreeRectangle[]): FreeRectangle[] {
	if (rectangles.length < 2) {
		return rectangles;
	}

	const keptIndices = new Set<number>(Array.from({ length: rectangles.length }, (_, i) => i));
	const epsilon = 1e-5;

	for (let i = 0; i < rectangles.length; i++) {
		if (!keptIndices.has(i)) continue;

		for (let j = i + 1; j < rectangles.length; j++) {
			if (!keptIndices.has(j)) continue;

			const rectI = rectangles[i];
			const rectJ = rectangles[j];

			const i_in_j =
				rectI.x >= rectJ.x - epsilon &&
				rectI.y >= rectJ.y - epsilon &&
				rectI.x + rectI.width <= rectJ.x + rectJ.width + epsilon &&
				rectI.y + rectI.length <= rectJ.y + rectJ.length + epsilon;

			const j_in_i =
				rectJ.x >= rectI.x - epsilon &&
				rectJ.y >= rectI.y - epsilon &&
				rectJ.x + rectJ.width <= rectI.x + rectI.width + epsilon &&
				rectJ.y + rectJ.length <= rectI.y + rectI.length + epsilon;

			if (i_in_j && j_in_i) {
				keptIndices.delete(j);
			} else if (i_in_j) {
				keptIndices.delete(i);
				break;
			} else if (j_in_i) {
				keptIndices.delete(j);
			}
		}
	}

	if (keptIndices.size === rectangles.length) {
		return rectangles;
	} else {
		return Array.from(keptIndices).map((index) => rectangles[index]);
	}
}
