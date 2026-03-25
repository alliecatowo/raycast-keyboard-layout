import { Action, ActionPanel, Detail, environment, Icon } from "@raycast/api";
import { useEffect, useState } from "react";
import { BoardProfile } from "../lib/types";
import { getActiveBoard } from "../lib/storage/active-board";
import { getBoards } from "../lib/storage/boards";
import { setActiveBoardId } from "../lib/storage/active-board";
import { generateSvg } from "../lib/svg/renderer";
import ImportKeymapCommand from "./import-keymap";
import DetectBoardCommand from "./detect-board";

export default function ShowLayoutCommand() {
  const [board, setBoard] = useState<BoardProfile | undefined>();
  const [allBoards, setAllBoards] = useState<BoardProfile[]>([]);
  const [layerIndex, setLayerIndex] = useState(0);
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
        markdown={`# Welcome to Keyboard Layout Visualizer\n\nNo boards loaded yet.\n\n**Plug in your Vial keyboard** and use Detect Keyboard to read it automatically, or import a QMK keymap.json file.`}
        actions={
          <ActionPanel>
            <Action.Push title="Detect Keyboard (USB)" icon={Icon.Plug} target={<DetectBoardCommand />} />
            <Action.Push title="Import Keymap File" icon={Icon.Document} target={<ImportKeymapCommand />} />
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
    setLayerIndex(0);
  }

  const appearance = environment.appearance;
  const layer = board.layers[layerIndex];
  let markdown = "";

  try {
    const result = generateSvg(board.physicalLayout, {
      appearance,
      layerIndex,
      layers: board.layers,
      showGhostKeys: true,
    });
    markdown = `![${layer?.name ?? "Layout"}](${result.filePath}?raycast-width=${Math.min(result.width, 860)})`;
  } catch (e) {
    markdown = `# Error\n\nCould not render layout: ${e instanceof Error ? e.message : "Unknown error"}`;
  }

  return (
    <Detail
      navigationTitle={`${board.name} — ${layer?.name ?? `Layer ${layerIndex}`}`}
      markdown={markdown}
      isLoading={isLoading}
      metadata={
        <Detail.Metadata>
          <Detail.Metadata.Label title="Board" text={board.name} />
          <Detail.Metadata.Label title="Keyboard" text={board.keyboard} />
          <Detail.Metadata.Label title="Current Layer" text={`${layer?.name} (${layerIndex + 1}/${board.layers.length})`} />
          <Detail.Metadata.Separator />
          <Detail.Metadata.TagList title="Layers">
            {board.layers.map((l) => (
              <Detail.Metadata.TagList.Item
                key={l.index}
                text={l.name}
                color={l.index === layerIndex ? "#007AFF" : undefined}
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
              title="Import New Board"
              icon={Icon.Plus}
              target={<ImportKeymapCommand />}
              shortcut={{ modifiers: ["cmd"], key: "n" }}
            />
            <Action.CopyToClipboard
              title="Copy Layer SVG"
              shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
              content={(() => {
                try {
                  return generateSvg(board.physicalLayout, {
                    appearance,
                    layerIndex,
                    layers: board.layers,
                    showGhostKeys: true,
                  }).svg;
                } catch {
                  return "";
                }
              })()}
            />
            <Action.Open
              title="Open Vial"
              target="vial"
              shortcut={{ modifiers: ["cmd", "shift"], key: "v" }}
            />
            <Action.OpenInBrowser
              title="Open QMK Configurator"
              url={`https://config.qmk.fm/#/${board.keyboard}`}
              shortcut={{ modifiers: ["cmd", "shift"], key: "q" }}
            />
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}
