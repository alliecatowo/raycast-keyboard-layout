import { Action, ActionPanel, Detail, Form, showToast, Toast, useNavigation } from "@raycast/api";
import { useState } from "react";
import * as fs from "fs";
import { parseQmkKeymapJson, keymapToBoardProfile } from "../lib/keymap/parser";
import { getPhysicalLayout } from "../lib/qmk/cache";
import { saveBoard } from "../lib/storage/boards";
import { setActiveBoardId } from "../lib/storage/active-board";
import { generateSvg } from "../lib/svg/renderer";
import { BoardProfile } from "../lib/types";

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
      // Read and parse
      const content = fs.readFileSync(filePath, "utf-8");
      const keymap = parseQmkKeymapJson(content);

      // Fetch physical layout from QMK API
      const toast = await showToast({
        style: Toast.Style.Animated,
        title: "Fetching layout...",
        message: `Looking up ${keymap.keyboard}`,
      });

      const physicalLayout = await getPhysicalLayout(keymap.keyboard, keymap.layout);

      // Create board profile
      const boardName = values.name || keymap.keyboard.split("/").pop() || "My Board";
      const partial = keymapToBoardProfile(keymap, boardName, filePath);
      const board: BoardProfile = { ...partial, physicalLayout };

      // Save
      await saveBoard(board);
      if (values.setActive) {
        await setActiveBoardId(board.id);
      }

      toast.hide();
      await showToast({ style: Toast.Style.Success, title: "Keymap imported!", message: boardName });

      // Show confirmation
      push(<ImportConfirmation board={board} />);
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
        info="Select a QMK keymap.json file exported from QMK Configurator"
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

function ImportConfirmation({ board }: { board: BoardProfile }) {
  const appearance =
    typeof globalThis !== "undefined" && "matchMedia" in globalThis
      ? "dark"
      : "light";

  let markdown = `# ${board.name}\n\n`;

  try {
    const result = generateSvg(board.physicalLayout, {
      appearance,
      layerIndex: 0,
      layers: board.layers,
      showGhostKeys: false,
    });
    markdown += `![Base Layer](${result.filePath}?raycast-width=${Math.min(result.width, 800)})\n\n`;
  } catch {
    markdown += "*Could not generate preview*\n\n";
  }

  markdown += `**Keyboard:** ${board.keyboard}\n`;
  markdown += `**Layout:** ${board.layoutKey}\n`;
  markdown += `**Layers:** ${board.layers.length} (${board.layers.map((l) => l.name).join(", ")})\n`;

  return (
    <Detail
      navigationTitle={`Imported: ${board.name}`}
      markdown={markdown}
      metadata={
        <Detail.Metadata>
          <Detail.Metadata.Label title="Keyboard" text={board.keyboard} />
          <Detail.Metadata.Label title="Layout" text={board.layoutKey} />
          <Detail.Metadata.Label title="Layers" text={String(board.layers.length)} />
          <Detail.Metadata.TagList title="Layer Names">
            {board.layers.map((l) => (
              <Detail.Metadata.TagList.Item key={l.index} text={l.name} />
            ))}
          </Detail.Metadata.TagList>
          <Detail.Metadata.Label title="Firmware" text={board.firmware.toUpperCase()} />
        </Detail.Metadata>
      }
      actions={
        <ActionPanel>
          <Action.Push title="View Keymap" target={<ViewImportedBoard board={board} />} />
          <Action.CopyToClipboard title="Copy Board ID" content={board.id} />
        </ActionPanel>
      }
    />
  );
}

function ViewImportedBoard({ board }: { board: BoardProfile }) {
  // Redirect to show-layout with this board — for now render inline
  const [layerIndex, setLayerIndex] = useState(0);
  const appearance = "dark"; // TODO: detect from environment

  const layer = board.layers[layerIndex];
  let markdown = `# ${board.name} — ${layer?.name ?? `Layer ${layerIndex}`}\n\n`;

  try {
    const result = generateSvg(board.physicalLayout, {
      appearance,
      layerIndex,
      layers: board.layers,
      showGhostKeys: true,
    });
    markdown += `![${layer?.name}](${result.filePath}?raycast-width=${Math.min(result.width, 800)})\n`;
  } catch {
    markdown += "*Could not generate layout*\n";
  }

  return (
    <Detail
      navigationTitle={`${board.name} — ${layer?.name}`}
      markdown={markdown}
      metadata={
        <Detail.Metadata>
          <Detail.Metadata.Label title="Board" text={board.name} />
          <Detail.Metadata.Label title="Layer" text={`${layer?.name} (${layerIndex + 1}/${board.layers.length})`} />
          <Detail.Metadata.TagList title="Layers">
            {board.layers.map((l) => (
              <Detail.Metadata.TagList.Item
                key={l.index}
                text={l.name}
                color={l.index === layerIndex ? "#007AFF" : undefined}
              />
            ))}
          </Detail.Metadata.TagList>
        </Detail.Metadata>
      }
      actions={
        <ActionPanel>
          <ActionPanel.Section title="Layers">
            {board.layers.map((l) => (
              <Action
                key={l.index}
                title={`Show ${l.name}`}
                shortcut={{ modifiers: ["cmd"], key: String(l.index + 1) as "1" }}
                onAction={() => setLayerIndex(l.index)}
              />
            ))}
          </ActionPanel.Section>
          <ActionPanel.Section title="Navigate">
            <Action
              title="Next Layer"
              shortcut={{ modifiers: ["cmd"], key: "]" }}
              onAction={() => setLayerIndex((i) => Math.min(i + 1, board.layers.length - 1))}
            />
            <Action
              title="Previous Layer"
              shortcut={{ modifiers: ["cmd"], key: "[" }}
              onAction={() => setLayerIndex((i) => Math.max(i - 1, 0))}
            />
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}
