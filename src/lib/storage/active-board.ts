import { LocalStorage } from "@raycast/api";
import { BoardProfile } from "../types";
import { getBoards } from "./boards";

const ACTIVE_BOARD_KEY = "activeBoard";

/** Get the active board ID */
export async function getActiveBoardId(): Promise<string | undefined> {
  return await LocalStorage.getItem<string>(ACTIVE_BOARD_KEY);
}

/** Set the active board by ID */
export async function setActiveBoardId(id: string): Promise<void> {
  await LocalStorage.setItem(ACTIVE_BOARD_KEY, id);
}

/** Get the active board profile, falling back to the first board if none is set */
export async function getActiveBoard(): Promise<BoardProfile | undefined> {
  const boards = await getBoards();
  if (boards.length === 0) return undefined;

  const activeId = await getActiveBoardId();
  const active = boards.find((b) => b.id === activeId);

  // Fall back to first board if active board is missing
  return active ?? boards[0];
}
