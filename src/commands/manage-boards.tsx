import {
  Action,
  ActionPanel,
  Alert,
  Color,
  confirmAlert,
  environment,
  Grid,
  Icon,
  showToast,
  Toast,
} from "@raycast/api";
import { useEffect, useState } from "react";
import { BoardProfile } from "../lib/types";
import { deleteBoard, getBoards } from "../lib/storage/boards";
import {
  getActiveBoardId,
  setActiveBoardId,
} from "../lib/storage/active-board";
import { generateSvg } from "../lib/svg/renderer";
import ImportKeymapCommand from "./import-keymap";
import BoardDetailView from "./board-detail-view";

export default function ManageBoardsCommand() {
  const [boards, setBoards] = useState<BoardProfile[]>([]);
  const [activeBoardId, setActiveId] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);

  async function load() {
    const [b, aid] = await Promise.all([getBoards(), getActiveBoardId()]);
    setBoards(b);
    setActiveId(aid);
    setIsLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSetActiveAndView(board: BoardProfile) {
    await setActiveBoardId(board.id);
    setActiveId(board.id);
    showToast({ style: Toast.Style.Success, title: `Active: ${board.name}` });
  }

  async function handleDelete(board: BoardProfile) {
    if (
      await confirmAlert({
        title: `Delete "${board.name}"?`,
        message: "This cannot be undone.",
        primaryAction: {
          title: "Delete",
          style: Alert.ActionStyle.Destructive,
        },
      })
    ) {
      await deleteBoard(board.id);
      showToast({ style: Toast.Style.Success, title: `Deleted ${board.name}` });
      load();
    }
  }

  function getThumbnail(board: BoardProfile): string {
    try {
      const result = generateSvg(board.physicalLayout, {
        appearance: environment.appearance,
        layerIndex: 0,
        layers: board.layers,
        showGhostKeys: false,
      });
      return result.filePath;
    } catch {
      return "";
    }
  }

  return (
    <Grid
      columns={3}
      isLoading={isLoading}
      navigationTitle="My Boards"
      searchBarPlaceholder="Search boards..."
    >
      {boards.length === 0 && !isLoading ? (
        <Grid.EmptyView
          icon={Icon.Keyboard}
          title="No Boards Yet"
          description="Import a keymap to get started"
          actions={
            <ActionPanel>
              <Action.Push
                title="Import Keymap"
                icon={Icon.Plus}
                target={<ImportKeymapCommand />}
              />
            </ActionPanel>
          }
        />
      ) : null}

      <Grid.Section title="Keyboards">
        {boards.map((board) => {
          const isActive = board.id === activeBoardId;
          return (
            <Grid.Item
              key={board.id}
              content={getThumbnail(board) || Icon.Keyboard}
              title={board.name}
              subtitle={board.keyboard}
              accessory={
                isActive
                  ? { icon: { source: Icon.Checkmark, tintColor: Color.Green } }
                  : undefined
              }
              actions={
                <ActionPanel>
                  <Action.Push
                    title="View Board"
                    icon={Icon.Eye}
                    target={<BoardDetailView board={board} />}
                  />
                  {!isActive && (
                    <Action
                      title="Set as Active"
                      icon={Icon.Checkmark}
                      shortcut={{ modifiers: ["cmd"], key: "return" }}
                      onAction={() => handleSetActiveAndView(board)}
                    />
                  )}
                  <Action.Push
                    title="Import New Board"
                    icon={Icon.Plus}
                    target={<ImportKeymapCommand />}
                    shortcut={{ modifiers: ["cmd"], key: "n" }}
                  />
                  <Action.Open
                    title="Open Vial"
                    target="vial"
                    shortcut={{ modifiers: ["cmd", "shift"], key: "v" }}
                  />
                  <Action
                    title="Delete Board"
                    icon={Icon.Trash}
                    style={Action.Style.Destructive}
                    shortcut={{ modifiers: ["cmd"], key: "backspace" }}
                    onAction={() => handleDelete(board)}
                  />
                </ActionPanel>
              }
            />
          );
        })}
      </Grid.Section>
    </Grid>
  );
}
