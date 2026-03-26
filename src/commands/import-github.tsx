import {
  Action,
  ActionPanel,
  Form,
  Icon,
  List,
  showToast,
  Toast,
  useNavigation,
} from "@raycast/api";
import { useState } from "react";
import { parseQmkKeymapJson, keymapToBoardProfile } from "../lib/keymap/parser";
import { detectFirmwareType, parseZmkKeymap } from "../lib/keymap/zmk-parser";
import { getPhysicalLayout } from "../lib/qmk/cache";
import { saveBoard } from "../lib/storage/boards";
import { setActiveBoardId } from "../lib/storage/active-board";
import { BoardProfile } from "../lib/types";
import BoardDetailView from "./board-detail-view";

interface GitHubFile {
  name: string;
  path: string;
  type: "file" | "dir";
  download_url: string | null;
  size: number;
}

/**
 * Import a keymap from a public GitHub repository.
 * User enters a repo URL or owner/repo, browses to the keymap file, imports it.
 */
export default function ImportGitHubCommand() {
  const { push } = useNavigation();
  const [repo, setRepo] = useState("");
  const [repoPath, setRepoPath] = useState("");
  const [files, setFiles] = useState<GitHubFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isBrowsing, setIsBrowsing] = useState(false);
  const [breadcrumb, setBreadcrumb] = useState<string[]>([]);

  function parseRepoUrl(input: string): { owner: string; repo: string } | null {
    // Handle: owner/repo, https://github.com/owner/repo, github.com/owner/repo
    const cleaned = input.trim().replace(/\/+$/, "");
    const match = cleaned.match(
      /(?:(?:https?:\/\/)?github\.com\/)?([^/]+)\/([^/]+)/,
    );
    if (match) return { owner: match[1], repo: match[2].replace(".git", "") };
    return null;
  }

  async function browseRepo(pathToFetch?: string) {
    const parsed = parseRepoUrl(repo);
    if (!parsed) {
      showToast({
        style: Toast.Style.Failure,
        title: "Invalid repo",
        message: "Enter owner/repo or a GitHub URL",
      });
      return;
    }

    setIsLoading(true);
    const apiPath = pathToFetch || repoPath || "";

    try {
      const url = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/contents/${apiPath}`;
      const response = await fetch(url, {
        headers: { Accept: "application/vnd.github.v3+json" },
      });

      if (!response.ok) {
        throw new Error(
          response.status === 404
            ? "Repository or path not found"
            : `GitHub API error: ${response.status}`,
        );
      }

      const data = (await response.json()) as GitHubFile | GitHubFile[];
      const items = Array.isArray(data) ? data : [data];

      // Sort: directories first, then files, alphabetically
      items.sort((a, b) => {
        if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

      setFiles(items);
      setIsBrowsing(true);
      setRepoPath(apiPath);
      setBreadcrumb(apiPath ? apiPath.split("/") : []);
    } catch (e) {
      showToast({
        style: Toast.Style.Failure,
        title: "Failed to browse",
        message: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSelectFile(file: GitHubFile) {
    if (file.type === "dir") {
      browseRepo(file.path);
      return;
    }

    // Check if it's a keymap file
    const isKeymap =
      file.name.endsWith(".json") || file.name.endsWith(".keymap");
    if (!isKeymap) {
      showToast({
        style: Toast.Style.Failure,
        title: "Not a keymap file",
        message: "Select a .json or .keymap file",
      });
      return;
    }

    if (!file.download_url) {
      showToast({
        style: Toast.Style.Failure,
        title: "Cannot download",
        message: "No download URL for this file",
      });
      return;
    }

    setIsLoading(true);
    const toast = await showToast({
      style: Toast.Style.Animated,
      title: "Importing...",
      message: file.name,
    });

    try {
      const response = await fetch(file.download_url);
      if (!response.ok)
        throw new Error(`Failed to download: ${response.status}`);
      const content = await response.text();

      const firmware = detectFirmwareType(content);
      let board: BoardProfile;

      if (firmware === "zmk") {
        const boardName = file.name.replace(".keymap", "");
        const partial = parseZmkKeymap(content, boardName, file.download_url);
        board = {
          ...partial,
          physicalLayout: generatePlaceholderLayout(
            partial.layers[0]?.keycodes.length ?? 0,
          ),
        };
      } else if (firmware === "qmk") {
        const keymap = parseQmkKeymapJson(content);
        const physicalLayout = await getPhysicalLayout(
          keymap.keyboard,
          keymap.layout,
        );
        const boardName =
          keymap.keyboard.split("/").pop() || file.name.replace(".json", "");
        const partial = keymapToBoardProfile(
          keymap,
          boardName,
          file.download_url,
        );
        board = { ...partial, physicalLayout };
      } else {
        throw new Error(
          "Unrecognized file format — expected QMK .json or ZMK .keymap",
        );
      }

      await saveBoard(board);
      await setActiveBoardId(board.id);

      toast.hide();
      await showToast({
        style: Toast.Style.Success,
        title: "Imported!",
        message: board.name,
      });
      push(<BoardDetailView board={board} />);
    } catch (e) {
      toast.hide();
      showToast({
        style: Toast.Style.Failure,
        title: "Import failed",
        message: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setIsLoading(false);
    }
  }

  function goUp() {
    const parent = breadcrumb.slice(0, -1).join("/");
    browseRepo(parent || "");
  }

  if (!isBrowsing) {
    return (
      <Form
        isLoading={isLoading}
        navigationTitle="Import from GitHub"
        actions={
          <ActionPanel>
            <Action.SubmitForm
              title="Browse Repository"
              onSubmit={(values) => {
                setRepo(values.repo);
                setRepoPath(values.path || "");
                browseRepo(values.path);
              }}
            />
          </ActionPanel>
        }
      >
        <Form.TextField
          id="repo"
          title="Repository"
          placeholder="owner/repo or https://github.com/owner/repo"
          info="Enter a public GitHub repository containing your keymap"
        />
        <Form.TextField
          id="path"
          title="Path (optional)"
          placeholder="e.g. config/lily58.keymap or keymaps/default"
          info="Start browsing from a specific directory"
        />
      </Form>
    );
  }

  const parsed = parseRepoUrl(repo);

  return (
    <List
      isLoading={isLoading}
      navigationTitle={`${parsed?.owner}/${parsed?.repo}${repoPath ? "/" + repoPath : ""}`}
      searchBarPlaceholder="Filter files..."
    >
      {breadcrumb.length > 0 && (
        <List.Item
          icon={Icon.ArrowUp}
          title=".."
          subtitle="Go up"
          actions={
            <ActionPanel>
              <Action title="Go up" icon={Icon.ArrowUp} onAction={goUp} />
            </ActionPanel>
          }
        />
      )}

      {files.map((file) => {
        const isKeymap =
          file.name.endsWith(".json") || file.name.endsWith(".keymap");
        return (
          <List.Item
            key={file.path}
            icon={
              file.type === "dir"
                ? Icon.Folder
                : isKeymap
                  ? Icon.Keyboard
                  : Icon.Document
            }
            title={file.name}
            subtitle={
              file.type === "dir"
                ? "directory"
                : `${(file.size / 1024).toFixed(1)} KB`
            }
            accessories={
              isKeymap
                ? [
                    {
                      tag: {
                        value: file.name.endsWith(".keymap") ? "ZMK" : "QMK",
                      },
                    },
                  ]
                : []
            }
            actions={
              <ActionPanel>
                <Action
                  title={file.type === "dir" ? "Browse" : "Import"}
                  icon={file.type === "dir" ? Icon.Folder : Icon.Download}
                  onAction={() => handleSelectFile(file)}
                />
                {breadcrumb.length > 0 && (
                  <Action
                    title="Go up"
                    icon={Icon.ArrowUp}
                    shortcut={{ modifiers: ["cmd"], key: "[" }}
                    onAction={goUp}
                  />
                )}
              </ActionPanel>
            }
          />
        );
      })}
    </List>
  );
}

function generatePlaceholderLayout(
  keyCount: number,
): BoardProfile["physicalLayout"] {
  const cols = Math.ceil(Math.sqrt(keyCount * 2));
  return Array.from({ length: keyCount }, (_, i) => ({
    x: i % cols,
    y: Math.floor(i / cols),
    w: 1,
    h: 1,
  }));
}
