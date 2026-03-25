import { Action, ActionPanel, Detail, environment } from "@raycast/api";
import { useEffect, useState } from "react";
import { BoardProfile } from "../lib/types";
import { getActiveBoard } from "../lib/storage/active-board";
import { generateSvg } from "../lib/svg/renderer";

export default function ShowLayoutCommand() {
  const [board, setBoard] = useState<BoardProfile | undefined>();
  const [layerIndex, setLayerIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    async function load() {
      try {
        const active = await getActiveBoard();
        if (!active) {
          setError("No boards imported yet. Use **Import Keymap** to add your first board.");
          return;
        }
        setBoard(active);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load board");
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  if (error) {
    return (
      <Detail
        markdown={`# No Keymap Found\n\n${error}\n\nUse the **Import Keymap** command to get started.`}
      />
    );
  }

  if (!board) {
    return <Detail isLoading={isLoading} markdown="" />;
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
          <ActionPanel.Section>
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
            <Action.OpenInBrowser
              title="Open QMK Configurator"
              url={`https://config.qmk.fm/#/${board.keyboard.replace("/", "/")}`}
              shortcut={{ modifiers: ["cmd", "shift"], key: "q" }}
            />
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}
