import {
  Action,
  ActionPanel,
  Detail,
  environment,
  getPreferenceValues,
  Icon,
} from "@raycast/api";
import { useEffect, useState } from "react";
import { BoardProfile } from "../lib/types";
import { getActiveBoard } from "../lib/storage/active-board";
import { getBoards } from "../lib/storage/boards";
import { setActiveBoardId } from "../lib/storage/active-board";
import { generateSvg } from "../lib/svg/renderer";
import { computeKeyColors, RgbState } from "../lib/svg/rgb-effects";
import {
  readBoardSettings,
  readKeymapHash,
  readVialKeyboard,
} from "../lib/vial/client";
import { getFirmwareConfig } from "../lib/firmware/config";
import AddBoardCommand from "./add-board";

interface Preferences {
  theme?: string;
  defaultView?: "both" | "left" | "right";
}

export default function ShowLayoutCommand() {
  const [board, setBoard] = useState<BoardProfile | undefined>();
  const [allBoards, setAllBoards] = useState<BoardProfile[]>([]);
  const [currentLayer, setCurrentLayer] = useState(0);
  const [showAll, setShowAll] = useState(true);
  const [splitView, setSplitView] = useState<"both" | "left" | "right">(
    (getPreferenceValues<Preferences>().defaultView as
      | "both"
      | "left"
      | "right") || "both",
  );
  const [isLoading, setIsLoading] = useState(true);
  const [noBoards, setNoBoards] = useState(false);
  const [rgbEnabled, setRgbEnabled] = useState(false);
  const [rgbState, setRgbState] = useState<RgbState | null>(null);
  const prefs = getPreferenceValues<Preferences>();

  useEffect(() => {
    async function load() {
      try {
        const [active, boards] = await Promise.all([
          getActiveBoard(),
          getBoards(),
        ]);
        setAllBoards(boards);
        if (!active) {
          setNoBoards(true);
          return;
        }
        setBoard(active);

        // Try to read RGB state if board supports it
        const fwConfig = getFirmwareConfig(active.firmware);
        if (fwConfig.hasRgbControl) {
          try {
            const data = await readBoardSettings();
            if (data.rgb) {
              setRgbState({
                mode: data.rgb.effect,
                hue: data.rgb.hue,
                saturation: data.rgb.saturation,
                brightness: data.rgb.brightness,
                speed: data.rgb.speed,
              });
            }
          } catch {
            /* board not connected, that's ok */
          }
        }
      } catch {
        setNoBoards(true);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  // Live keymap sync: poll for changes every 5s when board is connected
  useEffect(() => {
    if (!board) return;
    const fwConfig = getFirmwareConfig(board.firmware);
    if (!fwConfig.hasUsbKeymap) return;

    let lastHash = "";
    const interval = setInterval(async () => {
      try {
        if (board.firmware === "zmk") {
          // ZMK: use check_unsaved_changes
          // For now, skip — needs port path stored in board profile
        } else {
          // Vial: use keymap hash
          const { hash } = await readKeymapHash();
          if (lastHash && hash !== lastHash) {
            const updated = await readVialKeyboard();
            setBoard(updated);
          }
          lastHash = hash;
        }
      } catch {
        // Board disconnected — stop polling silently
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [board?.id]);

  if (noBoards && !isLoading) {
    return (
      <Detail
        markdown={[
          "# Keyboard Layout Visualizer",
          "",
          "No boards loaded yet. Here's how to get started:",
          "",
          "### USB Detection (recommended)",
          "1. Plug in your **Vial** or **ZMK Studio** keyboard",
          "2. Press Enter to **Add Board** — it'll auto-detect over USB",
          "",
          "### File Import",
          "- Import a QMK `keymap.json` from QMK Configurator",
          "- Import a ZMK `.keymap` from your config repo",
          "- Or browse a public GitHub repo for your keymap",
          "",
          "### No custom keyboard?",
          "This extension is designed for programmable keyboards with",
          "multiple layers (QMK, ZMK, Vial). Standard keyboards don't",
          "have layers to visualize — but if you're thinking about",
          "getting into the hobby, check out [r/ErgoMechKeyboards](https://reddit.com/r/ErgoMechKeyboards)!",
        ].join("\n")}
        actions={
          <ActionPanel>
            <Action.Push
              title="Add Board"
              icon={Icon.Plus}
              target={<AddBoardCommand />}
            />
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
    setShowAll(false);
    setCurrentLayer((i) => (i + 1) % board.layers.length);
  }

  function prevLayer() {
    setShowAll(false);
    setCurrentLayer((i) => (i - 1 + board.layers.length) % board.layers.length);
  }

  const appearance = environment.appearance;

  // Compute RGB colors if enabled
  const rgbColors =
    rgbEnabled && rgbState
      ? computeKeyColors(
          rgbState,
          board.physicalLayout.map((k) => ({ x: k.x, y: k.y })),
        )
      : undefined;

  let markdown = "";

  if (showAll) {
    for (const l of board.layers) {
      try {
        const result = generateSvg(board.physicalLayout, {
          appearance,
          theme: prefs.theme,
          layerIndex: l.index,
          layers: board.layers,
          showGhostKeys: true,
          splitView,
        });
        markdown += `### ${l.name}\n\n![${l.name}](${result.filePath}?raycast-width=${result.width})\n\n`;
      } catch (e) {
        markdown += `### ${l.name}\n\n*Error: ${e instanceof Error ? e.message : "unknown"}*\n\n`;
      }
    }
  } else {
    const layer = board.layers[currentLayer];
    try {
      const result = generateSvg(board.physicalLayout, {
        appearance,
        theme: prefs.theme,
        layerIndex: currentLayer,
        layers: board.layers,
        showGhostKeys: true,
        splitView,
      });
      markdown = `### ${layer?.name}\n\n![${layer?.name}](${result.filePath}?raycast-width=${result.width})`;
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
          {/* Primary action = Enter = Next Layer. This is what you do most. */}
          <Action
            title="Next Layer →"
            icon={Icon.ChevronRight}
            onAction={nextLayer}
          />
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
            <Action
              title={showAll ? "Exit All Layers View" : "Show All Layers"}
              icon={Icon.List}
              shortcut={{ modifiers: ["cmd"], key: "0" }}
              onAction={() => setShowAll(!showAll)}
            />
            {board.layers.map((l) => (
              <Action
                key={l.index}
                title={`${l.name}${!showAll && l.index === currentLayer ? " ●" : ""}`}
                shortcut={{
                  modifiers: ["cmd"],
                  key: String(l.index + 1) as "1",
                }}
                onAction={() => {
                  setShowAll(false);
                  setCurrentLayer(l.index);
                }}
              />
            ))}
          </ActionPanel.Section>

          <ActionPanel.Section title="View">
            {rgbState && (
              <Action
                title={rgbEnabled ? "Hide RGB Effect" : "Show RGB Effect"}
                icon={Icon.LightBulb}
                shortcut={{ modifiers: ["cmd", "shift"], key: "l" }}
                onAction={() => setRgbEnabled(!rgbEnabled)}
              />
            )}
            <Action
              title={
                splitView === "both"
                  ? "Show Left Half"
                  : splitView === "left"
                    ? "Show Right Half"
                    : "Show Both Halves"
              }
              icon={
                splitView === "both"
                  ? Icon.ArrowLeft
                  : splitView === "left"
                    ? Icon.ArrowRight
                    : Icon.AppWindowGrid2x2
              }
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
                    rgbColors,
                  }).filePath;
                } catch {
                  return "";
                }
              })()}
              shortcut={{ modifiers: ["cmd", "shift"], key: "o" }}
            />
            <Action.OpenInBrowser
              title={getFirmwareConfig(board.firmware).configuratorLabel}
              url={getFirmwareConfig(board.firmware).configuratorUrl}
              shortcut={{ modifiers: ["cmd", "shift"], key: "v" }}
            />
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}
