import { Action, ActionPanel, Detail, environment, Icon } from "@raycast/api";
import { useEffect, useState } from "react";
import { BoardProfile } from "../lib/types";
import { getActiveBoard } from "../lib/storage/active-board";
import { getBoards } from "../lib/storage/boards";
import { setActiveBoardId } from "../lib/storage/active-board";
import { generateSvg } from "../lib/svg/renderer";
import AddBoardCommand from "./add-board";

export default function ShowLayoutCommand() {
  const [board, setBoard] = useState<BoardProfile | undefined>();
  const [allBoards, setAllBoards] = useState<BoardProfile[]>([]);
  const [focusLayer, setFocusLayer] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [noBoards, setNoBoards] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [active, boards] = await Promise.all([getActiveBoard(), getBoards()]);
        setAllBoards(boards);
        if (!active) {
          setNoBoards(true);
          return;
        }
        setBoard(active);
      } catch {
        setNoBoards(true);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  if (noBoards && !isLoading) {
    return (
      <Detail
        markdown={`# Welcome to Keyboard Layout Visualizer\n\nNo boards loaded yet.\n\n**Plug in your keyboard** and add it — supports Vial (USB HID) and ZMK Studio (serial), or import a keymap file.`}
        actions={
          <ActionPanel>
            <Action.Push title="Add Board" icon={Icon.Plus} target={<AddBoardCommand />} />
          </ActionPanel>
        }
      />
    );
  }

  if (!board) {
    return <Detail isLoading={isLoading} markdown="" />;
  }

  async function switchBoard(b: BoardProfile) {
    await setActiveBoardId(b.id);
    setBoard(b);
    setFocusLayer(null);
  }

  const appearance = environment.appearance;

  // Build markdown with ALL layers stacked, or just the focused one
  let markdown = "";
  const layersToRender = focusLayer !== null ? [focusLayer] : board.layers.map((l) => l.index);

  for (const layerIdx of layersToRender) {
    const layer = board.layers[layerIdx];
    if (!layer) continue;

    try {
      const result = generateSvg(board.physicalLayout, {
        appearance,
        layerIndex: layerIdx,
        layers: board.layers,
        showGhostKeys: true,
      });
      if (focusLayer === null) {
        // All layers mode — add layer name as header
        markdown += `### ${layer.name}\n\n`;
      }
      markdown += `![${layer.name}](${result.filePath}?raycast-width=${result.width})\n\n`;
    } catch (e) {
      markdown += `### ${layer.name}\n\n*Error rendering: ${e instanceof Error ? e.message : "unknown"}*\n\n`;
    }
  }

  const navTitle = focusLayer !== null
    ? `${board.name} — ${board.layers[focusLayer]?.name}`
    : `${board.name} — All Layers`;

  return (
    <Detail
      navigationTitle={navTitle}
      markdown={markdown}
      isLoading={isLoading}
      metadata={
        <Detail.Metadata>
          <Detail.Metadata.Label title="Board" text={board.name} />
          <Detail.Metadata.Label title="Keyboard" text={board.keyboard} />
          <Detail.Metadata.Label
            title="View"
            text={focusLayer !== null ? `${board.layers[focusLayer]?.name} (${focusLayer + 1}/${board.layers.length})` : `All ${board.layers.length} layers`}
          />
          <Detail.Metadata.Separator />
          <Detail.Metadata.TagList title="Layers">
            {board.layers.map((l) => (
              <Detail.Metadata.TagList.Item
                key={l.index}
                text={l.name}
                color={focusLayer === l.index ? "#007AFF" : undefined}
              />
            ))}
          </Detail.Metadata.TagList>
          <Detail.Metadata.Separator />
          <Detail.Metadata.Label title="Firmware" text={board.firmware.toUpperCase()} />
          <Detail.Metadata.Label title="Layout" text={board.layoutKey} />
        </Detail.Metadata>
      }
      actions={
        <ActionPanel>
          <ActionPanel.Section title="View">
            <Action
              title="Show All Layers"
              icon={Icon.List}
              shortcut={{ modifiers: ["cmd"], key: "0" }}
              onAction={() => setFocusLayer(null)}
            />
            {board.layers.map((l) => (
              <Action
                key={l.index}
                title={`Focus ${l.name}`}
                shortcut={{ modifiers: ["cmd"], key: String(l.index + 1) as "1" }}
                onAction={() => setFocusLayer(l.index)}
              />
            ))}
          </ActionPanel.Section>
          <ActionPanel.Section title="Navigate">
            <Action
              title="Next Layer"
              shortcut={{ modifiers: ["cmd"], key: "]" }}
              onAction={() => {
                if (focusLayer === null) {
                  setFocusLayer(0);
                } else {
                  setFocusLayer(Math.min(focusLayer + 1, board.layers.length - 1));
                }
              }}
            />
            <Action
              title="Previous Layer"
              shortcut={{ modifiers: ["cmd"], key: "[" }}
              onAction={() => {
                if (focusLayer === null) {
                  setFocusLayer(board.layers.length - 1);
                } else if (focusLayer === 0) {
                  setFocusLayer(null);
                } else {
                  setFocusLayer(focusLayer - 1);
                }
              }}
            />
          </ActionPanel.Section>
          {allBoards.length > 1 && (
            <ActionPanel.Section title="Switch Board">
              {allBoards
                .filter((b) => b.id !== board.id)
                .map((b) => (
                  <Action
                    key={b.id}
                    title={`Switch to ${b.name}`}
                    icon={Icon.Switch}
                    onAction={() => switchBoard(b)}
                  />
                ))}
            </ActionPanel.Section>
          )}
          <ActionPanel.Section title="Actions">
            <Action.Push
              title="Add Board"
              icon={Icon.Plus}
              target={<AddBoardCommand />}
              shortcut={{ modifiers: ["cmd"], key: "n" }}
            />
            <Action.Open
              title="Open Vial"
              target="vial"
              shortcut={{ modifiers: ["cmd", "shift"], key: "v" }}
            />
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}
