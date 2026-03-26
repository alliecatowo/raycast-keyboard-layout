import { Action, ActionPanel, Detail, environment, LaunchProps } from "@raycast/api";
import { useEffect, useState } from "react";
import { BoardProfile } from "../lib/types";
import { getActiveBoard } from "../lib/storage/active-board";
import { generateSvg } from "../lib/svg/renderer";

interface QuickLayerArgs {
  layer?: string;
}

export default function QuickLayerCommand(props: LaunchProps<{ arguments: QuickLayerArgs }>) {
  const requestedLayer = parseInt(props.arguments.layer ?? "0", 10) || 0;
  const [board, setBoard] = useState<BoardProfile>();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getActiveBoard().then((b) => {
      setBoard(b);
      setIsLoading(false);
    });
  }, []);

  if (!board) {
    return (
      <Detail
        isLoading={isLoading}
        markdown={isLoading ? "" : "# No Board\n\nImport a keymap first."}
      />
    );
  }

  const layerIndex = Math.min(requestedLayer, board.layers.length - 1);
  const layer = board.layers[layerIndex];
  const appearance = environment.appearance;

  let markdown = "";
  try {
    const result = generateSvg(board.physicalLayout, {
      appearance,
      layerIndex,
      layers: board.layers,
      showGhostKeys: true,
    });
    markdown = `![${layer?.name}](${result.filePath}?raycast-width=${result.width})`;
  } catch (e) {
    markdown = `Error: ${e instanceof Error ? e.message : "Unknown"}`;
  }

  return (
    <Detail
      navigationTitle={`${board.name} — ${layer?.name}`}
      markdown={markdown}
      actions={
        <ActionPanel>
          <Action.CopyToClipboard
            title="Copy SVG"
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
        </ActionPanel>
      }
    />
  );
}
