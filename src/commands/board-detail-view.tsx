import { Action, ActionPanel, Detail, environment, Icon } from "@raycast/api";
import { useState } from "react";
import { BoardProfile } from "../lib/types";
import { generateSvg } from "../lib/svg/renderer";
import { getFirmwareConfig } from "../lib/firmware/config";
import AddBoardCommand from "./add-board";

export default function BoardDetailView({ board }: { board: BoardProfile }) {
  const [layerIndex, setLayerIndex] = useState(0);
  const appearance = environment.appearance;
  const layer = board.layers[layerIndex];
  const fwConfig = getFirmwareConfig(board.firmware);

  let markdown = `### ${layer?.name}\n\n`;
  try {
    const result = generateSvg(board.physicalLayout, {
      appearance,
      layerIndex,
      layers: board.layers,
      showGhostKeys: true,
    });
    markdown += `![${layer?.name ?? "Layout"}](${result.filePath}?raycast-width=${result.width})`;
  } catch (e) {
    markdown += `*Error: ${e instanceof Error ? e.message : "Could not render layout"}*`;
  }

  const navTitle = `${board.name} — ${layer?.name} (${layerIndex + 1}/${board.layers.length})`;

  return (
    <Detail
      navigationTitle={navTitle}
      markdown={markdown}
      actions={
        <ActionPanel>
          <Action
            title="Next Layer →"
            icon={Icon.ChevronRight}
            onAction={() => setLayerIndex((i) => (i + 1) % board.layers.length)}
          />
          <Action
            title="← Previous Layer"
            icon={Icon.ChevronLeft}
            shortcut={{ modifiers: ["cmd"], key: "[" }}
            onAction={() =>
              setLayerIndex(
                (i) => (i - 1 + board.layers.length) % board.layers.length,
              )
            }
          />
          <Action
            title="Next Layer →"
            shortcut={{ modifiers: ["cmd"], key: "]" }}
            onAction={() => setLayerIndex((i) => (i + 1) % board.layers.length)}
          />

          <ActionPanel.Section title="Jump to Layer">
            {board.layers.map((l) => (
              <Action
                key={l.index}
                title={`${l.name}${l.index === layerIndex ? " ●" : ""}`}
                shortcut={{
                  modifiers: ["cmd"],
                  key: String(l.index + 1) as "1",
                }}
                onAction={() => setLayerIndex(l.index)}
              />
            ))}
          </ActionPanel.Section>

          <ActionPanel.Section>
            <Action.Push
              title="Add Board"
              icon={Icon.Plus}
              target={<AddBoardCommand />}
              shortcut={{ modifiers: ["cmd"], key: "n" }}
            />
            <Action.OpenInBrowser
              title={fwConfig.configuratorLabel}
              url={fwConfig.configuratorUrl}
              shortcut={{ modifiers: ["cmd", "shift"], key: "v" }}
            />
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}
