import { Action, ActionPanel, Form, showToast, Toast, useNavigation } from "@raycast/api";
import { useState } from "react";
import * as fs from "fs";
import { parseQmkKeymapJson, keymapToBoardProfile } from "../lib/keymap/parser";
import { detectFirmwareType, parseZmkKeymap } from "../lib/keymap/zmk-parser";
import { getPhysicalLayout } from "../lib/qmk/cache";
import { saveBoard } from "../lib/storage/boards";
import { setActiveBoardId } from "../lib/storage/active-board";
import { BoardProfile } from "../lib/types";
import BoardDetailView from "./board-detail-view";

export default function ImportKeymapCommand() {
  const { push } = useNavigation();
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(values: { file: string[]; name: string; setActive: boolean }) {
    const filePath = values.file?.[0];
    if (!filePath) {
      showToast({ style: Toast.Style.Failure, title: "Please select a keymap file" });
      return;
    }

    setIsLoading(true);

    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const firmware = detectFirmwareType(content);

      let board: BoardProfile;

      if (firmware === "zmk") {
        // ZMK .keymap file
        const toast = await showToast({
          style: Toast.Style.Animated,
          title: "Parsing ZMK keymap...",
        });

        const boardName = values.name || filePath.split("/").pop()?.replace(".keymap", "") || "ZMK Board";
        const partial = parseZmkKeymap(content, boardName, filePath);

        // ZMK boards don't have a QMK API layout — use empty physical layout for now
        // (user can import from USB via ZMK Studio, or we'll add layout file support)
        board = {
          ...partial,
          physicalLayout: generatePlaceholderLayout(partial.layers[0]?.keycodes.length ?? 0),
        };

        toast.hide();
        await showToast({ style: Toast.Style.Success, title: "ZMK keymap imported!", message: boardName });
      } else if (firmware === "qmk") {
        // QMK keymap.json
        const keymap = parseQmkKeymapJson(content);

        const toast = await showToast({
          style: Toast.Style.Animated,
          title: "Fetching layout...",
          message: `Looking up ${keymap.keyboard}`,
        });

        const physicalLayout = await getPhysicalLayout(keymap.keyboard, keymap.layout);
        const boardName = values.name || keymap.keyboard.split("/").pop() || "My Board";
        const partial = keymapToBoardProfile(keymap, boardName, filePath);
        board = { ...partial, physicalLayout };

        toast.hide();
        await showToast({ style: Toast.Style.Success, title: "QMK keymap imported!", message: boardName });
      } else {
        showToast({
          style: Toast.Style.Failure,
          title: "Unrecognized file format",
          message: "Expected a QMK keymap.json or ZMK .keymap file",
        });
        return;
      }

      await saveBoard(board);
      if (values.setActive) {
        await setActiveBoardId(board.id);
      }

      push(<BoardDetailView board={board} />);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      showToast({ style: Toast.Style.Failure, title: "Import failed", message });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form
      isLoading={isLoading}
      navigationTitle="Import Keymap"
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Import" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.FilePicker
        id="file"
        title="Keymap File"
        info="Select a QMK keymap.json or ZMK .keymap file. Auto-detects format."
        allowMultipleSelection={false}
      />
      <Form.TextField
        id="name"
        title="Board Name"
        placeholder="e.g. Work Corne, Home Sofle"
        info="A friendly name for this board profile"
      />
      <Form.Checkbox
        id="setActive"
        label="Set as active board"
        defaultValue={true}
      />
    </Form>
  );
}

/**
 * Generate a simple grid layout for boards without physical layout data.
 * Used as a fallback for ZMK file imports until we get proper layout info.
 */
function generatePlaceholderLayout(keyCount: number): BoardProfile["physicalLayout"] {
  // Guess a reasonable grid: try common split sizes first
  const COMMON_SPLITS: Record<number, [number, number, number]> = {
    // [keys, cols_per_half, rows]
    36: [6, 3, 6],  // Corne
    42: [6, 3, 7],  // Lily58 without encoders
    44: [6, 4, 6],  // Kyria
    48: [6, 4, 6],  // Planck-style
    58: [6, 5, 6],  // Lily58
    62: [6, 5, 7],  // Sofle
  };

  const split = COMMON_SPLITS[keyCount];
  if (split) {
    return generateSplitLayout(keyCount, split[0], split[1], split[2]);
  }

  // Generic ortho grid
  const cols = Math.ceil(Math.sqrt(keyCount * 2));
  const rows = Math.ceil(keyCount / cols);
  return Array.from({ length: keyCount }, (_, i) => ({
    x: i % cols,
    y: Math.floor(i / cols),
    w: 1,
    h: 1,
  }));
}

function generateSplitLayout(
  keyCount: number,
  colsPerHalf: number,
  thumbKeys: number,
  rows: number,
): BoardProfile["physicalLayout"] {
  const keys: BoardProfile["physicalLayout"] = [];
  const half = Math.ceil(keyCount / 2);
  const mainRows = rows - 1; // last row is thumb cluster

  // Left half
  for (let r = 0; r < mainRows && keys.length < half - thumbKeys; r++) {
    for (let c = 0; c < colsPerHalf && keys.length < half - thumbKeys; c++) {
      keys.push({ x: c, y: r, w: 1, h: 1 });
    }
  }
  // Left thumb
  for (let t = 0; t < thumbKeys && keys.length < half; t++) {
    keys.push({ x: colsPerHalf - thumbKeys + t, y: mainRows, w: 1, h: 1 });
  }

  // Right half (offset by colsPerHalf + 2 gap)
  const rightOffset = colsPerHalf + 2;
  for (let r = 0; r < mainRows && keys.length < keyCount - thumbKeys; r++) {
    for (let c = 0; c < colsPerHalf && keys.length < keyCount - thumbKeys; c++) {
      keys.push({ x: rightOffset + c, y: r, w: 1, h: 1 });
    }
  }
  // Right thumb
  for (let t = 0; t < thumbKeys && keys.length < keyCount; t++) {
    keys.push({ x: rightOffset + t, y: mainRows, w: 1, h: 1 });
  }

  return keys;
}
