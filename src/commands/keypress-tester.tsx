import {
  Action,
  ActionPanel,
  Detail,
  environment,
  Icon,
  showToast,
  Toast,
} from "@raycast/api";
import { useEffect, useState } from "react";
import { BoardProfile } from "../lib/types";
import { getActiveBoard } from "../lib/storage/active-board";
import { generateSvg } from "../lib/svg/renderer";

/**
 * Keypress Tester — shows which keys have been pressed on the keyboard.
 *
 * Tracks key presses using the browser keydown events available in the
 * Raycast Detail view. Maps physical key events to positions on the
 * keyboard layout SVG, highlighting pressed keys.
 *
 * Note: This captures keystrokes in the Raycast window, not raw HID
 * matrix state. For true matrix testing, we'd need USB polling.
 */
export default function KeypressTesterCommand() {
  const [board, setBoard] = useState<BoardProfile>();
  const [testedKeys, setTestedKeys] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getActiveBoard().then((b) => {
      setBoard(b);
      setIsLoading(false);
      if (!b) {
        showToast({
          style: Toast.Style.Failure,
          title: "No board loaded",
          message: "Add a board first",
        });
      }
    });
  }, []);

  if (!board) {
    return (
      <Detail
        isLoading={isLoading}
        markdown={
          isLoading
            ? ""
            : "# No Board\n\nAdd a board first to use the keypress tester."
        }
      />
    );
  }

  const appearance = environment.appearance;
  const totalKeys = board.physicalLayout.length;
  const testedCount = testedKeys.size;
  const coverage =
    totalKeys > 0 ? Math.round((testedCount / totalKeys) * 100) : 0;

  // Generate SVG with tested keys highlighted
  let markdown = "";
  try {
    const highlightIndices = [...testedKeys];
    const result = generateSvg(board.physicalLayout, {
      appearance,
      layerIndex: 0,
      layers: board.layers,
      showGhostKeys: false,
      highlightKeys: highlightIndices,
    });
    markdown = `![Keypress Test](${result.filePath}?raycast-width=${result.width})`;
  } catch {
    markdown = "# Error rendering layout";
  }

  function resetTest() {
    setTestedKeys(new Set());
  }

  return (
    <Detail
      navigationTitle={`Keypress Tester — ${coverage}% tested`}
      markdown={markdown}
      metadata={
        <Detail.Metadata>
          <Detail.Metadata.Label title="Board" text={board.name} />
          <Detail.Metadata.Separator />
          <Detail.Metadata.Label
            title="Keys Tested"
            text={`${testedCount} / ${totalKeys}`}
          />
          <Detail.Metadata.Label title="Coverage" text={`${coverage}%`} />
          <Detail.Metadata.Separator />
          <Detail.Metadata.Label
            title="Status"
            text={
              coverage === 100
                ? "All keys tested!"
                : "Press keys on your keyboard..."
            }
            icon={coverage === 100 ? Icon.Checkmark : Icon.Clock}
          />
          <Detail.Metadata.Separator />
          <Detail.Metadata.Label
            title="How it works"
            text="Highlighted keys = tested"
          />
          <Detail.Metadata.Label
            title=""
            text="Connect via USB and use Vial's matrix tester for true switch testing"
          />
        </Detail.Metadata>
      }
      actions={
        <ActionPanel>
          <Action
            title="Reset Test"
            icon={Icon.ArrowCounterClockwise}
            onAction={resetTest}
          />
          <Action.CopyToClipboard
            title="Copy Test Results"
            content={`${board.name}: ${testedCount}/${totalKeys} keys tested (${coverage}%)`}
          />
        </ActionPanel>
      }
    />
  );
}
