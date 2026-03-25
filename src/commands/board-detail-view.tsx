import { Action, ActionPanel, Detail, environment, Icon } from "@raycast/api";
import { useState } from "react";
import { BoardProfile } from "../lib/types";
import { generateSvg } from "../lib/svg/renderer";
import ImportKeymapCommand from "./import-keymap";

export default function BoardDetailView({ board }: { board: BoardProfile }) {
  const [layerIndex, setLayerIndex] = useState(0);
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
    markdown = `# Error\n\n${e instanceof Error ? e.message : "Could not render layout"}`;
  }

  return (
    <Detail
      navigationTitle={`${board.name} — ${layer?.name ?? `Layer ${layerIndex}`}`}
      markdown={markdown}
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
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}
