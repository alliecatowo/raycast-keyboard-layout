import { LocalStorage } from "@raycast/api";
import { BoardProfile } from "../types";

const BOARDS_KEY = "boards";

/** Get all saved board profiles */
export async function getBoards(): Promise<BoardProfile[]> {
  const raw = await LocalStorage.getItem<string>(BOARDS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as BoardProfile[];
  } catch {
    return [];
  }
}

/** Save a new board profile */
export async function saveBoard(board: BoardProfile): Promise<void> {
  const boards = await getBoards();
  boards.push(board);
  await LocalStorage.setItem(BOARDS_KEY, JSON.stringify(boards));
}

/** Update an existing board profile */
export async function updateBoard(board: BoardProfile): Promise<void> {
  const boards = await getBoards();
  const index = boards.findIndex((b) => b.id === board.id);
  if (index === -1) {
    throw new Error(`Board "${board.id}" not found`);
  }
  boards[index] = { ...board, updatedAt: new Date().toISOString() };
  await LocalStorage.setItem(BOARDS_KEY, JSON.stringify(boards));
}

/** Delete a board profile by ID */
export async function deleteBoard(id: string): Promise<void> {
  const boards = await getBoards();
  const filtered = boards.filter((b) => b.id !== id);
  await LocalStorage.setItem(BOARDS_KEY, JSON.stringify(filtered));
}

/** Get a single board by ID */
export async function getBoard(id: string): Promise<BoardProfile | undefined> {
  const boards = await getBoards();
  return boards.find((b) => b.id === id);
}
