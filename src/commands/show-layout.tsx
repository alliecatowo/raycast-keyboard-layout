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
  // Start on layer 0 (single layer page view) — NOT the "all layers" stacked view
  const [currentLayer, setCurrentLayer] = useState(0);
  const [splitView, setSplitView] = useState<"both" | "left" | "right">(
    (getPreferenceValues<Preferences>().defaultView as "both" | "left" | "right") || "both",
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
        markdown="# Welcome to Keyboard Layout Visualizer\n\nNo boards loaded yet.\n\n**Plug in your keyboard** and add it — supports Vial and ZMK Studio, or import a keymap file."
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
    setCurrentLayer(0);
  }

  function nextLayer() {
    setCurrentLayer((i) => (i + 1) % board.layers.length);
  }

  function prevLayer() {
    setCurrentLayer((i) => (i - 1 + board.layers.length) % board.layers.length);
  }

  const appearance = environment.appearance;
  const layer = board.layers[currentLayer];

  let markdown = "";
  try {
    const result = generateSvg(board.physicalLayout, {
      appearance,
      theme: prefs.theme,
      layerIndex: currentLayer,
      layers: board.layers,
      showGhostKeys: true,
      splitView,
    });
    markdown = `![${layer?.name}](${result.filePath}?raycast-width=${result.width})`;
  } catch (e) {
    markdown = `*Error: ${e instanceof Error ? e.message : "unknown"}*`;
  }

  const navTitle = `${board.name} — ${layer?.name} (${currentLayer + 1}/${board.layers.length})`;

  return (
    <Detail
      navigationTitle={navTitle}
      markdown={markdown}
      isLoading={isLoading}
      actions={
        <ActionPanel>
          {/* Primary action = Enter = Next Layer. This is what you do most. */}
          <Action title="Next Layer →" icon={Icon.ChevronRight} onAction={nextLayer} />
          <Action
            title="← Previous Layer"
            icon={Icon.ChevronLeft}
            shortcut={{ modifiers: ["cmd"], key: "[" }}
            onAction={prevLayer}
          />
          <Action
            title="Next Layer →"
            shortcut={{ modifiers: ["cmd"], key: "]" }}
            onAction={nextLayer}
          />

          <ActionPanel.Section title="Jump to Layer">
            {board.layers.map((l) => (
              <Action
                key={l.index}
                title={`${l.name}${l.index === currentLayer ? " ●" : ""}`}
                shortcut={{ modifiers: ["cmd"], key: String(l.index + 1) as "1" }}
                onAction={() => setCurrentLayer(l.index)}
              />
            ))}
          </ActionPanel.Section>

          <ActionPanel.Section title="View">
            <Action
              title={splitView === "both" ? "Show Left Half" : splitView === "left" ? "Show Right Half" : "Show Both Halves"}
              icon={splitView === "both" ? Icon.ArrowLeft : splitView === "left" ? Icon.ArrowRight : Icon.AppWindowGrid2x2}
              shortcut={{ modifiers: ["cmd", "shift"], key: "h" }}
              onAction={() => {
                if (splitView === "both") setSplitView("left");
                else if (splitView === "left") setSplitView("right");
                else setSplitView("both");
              }}
            />
          </ActionPanel.Section>

          {allBoards.length > 1 && (
            <ActionPanel.Section title="Board">
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

          <ActionPanel.Section>
            <Action.Push title="Add Board" icon={Icon.Plus} target={<AddBoardCommand />} shortcut={{ modifiers: ["cmd"], key: "n" }} />
            <Action.ShowInFinder
              title="Open SVG in Viewer"
              path={(() => {
                try {
                  return generateSvg(board.physicalLayout, {
                    appearance, theme: prefs.theme,
                    layerIndex: currentLayer, layers: board.layers,
                    showGhostKeys: true, splitView,
                  }).filePath;
                } catch { return ""; }
              })()}
              shortcut={{ modifiers: ["cmd", "shift"], key: "o" }}
            />
            <Action.Open title="Open Vial" target="vial" shortcut={{ modifiers: ["cmd", "shift"], key: "v" }} />
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}
