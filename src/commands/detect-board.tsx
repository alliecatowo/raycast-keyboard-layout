import { Action, ActionPanel, Detail, Icon, List, showToast, Toast, useNavigation } from "@raycast/api";
import { useEffect, useState } from "react";
import { detectAllDevices, readVialKeyboard, readZmkKeyboard } from "../lib/vial/client";
import { saveBoard } from "../lib/storage/boards";
import { setActiveBoardId } from "../lib/storage/active-board";
import BoardDetailView from "./board-detail-view";
import ImportKeymapCommand from "./import-keymap";

interface DetectedDevice {
  path: string;
  manufacturer: string;
  product: string;
  name?: string;
  vendorId: number | string;
  productId: number | string;
  firmware?: string;
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
      const found = await detectAllDevices();
      setDevices(found);
      if (found.length === 0) {
        setError("No keyboards detected. Make sure your board is plugged in and has Vial or ZMK Studio firmware.");
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

  async function handleReadBoard(device: DetectedDevice) {
    setIsReading(true);
    const isZmk = device.firmware === "zmk";
    const toast = await showToast({
      style: Toast.Style.Animated,
      title: "Reading keyboard...",
      message: `Fetching keymap over ${isZmk ? "serial" : "USB HID"}`,
    });

    try {
      const board = isZmk
        ? await readZmkKeyboard(device.path)
        : await readVialKeyboard(device.path);

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
        markdown={`# Detect Keyboard\n\n${error}\n\n**Troubleshooting:**\n- Is your keyboard plugged in via USB?\n- **Vial boards**: Must have Vial firmware ([get.vial.today](https://get.vial.today))\n- **ZMK boards**: Must have ZMK Studio enabled in firmware\n- Try unplugging and replugging the cable\n\nYou can also import a keymap file manually.`}
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
          title={device.name || device.product}
          subtitle={`${device.manufacturer}${device.firmware ? ` (${device.firmware.toUpperCase()})` : ""}`}
          accessories={[
            { text: `${String(device.vendorId)}:${String(device.productId)}` },
          ]}
          actions={
            <ActionPanel>
              <Action
                title="Read Keymap"
                icon={Icon.Download}
                onAction={() => handleReadBoard(device)}
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
