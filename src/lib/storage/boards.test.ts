import { describe, it, expect, beforeEach } from "vitest";
import { __resetMockStorage } from "../../__mocks__/@raycast/api";
import {
  getBoards,
  saveBoard,
  updateBoard,
  deleteBoard,
  getBoard,
} from "./boards";
import { BoardProfile } from "../types";

function makeMockBoard(overrides: Partial<BoardProfile> = {}): BoardProfile {
  return {
    id: "test-id-" + Math.random().toString(36).slice(2),
    name: "Test Board",
    keyboard: "test/keyboard",
    layoutKey: "LAYOUT",
    firmware: "qmk",
    layers: [{ index: 0, name: "Base", keycodes: ["KC_A", "KC_B"] }],
    physicalLayout: [
      { x: 0, y: 0, w: 1, h: 1 },
      { x: 1, y: 0, w: 1, h: 1 },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("boards storage", () => {
  beforeEach(() => {
    __resetMockStorage();
  });

  it("starts with empty boards", async () => {
    const boards = await getBoards();
    expect(boards).toEqual([]);
  });

  it("saves and retrieves a board", async () => {
    const board = makeMockBoard({ name: "My Lily" });
    await saveBoard(board);

    const boards = await getBoards();
    expect(boards).toHaveLength(1);
    expect(boards[0].name).toBe("My Lily");
  });

  it("saves multiple boards", async () => {
    await saveBoard(makeMockBoard({ name: "Board 1" }));
    await saveBoard(makeMockBoard({ name: "Board 2" }));

    const boards = await getBoards();
    expect(boards).toHaveLength(2);
  });

  it("gets a board by ID", async () => {
    const board = makeMockBoard({ id: "find-me" });
    await saveBoard(board);

    const found = await getBoard("find-me");
    expect(found).toBeDefined();
    expect(found?.id).toBe("find-me");
  });

  it("returns undefined for unknown ID", async () => {
    const found = await getBoard("nonexistent");
    expect(found).toBeUndefined();
  });

  it("updates a board", async () => {
    const board = makeMockBoard({ id: "update-me", name: "Old Name" });
    await saveBoard(board);

    await updateBoard({ ...board, name: "New Name" });

    const found = await getBoard("update-me");
    expect(found?.name).toBe("New Name");
  });

  it("throws when updating nonexistent board", async () => {
    const board = makeMockBoard({ id: "ghost" });
    await expect(updateBoard(board)).rejects.toThrow("not found");
  });

  it("deletes a board", async () => {
    const board = makeMockBoard({ id: "delete-me" });
    await saveBoard(board);

    await deleteBoard("delete-me");

    const boards = await getBoards();
    expect(boards).toHaveLength(0);
  });
});
