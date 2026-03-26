import { describe, it, expect, beforeEach } from "vitest";
import { __resetMockStorage } from "../../__mocks__/@raycast/api";
import {
  getActiveBoardId,
  setActiveBoardId,
  getActiveBoard,
} from "./active-board";
import { saveBoard } from "./boards";
import { BoardProfile } from "../types";

function makeMockBoard(id: string): BoardProfile {
  return {
    id,
    name: `Board ${id}`,
    keyboard: "test",
    layoutKey: "LAYOUT",
    firmware: "qmk",
    layers: [{ index: 0, name: "Base", keycodes: ["KC_A"] }],
    physicalLayout: [{ x: 0, y: 0, w: 1, h: 1 }],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe("active board storage", () => {
  beforeEach(() => {
    __resetMockStorage();
  });

  it("returns undefined when no active board is set", async () => {
    expect(await getActiveBoardId()).toBeUndefined();
  });

  it("sets and gets active board ID", async () => {
    await setActiveBoardId("board-1");
    expect(await getActiveBoardId()).toBe("board-1");
  });

  it("returns undefined when no boards exist", async () => {
    expect(await getActiveBoard()).toBeUndefined();
  });

  it("returns the active board profile", async () => {
    const board = makeMockBoard("active-one");
    await saveBoard(board);
    await setActiveBoardId("active-one");

    const active = await getActiveBoard();
    expect(active?.id).toBe("active-one");
  });

  it("falls back to first board if active ID is missing", async () => {
    const board = makeMockBoard("fallback");
    await saveBoard(board);
    // Don't set active ID — should fall back to first board

    const active = await getActiveBoard();
    expect(active?.id).toBe("fallback");
  });
});
