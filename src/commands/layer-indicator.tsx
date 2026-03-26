import { Icon, MenuBarExtra, open } from "@raycast/api";
import { useEffect, useState } from "react";
import { BoardProfile } from "../lib/types";
import { getActiveBoard } from "../lib/storage/active-board";
import { getBoards } from "../lib/storage/boards";
import { setActiveBoardId } from "../lib/storage/active-board";

/**
 * Menu bar command showing current board + layer info.
 *
 * For now shows the active board and lets you switch.
 * When we add matrix state polling, this will show the
 * currently active layer in real-time.
 */
export default function LayerIndicatorCommand() {
  const [board, setBoard] = useState<BoardProfile>();
  const [allBoards, setAllBoards] = useState<BoardProfile[]>([]);
  const [activeLayer, setActiveLayer] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  async function load() {
    const [active, boards] = await Promise.all([getActiveBoard(), getBoards()]);
    setBoard(active);
    setAllBoards(boards);
    setIsLoading(false);
  }

  useEffect(() => {
    load();
    // Refresh every 30s to pick up changes from other commands
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  async function switchBoard(b: BoardProfile) {
    await setActiveBoardId(b.id);
    setBoard(b);
    setActiveLayer(0);
  }

  if (!board) {
    return (
      <MenuBarExtra
        icon={Icon.Keyboard}
        title="No Board"
        isLoading={isLoading}
      >
        <MenuBarExtra.Item
          title="No board configured"
          subtitle="Use Detect Keyboard or Import Keymap"
        />
      </MenuBarExtra>
    );
  }

  const layerName = board.layers[activeLayer]?.name ?? `Layer ${activeLayer}`;
  const title = `${layerName}`;

  return (
    <MenuBarExtra
      icon={Icon.Keyboard}
      title={title}
      tooltip={`${board.name} — ${layerName}`}
      isLoading={isLoading}
    >
      <MenuBarExtra.Section title={board.name}>
        <MenuBarExtra.Item
          title="Keyboard"
          subtitle={board.keyboard}
        />
        <MenuBarExtra.Item
          title="Firmware"
          subtitle={board.firmware.toUpperCase()}
        />
        <MenuBarExtra.Item
          title="Layers"
          subtitle={String(board.layers.length)}
        />
      </MenuBarExtra.Section>

      <MenuBarExtra.Section title="Layers">
        {board.layers.map((layer) => (
          <MenuBarExtra.Item
            key={layer.index}
            title={layer.name}
            subtitle={layer.index === activeLayer ? "● Active" : ""}
            onAction={() => setActiveLayer(layer.index)}
          />
        ))}
      </MenuBarExtra.Section>

      {allBoards.length > 1 && (
        <MenuBarExtra.Section title="Switch Board">
          {allBoards
            .filter((b) => b.id !== board.id)
            .map((b) => (
              <MenuBarExtra.Item
                key={b.id}
                title={b.name}
                subtitle={b.keyboard}
                onAction={() => switchBoard(b)}
              />
            ))}
        </MenuBarExtra.Section>
      )}

      <MenuBarExtra.Section>
        <MenuBarExtra.Item
          title="Open Vial"
          onAction={() => open("vial://", "com.vial.vial")}
        />
        <MenuBarExtra.Item
          title="View Full Layout"
          subtitle="⌘+Enter"
          onAction={() => {
            // Launch the show-layout command
            open("raycast://extensions/alliecatowo/keyboard-layout-visualizer/show-layout");
          }}
        />
      </MenuBarExtra.Section>
    </MenuBarExtra>
  );
}
