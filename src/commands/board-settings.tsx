import { Action, ActionPanel, Detail, Form, Icon, List, showToast, Toast, useNavigation } from "@raycast/api";
import { useEffect, useState } from "react";
import { readBoardSettings, writeBoardSetting, writeRgb } from "../lib/vial/client";
import { getActiveBoard } from "../lib/storage/active-board";

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

export default function BoardSettingsCommand() {
  const { push } = useNavigation();
  const [settings, setSettings] = useState<Record<number, QmkSetting>>({});
  const [rgb, setRgb] = useState<RgbValues | null>(null);
  const [lightingType, setLightingType] = useState("none");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [boardName, setBoardName] = useState("Keyboard");

  useEffect(() => {
    async function load() {
      try {
        const board = await getActiveBoard();
        if (board) setBoardName(board.name);

        const data = await readBoardSettings();
        setSettings(data.settings);
        setRgb(data.rgb);
        setLightingType(data.lightingType);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to read settings. Is your board plugged in?");
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  if (error) {
    return (
      <Detail
        markdown={`# Board Settings\n\n${error}\n\nMake sure your Vial keyboard is connected via USB.`}
      />
    );
  }

  // Group settings by tab
  const tabs = new Map<string, QmkSetting[]>();
  for (const s of Object.values(settings)) {
    const list = tabs.get(s.tab) ?? [];
    list.push(s);
    tabs.set(s.tab, list);
  }

  async function handleEditSetting(setting: QmkSetting) {
    push(<EditSettingForm setting={setting} onSaved={() => {
      // Refresh
      setIsLoading(true);
      readBoardSettings().then((data) => {
        setSettings(data.settings);
        setRgb(data.rgb);
        setIsLoading(false);
      });
    }} />);
  }

  return (
    <List isLoading={isLoading} navigationTitle={`${boardName} — Settings`}>
      {rgb && (
        <List.Section title="RGB Lighting" subtitle={lightingType}>
          <List.Item
            icon={Icon.Sun}
            title="Brightness"
            subtitle={`${Math.round((rgb.brightness / 255) * 100)}%`}
            accessories={[{ text: String(rgb.brightness) }]}
            actions={
              <ActionPanel>
                <Action title="Edit" icon={Icon.Pencil} onAction={() => push(
                  <EditRgbForm rgb={rgb} onSaved={(newRgb) => setRgb(newRgb)} />
                )} />
              </ActionPanel>
            }
          />
          <List.Item icon={Icon.Wand} title="Effect" subtitle={`Mode ${rgb.effect}`} accessories={[{ text: `Speed: ${rgb.speed}` }]} />
          <List.Item icon={Icon.EyeDropper} title="Color" subtitle={`Hue: ${rgb.hue}, Sat: ${rgb.saturation}`} />
        </List.Section>
      )}

      {[...tabs.entries()].map(([tabName, tabSettings]) => (
        <List.Section key={tabName} title={tabName} subtitle={`${tabSettings.length} setting(s)`}>
          {tabSettings.map((s) => (
            <List.Item
              key={s.qsid}
              icon={s.type === "bool" ? (s.value ? Icon.Checkmark : Icon.Circle) : Icon.Gear}
              title={s.name}
              subtitle={s.type === "bool" ? (s.value ? "Enabled" : "Disabled") : `${s.value}${s.unit ? ` ${s.unit}` : ""}`}
              accessories={[{ text: `QSID ${s.qsid}` }]}
              actions={
                <ActionPanel>
                  {s.type === "bool" ? (
                    <Action
                      title={s.value ? "Disable" : "Enable"}
                      icon={s.value ? Icon.Circle : Icon.Checkmark}
                      onAction={async () => {
                        const newVal = s.value ? 0 : 1;
                        await writeBoardSetting(s.qsid, newVal);
                        setSettings((prev) => ({ ...prev, [s.qsid]: { ...s, value: newVal } }));
                        showToast({ style: Toast.Style.Success, title: `${s.name}: ${newVal ? "Enabled" : "Disabled"}` });
                      }}
                    />
                  ) : (
                    <Action title="Edit" icon={Icon.Pencil} onAction={() => handleEditSetting(s)} />
                  )}
                </ActionPanel>
              }
            />
          ))}
        </List.Section>
      ))}

      {Object.keys(settings).length === 0 && !isLoading && !error && (
        <List.EmptyView
          icon={Icon.Gear}
          title="No QMK Settings"
          description="Your board doesn't expose any configurable QMK settings via Vial"
        />
      )}
    </List>
  );
}

function EditSettingForm({ setting, onSaved }: { setting: QmkSetting; onSaved: () => void }) {
  const { pop } = useNavigation();

  async function handleSubmit(values: { value: string }) {
    const val = parseInt(values.value, 10);
    if (isNaN(val)) {
      showToast({ style: Toast.Style.Failure, title: "Invalid value" });
      return;
    }
    try {
      await writeBoardSetting(setting.qsid, val);
      showToast({ style: Toast.Style.Success, title: `${setting.name} set to ${val}${setting.unit ? ` ${setting.unit}` : ""}` });
      onSaved();
      pop();
    } catch (e) {
      showToast({ style: Toast.Style.Failure, title: "Failed", message: e instanceof Error ? e.message : "Unknown" });
    }
  }

  return (
    <Form
      navigationTitle={`Edit: ${setting.name}`}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Save" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="value"
        title={setting.name}
        defaultValue={String(setting.value)}
        info={`${setting.unit ? `Unit: ${setting.unit}. ` : ""}${setting.min !== undefined ? `Min: ${setting.min}. ` : ""}${setting.max !== undefined ? `Max: ${setting.max}.` : ""}`}
      />
    </Form>
  );
}

function EditRgbForm({ rgb, onSaved }: { rgb: RgbValues; onSaved: (v: RgbValues) => void }) {
  const { pop } = useNavigation();

  async function handleSubmit(values: { brightness: string; effect: string; speed: string; hue: string; saturation: string }) {
    const v = {
      brightness: parseInt(values.brightness, 10),
      effect: parseInt(values.effect, 10),
      speed: parseInt(values.speed, 10),
      hue: parseInt(values.hue, 10),
      saturation: parseInt(values.saturation, 10),
    };
    try {
      await writeRgb(v.brightness, v.effect, v.speed, v.hue, v.saturation);
      showToast({ style: Toast.Style.Success, title: "RGB settings saved" });
      onSaved(v);
      pop();
    } catch (e) {
      showToast({ style: Toast.Style.Failure, title: "Failed", message: e instanceof Error ? e.message : "Unknown" });
    }
  }

  return (
    <Form
      navigationTitle="Edit RGB"
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Save" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField id="brightness" title="Brightness" defaultValue={String(rgb.brightness)} info="0–255" />
      <Form.TextField id="effect" title="Effect Mode" defaultValue={String(rgb.effect)} info="0–36" />
      <Form.TextField id="speed" title="Speed" defaultValue={String(rgb.speed)} info="0–255" />
      <Form.TextField id="hue" title="Hue" defaultValue={String(rgb.hue)} info="0–255" />
      <Form.TextField id="saturation" title="Saturation" defaultValue={String(rgb.saturation)} info="0–255" />
    </Form>
  );
}
