import { Icon, MenuBarExtra, open } from "@raycast/api";
import { useEffect, useState } from "react";
import { BoardProfile } from "../lib/types";
import { getActiveBoard } from "../lib/storage/active-board";
import { getBoards } from "../lib/storage/boards";
import { setActiveBoardId } from "../lib/storage/active-board";
import { readMatrixState } from "../lib/protocol";
import { getLayerKeys } from "../lib/layer-detect";
import { getFirmwareConfig } from "../lib/firmware/config";

export default function LayerIndicatorCommand() {
  const [board, setBoard] = useState<BoardProfile>();
  const [allBoards, setAllBoards] = useState<BoardProfile[]>([]);
  const [activeLayer, setActiveLayer] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  async function load() {
    const [active, boards] = await Promise.all([getActiveBoard(), getBoards()]);
    setBoard(active);
    setAllBoards(boards);
    setIsLoading(false);
  }

  // Try to detect active layer by polling matrix state
  async function pollLayerState() {
    if (!board) return;
    const fwConfig = getFirmwareConfig(board.firmware);
    if (!fwConfig.hasMatrixState) return;

    try {
      const state = await readMatrixState();
      setIsConnected(true);

      if (state.pressed.length === 0) {
        setActiveLayer(0);
        return;
      }

      // Check if any pressed keys match layer activation keycodes
      const layerKeys = getLayerKeys(board);
      // The matrix state gives us row,col. We need to map that to physical key indices.
      // For Vial boards, the physical keys have matrix positions embedded in the definition.
      // Since we store ordered-by-physical keycodes, we need the reverse mapping.
      // For now, use a simpler heuristic: if layer keys exist and keys are pressed,
      // check by matching the matrix positions from the Vial definition.

      // TODO: Store matrix-to-physical mapping in BoardProfile for proper lookup
      // For now, just show that we can detect key presses
      let detectedLayer = 0;
      for (const lk of layerKeys) {
        // Check if any pressed row,col might correspond to this layer key
        // This is approximate without the matrix mapping
        if (state.pressed.length > 0 && lk.targetLayer > detectedLayer) {
          detectedLayer = lk.targetLayer;
        }
      }

      // Only update if we actually detected a held layer key
      if (state.pressed.length > 0 && layerKeys.length > 0) {
        // For now, show base layer when keys are pressed but we can't
        // definitively map to a layer key
        setActiveLayer(0);
      }
    } catch {
      setIsConnected(false);
      // Board not connected — just show last known layer
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!board) return;

    // Initial poll
    pollLayerState();

    // Poll every 500ms when board is available
    const interval = setInterval(pollLayerState, 500);
    return () => clearInterval(interval);
  }, [board?.id]);

  async function switchBoard(b: BoardProfile) {
    await setActiveBoardId(b.id);
    setBoard(b);
    setActiveLayer(0);
    setIsConnected(false);
  }

  if (!board) {
    return (
      <MenuBarExtra icon={Icon.Keyboard} title="No Board" isLoading={isLoading}>
        <MenuBarExtra.Item
          title="No board configured"
          subtitle="Use Add Board to get started"
        />
      </MenuBarExtra>
    );
  }

  const layerName = board.layers[activeLayer]?.name ?? `Layer ${activeLayer}`;

  return (
    <MenuBarExtra
      icon={Icon.Keyboard}
      title={layerName}
      tooltip={`${board.name} — ${layerName}${isConnected ? " (USB)" : ""}`}
      isLoading={isLoading}
    >
      <MenuBarExtra.Section title={board.name}>
        <MenuBarExtra.Item title="Keyboard" subtitle={board.keyboard} />
        <MenuBarExtra.Item
          title="Firmware"
          subtitle={getFirmwareConfig(board.firmware).displayName}
        />
        <MenuBarExtra.Item
          title="Connection"
          subtitle={isConnected ? "Connected (USB)" : "Not connected"}
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
          title="View Full Layout"
          onAction={() =>
            open(
              "raycast://extensions/alliecatowo/keyboard-layout-visualizer/show-layout",
            )
          }
        />
        <MenuBarExtra.Item
          title={getFirmwareConfig(board.firmware).configuratorLabel}
          onAction={() =>
            open(getFirmwareConfig(board.firmware).configuratorUrl)
          }
        />
      </MenuBarExtra.Section>
    </MenuBarExtra>
  );
}
