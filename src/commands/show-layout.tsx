import { Action, ActionPanel, Detail, environment, getPreferenceValues, Icon } from "@raycast/api";
import { useEffect, useState } from "react";
import { BoardProfile } from "../lib/types";
import { getActiveBoard } from "../lib/storage/active-board";
import { getBoards } from "../lib/storage/boards";
import { setActiveBoardId } from "../lib/storage/active-board";
import { generateSvg } from "../lib/svg/renderer";
import AddBoardCommand from "./add-board";

interface Preferences {
  theme?: string;
  defaultView?: "both" | "left" | "right";
}

export default function ShowLayoutCommand() {
  const [board, setBoard] = useState<BoardProfile | undefined>();
  const [allBoards, setAllBoards] = useState<BoardProfile[]>([]);
  const [focusLayer, setFocusLayer] = useState<number | null>(null);
  const [splitView, setSplitView] = useState<"both" | "left" | "right">(
    (getPreferenceValues<Preferences>().defaultView as "both" | "left" | "right") || "both"
  );
  const [isLoading, setIsLoading] = useState(true);
  const [noBoards, setNoBoards] = useState(false);
  const prefs = getPreferenceValues<Preferences>();

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

  // Show single layer (page mode) or all layers (stacked)
  const showAll = focusLayer === null;
  const currentLayer = focusLayer ?? 0;
  let markdown = "";

  if (showAll) {
    // Stacked: render all layers with headers
    for (const l of board.layers) {
      try {
        const result = generateSvg(board.physicalLayout, {
          appearance, theme: prefs.theme,
          layerIndex: l.index, layers: board.layers,
          showGhostKeys: true, splitView,
        });
        markdown += `### ${l.name}\n\n![${l.name}](${result.filePath}?raycast-width=${result.width})\n\n`;
      } catch (e) {
        markdown += `### ${l.name}\n\n*Error: ${e instanceof Error ? e.message : "unknown"}*\n\n`;
      }
    }
  } else {
    // Single layer page mode
    const layer = board.layers[currentLayer];
    try {
      const result = generateSvg(board.physicalLayout, {
        appearance, theme: prefs.theme,
        layerIndex: currentLayer, layers: board.layers,
        showGhostKeys: true, splitView,
      });
      markdown = `![${layer?.name}](${result.filePath}?raycast-width=${result.width})`;
    } catch (e) {
      markdown = `*Error: ${e instanceof Error ? e.message : "unknown"}*`;
    }
  }

  const layer = board.layers[currentLayer];
  const navTitle = showAll
    ? `${board.name} — All Layers`
    : `${board.name} — ${layer?.name} (${currentLayer + 1}/${board.layers.length})`;

  return (
    <Detail
      navigationTitle={navTitle}
      markdown={markdown}
      isLoading={isLoading}
      actions={
        <ActionPanel>
          <ActionPanel.Section title="Layers">
            <Action
              title={showAll ? "Focus Base Layer" : "Show All Layers"}
              icon={showAll ? Icon.Window : Icon.List}
              shortcut={{ modifiers: ["cmd"], key: "0" }}
              onAction={() => setFocusLayer(showAll ? 0 : null)}
            />
            <Action
              title="Next Layer"
              shortcut={{ modifiers: ["cmd"], key: "]" }}
              onAction={() => setFocusLayer(Math.min((focusLayer ?? -1) + 1, board.layers.length - 1))}
            />
            <Action
              title="Previous Layer"
              shortcut={{ modifiers: ["cmd"], key: "[" }}
              onAction={() => {
                if (focusLayer === null || focusLayer === 0) setFocusLayer(null);
                else setFocusLayer(focusLayer - 1);
              }}
            />
            {board.layers.map((l) => (
              <Action
                key={l.index}
                title={l.name}
                shortcut={{ modifiers: ["cmd"], key: String(l.index + 1) as "1" }}
                onAction={() => setFocusLayer(l.index)}
              />
            ))}
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
          <ActionPanel.Section title="Split View">
            <Action
              title="Show Both Halves"
              icon={Icon.AppWindowGrid2x2}
              shortcut={{ modifiers: ["cmd", "shift"], key: "b" }}
              onAction={() => setSplitView("both")}
            />
            <Action
              title="Show Left Half"
              icon={Icon.ArrowLeft}
              shortcut={{ modifiers: ["cmd"], key: "arrowLeft" }}
              onAction={() => setSplitView("left")}
            />
            <Action
              title="Show Right Half"
              icon={Icon.ArrowRight}
              shortcut={{ modifiers: ["cmd"], key: "arrowRight" }}
              onAction={() => setSplitView("right")}
            />
          </ActionPanel.Section>
          <ActionPanel.Section title="Actions">
            <Action.Push
              title="Add Board"
              icon={Icon.Plus}
              target={<AddBoardCommand />}
              shortcut={{ modifiers: ["cmd"], key: "n" }}
            />
            <Action.ShowInFinder
              title="Open SVG in Viewer"
              path={(() => {
                try {
                  return generateSvg(board.physicalLayout, {
                    appearance,
                    theme: prefs.theme,
                    layerIndex: currentLayer,
                    layers: board.layers,
                    showGhostKeys: true,
                    splitView,
                  }).filePath;
                } catch {
                  return "";
                }
              })()}
              shortcut={{ modifiers: ["cmd", "shift"], key: "o" }}
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
