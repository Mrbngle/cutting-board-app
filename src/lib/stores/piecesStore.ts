import { get, type Writable } from 'svelte/store'; // Keep 'get' if used in methods
import { createPersistentStore } from '$lib/utils/persistentStore'; // Adjust path if needed
import { boardStore, INCHES_TO_MM, type BoardState } from './boardStore'; // Keep imports needed for methods

// CutPiece interface
export interface CutPiece {
  id: string;
  name: string;
  widthMm: number;
  lengthMm: number;
  quantity: number;
  priority: number;
  grainDirection: 'length' | 'width' | 'none';
}

// Type definitions for input data
type PieceInputData = Partial<Omit<CutPiece, 'id' | 'widthMm' | 'lengthMm' | 'width' | 'length' | 'quantity'>> & { width: number | string; length: number | string; quantity?: number | string; };
type PieceUpdateData = Partial<Omit<CutPiece, 'id' | 'widthMm' | 'lengthMm' | 'width' | 'length'>> & { width?: number | string; length?: number | string; quantity?: number | string; };

// Default state is an empty array
const defaultPiecesState: CutPiece[] = [];

// Define a unique key for localStorage
const STORAGE_KEY = 'plywood_pieces_v1';

// PiecesStore interface
export interface PiecesStore extends Pick<Writable<CutPiece[]>, 'subscribe' | 'set'> {
    addPiece: (pieceData: PieceInputData) => boolean;
    removePiece: (id: string) => void;
    updatePiece: (id: string, updatedData: PieceUpdateData) => boolean;
    clearPieces: () => void;
}

function createPiecesStore(): PiecesStore {
  // Use createPersistentStore instead of writable
  const { subscribe, set, update }: Writable<CutPiece[]> =
    createPersistentStore<CutPiece[]>(STORAGE_KEY, defaultPiecesState);

  // They use 'update', 'set', and 'get(boardStore)' which still work correctly
  const addPiece = (pieceData: PieceInputData): boolean => {
    const currentBoardState: BoardState = get(boardStore);
    const currentUnits = currentBoardState.units;
    const inputWidth = parseFloat(String(pieceData.width));
    const inputLength = parseFloat(String(pieceData.length));
    if (isNaN(inputWidth) || isNaN(inputLength) || inputWidth <= 0 || inputLength <= 0) {
      console.error("piecesStore.addPiece: Invalid dimensions provided.", { inputWidth, inputLength });
      alert("Error: Piece width and length must be positive numbers.");
      return false;
    }
    const widthMm = (currentUnits === 'inches') ? (inputWidth * INCHES_TO_MM) : inputWidth;
    const lengthMm = (currentUnits === 'inches') ? (inputLength * INCHES_TO_MM) : inputLength;
    const quantity = Math.max(1, Math.round(Number(pieceData.quantity)) || 1);
    const priority = Math.max(1, Math.min(5, Math.round(Number(pieceData.priority)) || 5));
    const name = String(pieceData.name || `Piece ${widthMm.toFixed(0)}x${lengthMm.toFixed(0)}`).trim();
    const grainDirection = pieceData.grainDirection || 'none';
    if (!['length', 'width', 'none'].includes(grainDirection)) { /* warning */ }
    const id = crypto.randomUUID();
    const newPiece: CutPiece = { id, name: name || `Piece ${id.substring(0, 4)}`, widthMm, lengthMm, quantity, priority, grainDirection };
    update((currentPieces: CutPiece[]): CutPiece[] => { return [...currentPieces, newPiece]; });
    return true;
  };

  const removePiece = (id: string): void => {
    update((currentPieces: CutPiece[]): CutPiece[] => {
      const initialLength = currentPieces.length;
      const filteredPieces = currentPieces.filter(p => p.id !== id);
      if (initialLength === filteredPieces.length) { console.warn(`piecesStore.removePiece: Piece with ID ${id} not found.`); }
      return filteredPieces;
    });
  };

  const updatePiece = (id: string, updatedData: PieceUpdateData): boolean => {
    let pieceFound = false;
    const currentBoardState: BoardState = get(boardStore);
    const currentUnits = currentBoardState.units;
    update((currentPieces: CutPiece[]): CutPiece[] => {
      return currentPieces.map((piece: CutPiece): CutPiece => {
        if (piece.id === id) {
          pieceFound = true;
          let updatedPiece: CutPiece = { ...piece };
          if (updatedData.width !== undefined) { /* conversion logic */ }
          if (updatedData.length !== undefined) { /* conversion logic */ }
          if (updatedData.name !== undefined) { updatedPiece.name = String(updatedData.name).trim() || `Piece ${id.substring(0, 4)}`; }
          if (updatedData.quantity !== undefined) { updatedPiece.quantity = Math.max(1, Math.round(Number(updatedData.quantity)) || 1); }
          if (updatedData.priority !== undefined) { updatedPiece.priority = Math.max(1, Math.min(5, Math.round(Number(updatedData.priority)) || 5)); }
          if (updatedData.grainDirection !== undefined && ['length', 'width', 'none'].includes(updatedData.grainDirection)) { updatedPiece.grainDirection = updatedData.grainDirection; }
          return updatedPiece;
        }
        return piece;
      });
    });
    if (!pieceFound) { console.warn(`piecesStore.updatePiece: Piece with ID ${id} not found.`); }
    return pieceFound;
  };

  const clearPieces = (): void => {
    // Set store back to the defined default state (empty array)
    set(defaultPiecesState);
  };

  return {
    subscribe,
    addPiece,
    set,
    removePiece,
    updatePiece,
    clearPieces,
  };
}

// Export the created store instance
export const piecesStore: PiecesStore = createPiecesStore();