import { Action, ActionPanel, environment, Icon, List } from "@raycast/api";
import { useEffect, useState } from "react";
import { BoardProfile } from "../lib/types";
import { getBoards } from "../lib/storage/boards";
import { findKeyInLayers, KeySearchResult } from "../lib/svg/highlight";
import { generateSvg } from "../lib/svg/renderer";

export default function SearchKeysCommand() {
  const [boards, setBoards] = useState<BoardProfile[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<KeySearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getBoards().then((b) => {
      setBoards(b);
      setIsLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!query.trim() || boards.length === 0) {
      setResults([]);
      return;
    }

    const allResults: KeySearchResult[] = [];
    for (const board of boards) {
      allResults.push(...findKeyInLayers(query, board.layers, board.id, board.name));
    }
    setResults(allResults);
  }, [query, boards]);

  const noBoards = !isLoading && boards.length === 0;

  return (
    <List
      isLoading={isLoading}
      isShowingDetail={results.length > 0}
      searchBarPlaceholder="Search for a key (e.g. Print Screen, Ctrl, F5)..."
      onSearchTextChange={setQuery}
      navigationTitle="Find a Key"
    >
      {noBoards ? (
        <List.EmptyView
          icon={Icon.Keyboard}
          title="No Boards Imported"
          description="Use Import Keymap to add a board first"
        />
      ) : results.length === 0 && query ? (
        <List.EmptyView
          icon={Icon.MagnifyingGlass}
          title="No Keys Found"
          description={`No keys matching "${query}" across ${boards.length} board(s)`}
        />
      ) : !query ? (
        <List.EmptyView
          icon={Icon.Keyboard}
          title="Search Your Keymaps"
          description={`Type a key name to search across ${boards.length} board(s)`}
        />
      ) : null}

      {boards.map((board) => {
        const boardResults = results.filter((r) => r.boardId === board.id);
        if (boardResults.length === 0) return null;

        return (
          <List.Section key={board.id} title={board.name} subtitle={`${boardResults.length} match(es)`}>
            {boardResults.map((result, idx) => (
              <List.Item
                key={`${result.boardId}-${result.layerIndex}-${result.keyIndex}-${idx}`}
                icon={Icon.Key}
                title={result.label}
                subtitle={`Layer ${result.layerIndex}: ${result.layerName}`}
                accessories={[{ text: result.raw }]}
                detail={
                  <SearchResultDetail board={board} result={result} />
                }
                actions={
                  <ActionPanel>
                    <Action.CopyToClipboard title="Copy Keycode" content={result.raw} />
                  </ActionPanel>
                }
              />
            ))}
          </List.Section>
        );
      })}
    </List>
  );
}

function SearchResultDetail({ board, result }: { board: BoardProfile; result: KeySearchResult }) {
  const appearance = environment.appearance;

  let markdown = "";
  try {
    const svgResult = generateSvg(board.physicalLayout, {
      appearance,
      layerIndex: result.layerIndex,
      layers: board.layers,
      showGhostKeys: true,
      highlightKeys: [result.keyIndex],
    });
    markdown = `![${result.layerName}](${svgResult.filePath}?raycast-width=${svgResult.width})`;
  } catch {
    markdown = "*Could not render preview*";
  }

  return <List.Item.Detail markdown={markdown} />;
}
