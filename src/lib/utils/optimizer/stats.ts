import type { FreeRectangle, UsableScrap } from '../optimizer';
import type { CutSettings } from '../../stores/settingsStore';

/**
 * Calculates usable scrap from the final free rectangles.
 *
 * @param finalBoardData - Array containing the final state of free rectangles for each board.
 * @param settings - Contains minScrapWidthMm and minScrapLengthMm.
 * @returns Object containing the list of usable scrap rectangles.
 */
export function calculateStatisticsAndScrap(
	finalBoardData: Array<{ index: number; freeRectangles: FreeRectangle[] }>,
	settings: Readonly<CutSettings>
): { usableScrap: UsableScrap[] } {
	const usableScrapList: UsableScrap[] = [];
	const minW = settings.minScrapWidthMm;
	const minL = settings.minScrapLengthMm;
	const epsilon = 1e-5;

	finalBoardData.forEach((board) => {
		board.freeRectangles.forEach((rect) => {
			if (rect.width <= epsilon || rect.length <= epsilon) return;

			const meetsMinSize =
				(rect.width >= minW - epsilon && rect.length >= minL - epsilon) ||
				(rect.width >= minL - epsilon && rect.length >= minW - epsilon);

			if (meetsMinSize) {
				usableScrapList.push({
					...rect,
					boardIndex: board.index,
					areaMm2: rect.width * rect.length
				});
			}
		});
	});

	usableScrapList.sort((a, b) => b.areaMm2 - a.areaMm2);

	return { usableScrap: usableScrapList };
}
