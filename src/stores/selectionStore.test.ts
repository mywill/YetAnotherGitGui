import { describe, it, expect, beforeEach } from "vitest";
import { useSelectionStore, makeSelectionKey } from "./selectionStore";

describe("selectionStore", () => {
  beforeEach(() => {
    // Reset store state before each test
    useSelectionStore.setState({
      selectedCommitHash: null,
      selectedFilePath: null,
      selectedFileStaged: false,
      activeView: "status",
      scrollToCommit: null,
      selectedFilePaths: new Set(),
      lastSelectedFilePath: null,
      lastSelectedFileStaged: null,
    });
  });

  describe("activeView", () => {
    it("defaults to status view", () => {
      const state = useSelectionStore.getState();
      expect(state.activeView).toBe("status");
    });

    it("can switch to history view", () => {
      const { setActiveView } = useSelectionStore.getState();
      setActiveView("history");

      const state = useSelectionStore.getState();
      expect(state.activeView).toBe("history");
    });

    it("can switch back to status view", () => {
      const { setActiveView } = useSelectionStore.getState();
      setActiveView("history");
      setActiveView("status");

      const state = useSelectionStore.getState();
      expect(state.activeView).toBe("status");
    });
  });

  describe("selectCommit", () => {
    it("selects a commit by hash", () => {
      const { selectCommit } = useSelectionStore.getState();
      selectCommit("abc123");

      const state = useSelectionStore.getState();
      expect(state.selectedCommitHash).toBe("abc123");
    });

    it("can clear selection with null", () => {
      const { selectCommit } = useSelectionStore.getState();
      selectCommit("abc123");
      selectCommit(null);

      const state = useSelectionStore.getState();
      expect(state.selectedCommitHash).toBeNull();
    });
  });

  describe("selectFile", () => {
    it("selects a file with staged flag", () => {
      const { selectFile } = useSelectionStore.getState();
      selectFile("src/main.ts", true);

      const state = useSelectionStore.getState();
      expect(state.selectedFilePath).toBe("src/main.ts");
      expect(state.selectedFileStaged).toBe(true);
    });

    it("selects an unstaged file", () => {
      const { selectFile } = useSelectionStore.getState();
      selectFile("src/app.ts", false);

      const state = useSelectionStore.getState();
      expect(state.selectedFilePath).toBe("src/app.ts");
      expect(state.selectedFileStaged).toBe(false);
    });

    it("can clear file selection", () => {
      const { selectFile } = useSelectionStore.getState();
      selectFile("src/main.ts", true);
      selectFile(null, false);

      const state = useSelectionStore.getState();
      expect(state.selectedFilePath).toBeNull();
    });
  });

  describe("multi-file selection", () => {
    const allFiles = ["file1.ts", "file2.ts", "file3.ts", "file4.ts"];
    // Test with unstaged files (staged=false)
    const isStaged = false;

    describe("toggleFileSelection with normal click", () => {
      it("selects a single file and clears previous selection", () => {
        const { toggleFileSelection } = useSelectionStore.getState();

        toggleFileSelection("file1.ts", isStaged, false, false, allFiles);

        const state = useSelectionStore.getState();
        expect(state.selectedFilePaths.size).toBe(1);
        expect(state.selectedFilePaths.has(makeSelectionKey("file1.ts", isStaged))).toBe(true);
        expect(state.lastSelectedFilePath).toBe("file1.ts");
      });

      it("replaces selection with new file on normal click", () => {
        const { toggleFileSelection } = useSelectionStore.getState();

        toggleFileSelection("file1.ts", isStaged, false, false, allFiles);
        toggleFileSelection("file2.ts", isStaged, false, false, allFiles);

        const state = useSelectionStore.getState();
        expect(state.selectedFilePaths.size).toBe(1);
        expect(state.selectedFilePaths.has(makeSelectionKey("file1.ts", isStaged))).toBe(false);
        expect(state.selectedFilePaths.has(makeSelectionKey("file2.ts", isStaged))).toBe(true);
      });
    });

    describe("toggleFileSelection with Ctrl", () => {
      it("adds file to selection with ctrl+click", () => {
        const { toggleFileSelection } = useSelectionStore.getState();

        toggleFileSelection("file1.ts", isStaged, false, false, allFiles);
        toggleFileSelection("file2.ts", isStaged, true, false, allFiles);

        const state = useSelectionStore.getState();
        expect(state.selectedFilePaths.size).toBe(2);
        expect(state.selectedFilePaths.has(makeSelectionKey("file1.ts", isStaged))).toBe(true);
        expect(state.selectedFilePaths.has(makeSelectionKey("file2.ts", isStaged))).toBe(true);
      });

      it("removes file from selection with ctrl+click on selected file", () => {
        const { toggleFileSelection } = useSelectionStore.getState();

        toggleFileSelection("file1.ts", isStaged, false, false, allFiles);
        toggleFileSelection("file2.ts", isStaged, true, false, allFiles);
        toggleFileSelection("file1.ts", isStaged, true, false, allFiles);

        const state = useSelectionStore.getState();
        expect(state.selectedFilePaths.size).toBe(1);
        expect(state.selectedFilePaths.has(makeSelectionKey("file1.ts", isStaged))).toBe(false);
        expect(state.selectedFilePaths.has(makeSelectionKey("file2.ts", isStaged))).toBe(true);
      });
    });

    describe("toggleFileSelection with Shift", () => {
      it("selects range of files with shift+click", () => {
        const { toggleFileSelection } = useSelectionStore.getState();

        toggleFileSelection("file1.ts", isStaged, false, false, allFiles);
        toggleFileSelection("file3.ts", isStaged, false, true, allFiles);

        const state = useSelectionStore.getState();
        expect(state.selectedFilePaths.size).toBe(3);
        expect(state.selectedFilePaths.has(makeSelectionKey("file1.ts", isStaged))).toBe(true);
        expect(state.selectedFilePaths.has(makeSelectionKey("file2.ts", isStaged))).toBe(true);
        expect(state.selectedFilePaths.has(makeSelectionKey("file3.ts", isStaged))).toBe(true);
        expect(state.selectedFilePaths.has(makeSelectionKey("file4.ts", isStaged))).toBe(false);
      });

      it("selects range in reverse order", () => {
        const { toggleFileSelection } = useSelectionStore.getState();

        toggleFileSelection("file4.ts", isStaged, false, false, allFiles);
        toggleFileSelection("file2.ts", isStaged, false, true, allFiles);

        const state = useSelectionStore.getState();
        expect(state.selectedFilePaths.size).toBe(3);
        expect(state.selectedFilePaths.has(makeSelectionKey("file2.ts", isStaged))).toBe(true);
        expect(state.selectedFilePaths.has(makeSelectionKey("file3.ts", isStaged))).toBe(true);
        expect(state.selectedFilePaths.has(makeSelectionKey("file4.ts", isStaged))).toBe(true);
      });

      it("handles shift+click without prior selection", () => {
        const { toggleFileSelection } = useSelectionStore.getState();

        // No prior selection, shift+click should just select the file
        toggleFileSelection("file2.ts", isStaged, false, true, allFiles);

        const state = useSelectionStore.getState();
        expect(state.selectedFilePaths.size).toBe(1);
        expect(state.selectedFilePaths.has(makeSelectionKey("file2.ts", isStaged))).toBe(true);
      });
    });

    describe("selectSingleFile", () => {
      it("selects a single file and clears previous selection", () => {
        const { toggleFileSelection, selectSingleFile } = useSelectionStore.getState();

        // First select multiple files
        toggleFileSelection("file1.ts", isStaged, false, false, allFiles);
        toggleFileSelection("file2.ts", isStaged, true, false, allFiles);

        // Now use selectSingleFile
        selectSingleFile("file3.ts", isStaged);

        const state = useSelectionStore.getState();
        expect(state.selectedFilePaths.size).toBe(1);
        expect(state.selectedFilePaths.has(makeSelectionKey("file3.ts", isStaged))).toBe(true);
        expect(state.lastSelectedFilePath).toBe("file3.ts");
        expect(state.lastSelectedFileStaged).toBe(isStaged);
      });

      it("sets lastSelectedFilePath for shift-range anchoring", () => {
        const { selectSingleFile, toggleFileSelection } = useSelectionStore.getState();

        selectSingleFile("file1.ts", isStaged);
        toggleFileSelection("file3.ts", isStaged, false, true, allFiles);

        const state = useSelectionStore.getState();
        expect(state.selectedFilePaths.size).toBe(3);
        expect(state.selectedFilePaths.has(makeSelectionKey("file1.ts", isStaged))).toBe(true);
        expect(state.selectedFilePaths.has(makeSelectionKey("file2.ts", isStaged))).toBe(true);
        expect(state.selectedFilePaths.has(makeSelectionKey("file3.ts", isStaged))).toBe(true);
      });
    });

    describe("clearFileSelection", () => {
      it("clears all selected files", () => {
        const { toggleFileSelection, clearFileSelection } = useSelectionStore.getState();

        toggleFileSelection("file1.ts", isStaged, false, false, allFiles);
        toggleFileSelection("file2.ts", isStaged, true, false, allFiles);
        clearFileSelection();

        const state = useSelectionStore.getState();
        expect(state.selectedFilePaths.size).toBe(0);
        expect(state.lastSelectedFilePath).toBeNull();
      });
    });

    describe("isFileSelected", () => {
      it("returns true for selected files", () => {
        const { toggleFileSelection, isFileSelected } = useSelectionStore.getState();

        toggleFileSelection("file1.ts", isStaged, false, false, allFiles);

        expect(isFileSelected("file1.ts", isStaged)).toBe(true);
        expect(isFileSelected("file2.ts", isStaged)).toBe(false);
      });

      it("distinguishes between staged and unstaged files with same path", () => {
        const { toggleFileSelection, isFileSelected } = useSelectionStore.getState();

        // Select file1.ts in unstaged section
        toggleFileSelection("file1.ts", false, false, false, allFiles);

        // Should be selected in unstaged but not in staged
        expect(isFileSelected("file1.ts", false)).toBe(true);
        expect(isFileSelected("file1.ts", true)).toBe(false);
      });
    });
  });

  describe("shift+click cross-section guard", () => {
    const unstaged = ["a.ts", "b.ts", "c.ts"];

    it("falls back to single-select when the previous selection was in a different section", () => {
      const { selectFile, toggleFileSelection } = useSelectionStore.getState();

      // Anchor lives in the STAGED section.
      selectFile("staged-1.ts", true);
      useSelectionStore.setState({
        lastSelectedFilePath: "staged-1.ts",
        lastSelectedFileStaged: true,
      });

      // Shift+click in the UNSTAGED section. The cross-section guard at line
      // 67 must skip the range expansion and just select the clicked row.
      toggleFileSelection("c.ts", false, false, true, unstaged);

      const state = useSelectionStore.getState();
      // Only c.ts is selected — the range did NOT expand from staged-1.ts.
      expect(state.selectedFilePaths.size).toBe(1);
      expect(state.selectedFilePaths.has(makeSelectionKey("c.ts", false))).toBe(true);
      expect(state.selectedFilePaths.has(makeSelectionKey("staged-1.ts", true))).toBe(false);
    });

    it("preserves prior selection when shift-range indices cannot be resolved", () => {
      // Anchor is in unstaged, BUT the supplied allFilePaths is a different
      // listing (e.g. stale) that doesn't contain the anchor. The range
      // expansion bails (indexOf returns -1), so the existing selection
      // survives unchanged.
      const { toggleFileSelection } = useSelectionStore.getState();

      toggleFileSelection("a.ts", false, false, false, unstaged);
      toggleFileSelection("c.ts", false, false, true, ["x.ts", "y.ts", "z.ts"]);

      const state = useSelectionStore.getState();
      // a.ts is still selected; the new shift-click did not add c.ts because
      // c.ts isn't in the supplied list and the anchor isn't either.
      expect(state.selectedFilePaths.has(makeSelectionKey("a.ts", false))).toBe(true);
      expect(state.lastSelectedFilePath).toBe("c.ts");
    });
  });

  describe("scroll-to-commit interactions", () => {
    it("selectAndScrollToCommit sets hash, scroll target, and switches to history view", () => {
      const { selectAndScrollToCommit } = useSelectionStore.getState();
      selectAndScrollToCommit("deadbeef");

      const state = useSelectionStore.getState();
      expect(state.selectedCommitHash).toBe("deadbeef");
      expect(state.scrollToCommit).toBe("deadbeef");
      expect(state.activeView).toBe("history");
    });

    it("clearScrollToCommit clears just the scroll target", () => {
      const { selectAndScrollToCommit, clearScrollToCommit } = useSelectionStore.getState();
      selectAndScrollToCommit("deadbeef");
      clearScrollToCommit();

      const state = useSelectionStore.getState();
      // Scroll target cleared, but selection + view should remain.
      expect(state.scrollToCommit).toBeNull();
      expect(state.selectedCommitHash).toBe("deadbeef");
      expect(state.activeView).toBe("history");
    });
  });
});
