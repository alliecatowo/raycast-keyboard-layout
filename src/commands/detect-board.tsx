import { Action, ActionPanel, Detail, Icon, List, showToast, Toast, useNavigation } from "@raycast/api";
import { useEffect, useState } from "react";
import { detectVialDevices, readVialKeyboard } from "../lib/vial/client";
import { saveBoard } from "../lib/storage/boards";
import { setActiveBoardId } from "../lib/storage/active-board";
import BoardDetailView from "./board-detail-view";
import ImportKeymapCommand from "./import-keymap";

interface DetectedDevice {
  path: string;
  manufacturer: string;
  product: string;
  vendorId: number;
  productId: number;
}

export default function DetectBoardCommand() {
  const { push } = useNavigation();
  const [devices, setDevices] = useState<DetectedDevice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isReading, setIsReading] = useState(false);
  const [error, setError] = useState<string>();

  async function scan() {
    setIsLoading(true);
    setError(undefined);
    try {
      const found = await detectVialDevices();
      setDevices(found);
      if (found.length === 0) {
        setError("No Vial keyboards detected. Make sure your board is plugged in and has Vial firmware.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to scan for devices");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    scan();
  }, []);

  async function handleReadBoard(devicePath?: string) {
    setIsReading(true);
    const toast = await showToast({
      style: Toast.Style.Animated,
      title: "Reading keyboard...",
      message: "Fetching keymap over USB",
    });

    try {
      const board = await readVialKeyboard(devicePath);

      await saveBoard(board);
      await setActiveBoardId(board.id);

      toast.hide();
      await showToast({
        style: Toast.Style.Success,
        title: "Board loaded!",
        message: board.name,
      });

      push(<BoardDetailView board={board} />);
    } catch (e) {
      toast.hide();
      const msg = e instanceof Error ? e.message : "Failed to read keyboard";
      showToast({ style: Toast.Style.Failure, title: "Read failed", message: msg });
    } finally {
      setIsReading(false);
    }
  }

  if (error && devices.length === 0) {
    return (
      <Detail
        isLoading={isLoading}
        markdown={`# Detect Keyboard\n\n${error}\n\n**Troubleshooting:**\n- Is your keyboard plugged in via USB?\n- Does your keyboard have Vial firmware? Check at [get.vial.today](https://get.vial.today)\n- Try unplugging and replugging the cable\n\nYou can also import a keymap file manually.`}
        actions={
          <ActionPanel>
            <Action title="Scan Again" icon={Icon.ArrowClockwise} onAction={scan} />
            <Action.Push title="Import File Instead" icon={Icon.Document} target={<ImportKeymapCommand />} />
          </ActionPanel>
        }
      />
    );
  }

  return (
    <List isLoading={isLoading || isReading} navigationTitle="Detect Keyboard">
      {devices.map((device) => (
        <List.Item
          key={device.path}
          icon={Icon.Keyboard}
          title={device.product}
          subtitle={device.manufacturer}
          accessories={[
            { text: `${device.vendorId.toString(16).padStart(4, "0")}:${device.productId.toString(16).padStart(4, "0")}` },
          ]}
          actions={
            <ActionPanel>
              <Action
                title="Read Keymap"
                icon={Icon.Download}
                onAction={() => handleReadBoard(device.path)}
              />
              <Action title="Scan Again" icon={Icon.ArrowClockwise} onAction={scan} />
              <Action.Push title="Import File Instead" icon={Icon.Document} target={<ImportKeymapCommand />} />
            </ActionPanel>
          }
        />
      ))}

      {devices.length > 0 && (
        <List.Section title="Options">
          <List.Item
            icon={Icon.Document}
            title="Import from File Instead"
            subtitle="Use a QMK keymap.json file"
            actions={
              <ActionPanel>
                <Action.Push title="Import File" icon={Icon.Document} target={<ImportKeymapCommand />} />
              </ActionPanel>
            }
          />
        </List.Section>
      )}
    </List>
  );
}
