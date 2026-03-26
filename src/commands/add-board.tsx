import {
  Action,
  ActionPanel,
  Icon,
  List,
  showToast,
  Toast,
  useNavigation,
} from "@raycast/api";
import { useEffect, useState } from "react";
import {
  detectAll,
  getAdapterForDevice,
  type DetectedDevice as FwDevice,
} from "../lib/firmware";
import { saveBoard } from "../lib/storage/boards";
import { setActiveBoardId } from "../lib/storage/active-board";
import BoardDetailView from "./board-detail-view";
import ImportKeymapCommand from "./import-keymap";
import ImportGitHubCommand from "./import-github";

type DetectedDevice = FwDevice & { product?: string };

export default function AddBoardCommand() {
  const { push } = useNavigation();
  const [devices, setDevices] = useState<DetectedDevice[]>([]);
  const [isScanning, setIsScanning] = useState(true);
  const [isReading, setIsReading] = useState(false);

  async function scan() {
    setIsScanning(true);
    try {
      const found = await detectAll();
      setDevices(found);
    } catch {
      // Silent fail — just show empty list with import option
    } finally {
      setIsScanning(false);
    }
  }

  useEffect(() => {
    scan();
  }, []);

  async function handleReadBoard(device: DetectedDevice) {
    setIsReading(true);
    const adapter = getAdapterForDevice(device);
    const toast = await showToast({
      style: Toast.Style.Animated,
      title: "Reading keyboard...",
      message: device.name || device.product,
    });

    try {
      if (!adapter)
        throw new Error(`No adapter for firmware: ${device.firmware}`);
      const board = await adapter.readBoard(device);

      await saveBoard(board);
      await setActiveBoardId(board.id);

      toast.hide();
      await showToast({
        style: Toast.Style.Success,
        title: "Board added!",
        message: board.name,
      });
      push(<BoardDetailView board={board} />);
    } catch (e) {
      toast.hide();
      showToast({
        style: Toast.Style.Failure,
        title: "Failed to read board",
        message: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setIsReading(false);
    }
  }

  return (
    <List
      isLoading={isScanning || isReading}
      navigationTitle="Add Board"
      searchBarPlaceholder="Scanning for keyboards..."
    >
      {devices.length > 0 && (
        <List.Section
          title="Detected Keyboards"
          subtitle="Plug in your board and press Enter"
        >
          {devices.map((device) => (
            <List.Item
              key={device.path}
              icon={Icon.Keyboard}
              title={device.name || device.product || "Keyboard"}
              subtitle={device.firmware.toUpperCase()}
              accessories={[{ text: device.manufacturer }]}
              actions={
                <ActionPanel>
                  <Action
                    title="Read and Add Board"
                    icon={Icon.Download}
                    onAction={() => handleReadBoard(device)}
                  />
                  <Action
                    title="Scan Again"
                    icon={Icon.ArrowClockwise}
                    onAction={scan}
                  />
                </ActionPanel>
              }
            />
          ))}
        </List.Section>
      )}

      {!isScanning && devices.length === 0 && (
        <List.Section title="No Keyboards Detected">
          <List.Item
            icon={Icon.ExclamationMark}
            title="No Vial or ZMK Studio boards found"
            subtitle="Make sure your board is plugged in via USB"
          />
          <List.Item
            icon={Icon.ArrowClockwise}
            title="Scan Again"
            actions={
              <ActionPanel>
                <Action
                  title="Scan"
                  icon={Icon.ArrowClockwise}
                  onAction={scan}
                />
              </ActionPanel>
            }
          />
        </List.Section>
      )}

      <List.Section
        title={devices.length > 0 ? "Other Options" : "Import Instead"}
      >
        <List.Item
          icon={Icon.Document}
          title="Import from File"
          subtitle="QMK keymap.json or ZMK .keymap"
          actions={
            <ActionPanel>
              <Action.Push
                title="Import File"
                icon={Icon.Document}
                target={<ImportKeymapCommand />}
              />
            </ActionPanel>
          }
        />
        <List.Item
          icon={Icon.Globe}
          title="Import from GitHub"
          subtitle="Browse a public repo for your keymap"
          actions={
            <ActionPanel>
              <Action.Push
                title="Import from GitHub"
                icon={Icon.Globe}
                target={<ImportGitHubCommand />}
              />
            </ActionPanel>
          }
        />
      </List.Section>
    </List>
  );
}
