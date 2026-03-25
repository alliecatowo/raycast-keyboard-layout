import { Action, ActionPanel, Form, showToast, Toast, useNavigation } from "@raycast/api";
import { useState } from "react";
import * as fs from "fs";
import { parseQmkKeymapJson, keymapToBoardProfile } from "../lib/keymap/parser";
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
      const keymap = parseQmkKeymapJson(content);

      const toast = await showToast({
        style: Toast.Style.Animated,
        title: "Fetching layout...",
        message: `Looking up ${keymap.keyboard}`,
      });

      const physicalLayout = await getPhysicalLayout(keymap.keyboard, keymap.layout);

      const boardName = values.name || keymap.keyboard.split("/").pop() || "My Board";
      const partial = keymapToBoardProfile(keymap, boardName, filePath);
      const board: BoardProfile = { ...partial, physicalLayout };

      await saveBoard(board);
      if (values.setActive) {
        await setActiveBoardId(board.id);
      }

      toast.hide();
      await showToast({ style: Toast.Style.Success, title: "Keymap imported!", message: boardName });

      // Go straight to viewing the board
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
        info="Select a QMK keymap.json file exported from QMK Configurator or Vial backup"
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
