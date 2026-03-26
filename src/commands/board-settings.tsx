import { Action, ActionPanel, Color, Detail, Form, Icon, List, showToast, Toast, useNavigation } from "@raycast/api";
import { useEffect, useState } from "react";
import { readBoardSettings, writeBoardSetting, writeRgb, readLockStatus } from "../lib/vial/client";
import { getActiveBoard } from "../lib/storage/active-board";
import { updateBoard } from "../lib/storage/boards";
import { BoardProfile } from "../lib/types";

interface QmkSetting {
  name: string;
  tab: string;
  qsid: number;
  value: number;
  unit?: string;
  type?: string;
  min?: number;
  max?: number;
}

interface RgbValues {
  brightness: number;
  effect: number;
  speed: number;
  hue: number;
  saturation: number;
}

interface LockStatus {
  isLocked: boolean;
  unlockInProgress: boolean;
  unlockKeys: Array<{ row: number; col: number }>;
}

const RGB_EFFECTS = [
  "Off", "Solid", "Breathing", "Rainbow Mood", "Rainbow Swirl", "Snake",
  "Knight", "Christmas", "Static Gradient", "RGB Test", "Alternating",
  "Twinkle", "Hue Breathing", "Hue Pendulum", "Hue Wave", "Pixel Rain",
  "Pixel Flow", "Pixel Fractal",
];

export default function BoardSettingsCommand() {
  const { push } = useNavigation();
  const [board, setBoard] = useState<BoardProfile>();
  const [settings, setSettings] = useState<Record<number, QmkSetting>>({});
  const [rgb, setRgb] = useState<RgbValues | null>(null);
  const [lightingType, setLightingType] = useState("none");
  const [lockStatus, setLockStatus] = useState<LockStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    async function load() {
      try {
        const activeBoard = await getActiveBoard();
        if (!activeBoard) { setError("No board loaded. Add a board first."); return; }
        setBoard(activeBoard);

        const isVialCapable = activeBoard.firmware === "qmk" || activeBoard.firmware === "vial";
        const isViaCapable = isVialCapable || activeBoard.firmware === "via";

        if (isViaCapable) {
          try {
            const data = await readBoardSettings();
            setSettings(data.settings);
            setRgb(data.rgb);
            setLightingType(data.lightingType);
            setIsConnected(true);

            // Try lock status (Vial only)
            if (isVialCapable) {
              try {
                const lock = await readLockStatus();
                setLockStatus(lock);
              } catch { /* not critical */ }
            }
          } catch {
            // Board not connected — show stored info only
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load board");
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  if (error || !board) {
    return <Detail isLoading={isLoading} markdown={error ? `# Board Settings\n\n${error}` : ""} />;
  }

  // Group settings by tab
  const tabs = new Map<string, QmkSetting[]>();
  for (const s of Object.values(settings)) {
    const list = tabs.get(s.tab) ?? [];
    list.push(s);
    tabs.set(s.tab, list);
  }

  function firmwareLabel(): string {
    switch (board!.firmware) {
      case "vial": return "Vial (QMK)";
      case "via": return "VIA (QMK)";
      case "qmk": return "QMK (Vial)";
      case "zmk": return "ZMK";
      default: return board!.firmware.toUpperCase();
    }
  }

  return (
    <List isLoading={isLoading} navigationTitle={`${board.name} — Settings`}>
      {/* Board Status */}
      <List.Section title="Board Status">
        <List.Item
          icon={{ source: Icon.Keyboard, tintColor: isConnected ? Color.Green : Color.SecondaryText }}
          title={board.name}
          subtitle={board.keyboard}
          accessories={[
            { tag: { value: firmwareLabel(), color: isConnected ? Color.Green : Color.SecondaryText } },
            { text: isConnected ? "Connected" : "Not Connected" },
          ]}
        />
        {lockStatus && (
          <List.Item
            icon={lockStatus.isLocked ? Icon.Lock : Icon.LockUnlocked}
            title="Security"
            subtitle={lockStatus.isLocked ? "Board is LOCKED" : "Board is unlocked"}
            accessories={lockStatus.isLocked && lockStatus.unlockKeys.length > 0
              ? [{ text: `Hold ${lockStatus.unlockKeys.length} key(s) to unlock` }]
              : []
            }
          />
        )}
        <List.Item icon={Icon.Layers} title="Layers" subtitle={board.layers.map((l) => l.name).join(", ")} accessories={[{ text: String(board.layers.length) }]} />
      </List.Section>

      {/* Layer Names */}
      <List.Section title="Layer Names" subtitle="Press Enter to rename">
        {board.layers.map((l) => (
          <List.Item
            key={l.index}
            icon={Icon.Text}
            title={l.name}
            accessories={[{ tag: `Layer ${l.index}` }, { text: `${l.keycodes.length} keys` }]}
            actions={
              <ActionPanel>
                <Action title="Rename" icon={Icon.Pencil} onAction={() => push(
                  <RenameLayerForm board={board} layerIndex={l.index} currentName={l.name}
                    onSaved={(newName) => {
                      const updated = { ...board, layers: board.layers.map((layer) =>
                        layer.index === l.index ? { ...layer, name: newName } : layer
                      )};
                      updateBoard(updated);
                      setBoard(updated);
                    }}
                  />
                )} />
              </ActionPanel>
            }
          />
        ))}
      </List.Section>

      {/* RGB — display values prominently */}
      {rgb && (
        <List.Section title="RGB Lighting" subtitle={lightingType}>
          <List.Item
            icon={Icon.Sun}
            title="Brightness"
            accessories={[
              { tag: { value: `${Math.round((rgb.brightness / 255) * 100)}%`, color: Color.Yellow } },
              { text: `${rgb.brightness}/255` },
            ]}
            actions={
              <ActionPanel>
                <Action title="Edit RGB" icon={Icon.Pencil} onAction={() => push(
                  <EditRgbForm rgb={rgb} onSaved={(v) => setRgb(v)} />
                )} />
              </ActionPanel>
            }
          />
          <List.Item
            icon={Icon.Wand}
            title="Effect"
            accessories={[
              { tag: RGB_EFFECTS[rgb.effect] ?? `Mode ${rgb.effect}` },
              { text: `Speed: ${rgb.speed}` },
            ]}
          />
          <List.Item
            icon={Icon.EyeDropper}
            title="Color"
            accessories={[
              { tag: { value: `H:${rgb.hue}`, color: Color.Red } },
              { tag: { value: `S:${rgb.saturation}`, color: Color.Blue } },
            ]}
          />
        </List.Section>
      )}

      {/* QMK Settings by tab — values displayed as accessories */}
      {[...tabs.entries()].map(([tabName, tabSettings]) => (
        <List.Section key={tabName} title={tabName}>
          {tabSettings.map((s) => {
            const isBool = s.type === "bool";
            const displayValue = isBool
              ? (s.value ? "Enabled" : "Disabled")
              : `${s.value}${s.unit ? ` ${s.unit}` : ""}`;

            return (
              <List.Item
                key={s.qsid}
                icon={isBool
                  ? { source: s.value ? Icon.Checkmark : Icon.Circle, tintColor: s.value ? Color.Green : Color.SecondaryText }
                  : Icon.Gear
                }
                title={s.name}
                accessories={[
                  { tag: { value: displayValue, color: isBool ? (s.value ? Color.Green : Color.SecondaryText) : Color.Blue } },
                ]}
                actions={
                  <ActionPanel>
                    {isBool ? (
                      <Action
                        title={s.value ? "Disable" : "Enable"}
                        icon={s.value ? Icon.Circle : Icon.Checkmark}
                        onAction={async () => {
                          const newVal = s.value ? 0 : 1;
                          try {
                            await writeBoardSetting(s.qsid, newVal);
                            setSettings((prev) => ({ ...prev, [s.qsid]: { ...s, value: newVal } }));
                            showToast({ style: Toast.Style.Success, title: `${s.name}: ${newVal ? "Enabled" : "Disabled"}` });
                          } catch (e) {
                            showToast({ style: Toast.Style.Failure, title: "Failed", message: e instanceof Error ? e.message : "" });
                          }
                        }}
                      />
                    ) : (
                      <Action title="Edit" icon={Icon.Pencil} onAction={() => push(
                        <EditSettingForm setting={s} onSaved={() => {
                          readBoardSettings().then((data) => { setSettings(data.settings); setRgb(data.rgb); });
                        }} />
                      )} />
                    )}
                  </ActionPanel>
                }
              />
            );
          })}
        </List.Section>
      ))}

      {/* Show message if no USB settings available */}
      {!isConnected && Object.keys(settings).length === 0 && (
        <List.Section title="USB Settings">
          <List.Item
            icon={Icon.ExclamationMark}
            title="Board not connected"
            subtitle="Plug in your board to view and edit live settings"
          />
        </List.Section>
      )}
    </List>
  );
}

function EditSettingForm({ setting, onSaved }: { setting: QmkSetting; onSaved: () => void }) {
  const { pop } = useNavigation();
  return (
    <Form
      navigationTitle={`Edit: ${setting.name}`}
      actions={<ActionPanel><Action.SubmitForm title="Save" onSubmit={async (values: { value: string }) => {
        const val = parseInt(values.value, 10);
        if (isNaN(val)) { showToast({ style: Toast.Style.Failure, title: "Invalid value" }); return; }
        try {
          await writeBoardSetting(setting.qsid, val);
          showToast({ style: Toast.Style.Success, title: `${setting.name} = ${val}${setting.unit ? ` ${setting.unit}` : ""}` });
          onSaved();
          pop();
        } catch (e) { showToast({ style: Toast.Style.Failure, title: "Failed", message: e instanceof Error ? e.message : "" }); }
      }} /></ActionPanel>}
    >
      <Form.TextField id="value" title={setting.name} defaultValue={String(setting.value)}
        info={[setting.unit && `Unit: ${setting.unit}`, setting.min !== undefined && `Min: ${setting.min}`, setting.max !== undefined && `Max: ${setting.max}`].filter(Boolean).join(". ")}
      />
    </Form>
  );
}

function EditRgbForm({ rgb, onSaved }: { rgb: RgbValues; onSaved: (v: RgbValues) => void }) {
  const { pop } = useNavigation();
  return (
    <Form
      navigationTitle="Edit RGB"
      actions={<ActionPanel><Action.SubmitForm title="Save" onSubmit={async (values: Record<string, string>) => {
        const v = { brightness: parseInt(values.brightness), effect: parseInt(values.effect), speed: parseInt(values.speed), hue: parseInt(values.hue), saturation: parseInt(values.saturation) };
        try { await writeRgb(v.brightness, v.effect, v.speed, v.hue, v.saturation); showToast({ style: Toast.Style.Success, title: "RGB saved" }); onSaved(v); pop(); }
        catch (e) { showToast({ style: Toast.Style.Failure, title: "Failed", message: e instanceof Error ? e.message : "" }); }
      }} /></ActionPanel>}
    >
      <Form.TextField id="brightness" title="Brightness" defaultValue={String(rgb.brightness)} info="0–255" />
      <Form.TextField id="effect" title="Effect" defaultValue={String(rgb.effect)} info={`0–${RGB_EFFECTS.length - 1}. Current: ${RGB_EFFECTS[rgb.effect] ?? "Unknown"}`} />
      <Form.TextField id="speed" title="Speed" defaultValue={String(rgb.speed)} info="0–255" />
      <Form.TextField id="hue" title="Hue" defaultValue={String(rgb.hue)} info="0–255" />
      <Form.TextField id="saturation" title="Saturation" defaultValue={String(rgb.saturation)} info="0–255" />
    </Form>
  );
}

function RenameLayerForm({ board, layerIndex, currentName, onSaved }: { board: BoardProfile; layerIndex: number; currentName: string; onSaved: (name: string) => void }) {
  const { pop } = useNavigation();
  return (
    <Form
      navigationTitle={`Rename Layer ${layerIndex}`}
      actions={<ActionPanel><Action.SubmitForm title="Save" onSubmit={(values: { name: string }) => {
        const name = values.name.trim();
        if (!name) { showToast({ style: Toast.Style.Failure, title: "Name can't be empty" }); return; }
        onSaved(name);
        showToast({ style: Toast.Style.Success, title: `Renamed to "${name}"` });
        pop();
      }} /></ActionPanel>}
    >
      <Form.TextField id="name" title="Layer Name" defaultValue={currentName} />
    </Form>
  );
}
