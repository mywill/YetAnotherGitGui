import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { FileItem } from "./FileItem";
import type { FileStatus } from "../../types";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { copyToClipboard } from "../../services/clipboard";

vi.mock("../../services/clipboard", () => ({
  copyToClipboard: vi.fn(),
}));

vi.mock("../../stores/repositoryStore", () => ({
  useRepositoryStore: vi.fn((selector: (state: Record<string, unknown>) => unknown) =>
    selector({ repositoryInfo: { path: "/mock/repo/path" } })
  ),
}));

describe("FileItem", () => {
  const mockOnToggleStage = vi.fn();
  const mockOnSelect = vi.fn();
  const mockOnDoubleClick = vi.fn();
  const mockOnDelete = vi.fn();
  const mockOnRevert = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useRepositoryStore).mockImplementation(
      (selector: (state: Record<string, unknown>) => unknown) =>
        selector({ repositoryInfo: { path: "/mock/repo/path" } })
    );
  });

  const defaultFile: FileStatus = {
    path: "src/components/test.tsx",
    status: "modified",
    is_staged: false,
  };

  function renderFileItem(props: Partial<Parameters<typeof FileItem>[0]> = {}) {
    return render(
      <FileItem
        file={defaultFile}
        isStaged={false}
        onToggleStage={mockOnToggleStage}
        onSelect={mockOnSelect}
        onDoubleClick={mockOnDoubleClick}
        extraMenuItems={[
          { label: "Revert changes", onClick: mockOnRevert },
          { label: "Delete file", onClick: mockOnDelete },
        ]}
        {...props}
      />
    );
  }

  it("renders file name and path", () => {
    renderFileItem();

    expect(screen.getByText("test.tsx")).toBeInTheDocument();
    expect(screen.getByText("src/components")).toBeInTheDocument();
  });

  it("renders file at root without directory path", () => {
    renderFileItem({
      file: { ...defaultFile, path: "README.md" },
    });

    expect(screen.getByText("README.md")).toBeInTheDocument();
    expect(screen.queryByText("src/components")).not.toBeInTheDocument();
  });

  it("displays correct status icon for modified file", () => {
    renderFileItem();

    expect(screen.getByText("M")).toBeInTheDocument();
  });

  it("displays correct status icon for added file", () => {
    renderFileItem({
      file: { ...defaultFile, status: "added" },
    });

    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("displays correct status icon for deleted file", () => {
    renderFileItem({
      file: { ...defaultFile, status: "deleted" },
    });

    expect(screen.getByText("D")).toBeInTheDocument();
  });

  it("displays correct status icon for untracked file", () => {
    renderFileItem({
      file: { ...defaultFile, status: "untracked" },
    });

    expect(screen.getByText("?")).toBeInTheDocument();
  });

  it("displays 'new' badge for untracked files", () => {
    renderFileItem({
      isUntracked: true,
    });

    expect(screen.getByText("new")).toBeInTheDocument();
  });

  it("shows checkbox as checked when file is staged", () => {
    renderFileItem({ isStaged: true });

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeChecked();
  });

  it("shows checkbox as unchecked when file is not staged", () => {
    renderFileItem({ isStaged: false });

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).not.toBeChecked();
  });

  it("calls onToggleStage when checkbox is clicked", () => {
    renderFileItem();

    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);

    expect(mockOnToggleStage).toHaveBeenCalledTimes(1);
  });

  it("calls onSelect when file item is clicked", () => {
    renderFileItem();

    const fileItem = screen.getByText("test.tsx").closest(".file-item");
    fireEvent.click(fileItem!);

    expect(mockOnSelect).toHaveBeenCalledTimes(1);
  });

  it("does not call onSelect when checkbox is clicked", () => {
    renderFileItem();

    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);

    expect(mockOnSelect).not.toHaveBeenCalled();
  });

  it("calls onDoubleClick when file item is double-clicked", () => {
    renderFileItem();

    const fileItem = screen.getByText("test.tsx").closest(".file-item");
    fireEvent.doubleClick(fileItem!);

    expect(mockOnDoubleClick).toHaveBeenCalledTimes(1);
  });

  it("opens context menu on right-click with extra menu items", async () => {
    renderFileItem();

    const fileItem = screen.getByText("test.tsx").closest(".file-item");
    fireEvent.contextMenu(fileItem!);

    await waitFor(() => {
      expect(screen.getByText("Revert changes")).toBeInTheDocument();
      expect(screen.getByText("Delete file")).toBeInTheDocument();
    });
  });

  it("calls onClick when extra menu item is clicked", async () => {
    renderFileItem();

    const fileItem = screen.getByText("test.tsx").closest(".file-item");
    fireEvent.contextMenu(fileItem!);

    await waitFor(() => {
      expect(screen.getByText("Revert changes")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Revert changes"));

    expect(mockOnRevert).toHaveBeenCalledTimes(1);
  });

  it("calls onClick when Delete file is clicked in context menu", async () => {
    renderFileItem();

    const fileItem = screen.getByText("test.tsx").closest(".file-item");
    fireEvent.contextMenu(fileItem!);

    await waitFor(() => {
      expect(screen.getByText("Delete file")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Delete file"));

    expect(mockOnDelete).toHaveBeenCalledTimes(1);
  });

  it("shows Copy submenu but no extra items when no extraMenuItems provided", () => {
    render(
      <FileItem
        file={defaultFile}
        isStaged={false}
        onToggleStage={mockOnToggleStage}
        onSelect={mockOnSelect}
      />
    );

    const fileItem = screen.getByText("test.tsx").closest(".file-item");
    fireEvent.contextMenu(fileItem!);

    // Copy submenu should always be present
    expect(screen.getByText("Copy")).toBeInTheDocument();
    // But no extra items
    expect(screen.queryByText("Revert changes")).not.toBeInTheDocument();
    expect(screen.queryByText("Delete file")).not.toBeInTheDocument();
  });

  it("has correct title on checkbox for unstaged file", () => {
    renderFileItem({ isStaged: false });

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toHaveAttribute("title", "Stage file");
  });

  it("has correct title on checkbox for staged file", () => {
    renderFileItem({ isStaged: true });

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toHaveAttribute("title", "Unstage file");
  });

  it("applies staged class when file is staged", () => {
    renderFileItem({ isStaged: true });

    const fileItem = screen.getByText("test.tsx").closest(".file-item");
    expect(fileItem).toHaveClass("staged");
  });

  it("renders custom labels from extraMenuItems", async () => {
    renderFileItem({
      extraMenuItems: [{ label: "Unstage", onClick: vi.fn() }],
    });

    const fileItem = screen.getByText("test.tsx").closest(".file-item");
    fireEvent.contextMenu(fileItem!);

    await waitFor(() => {
      expect(screen.getByText("Unstage")).toBeInTheDocument();
      expect(screen.queryByText("Revert changes")).not.toBeInTheDocument();
    });
  });

  it("renders Discard changes from extraMenuItems", async () => {
    renderFileItem({
      extraMenuItems: [{ label: "Discard changes", onClick: vi.fn() }],
    });

    const fileItem = screen.getByText("test.tsx").closest(".file-item");
    fireEvent.contextMenu(fileItem!);

    await waitFor(() => {
      expect(screen.getByText("Discard changes")).toBeInTheDocument();
      expect(screen.queryByText("Revert changes")).not.toBeInTheDocument();
    });
  });

  describe("Copy submenu", () => {
    it("shows Copy item in context menu", () => {
      renderFileItem();

      const fileItem = screen.getByText("test.tsx").closest(".file-item");
      fireEvent.contextMenu(fileItem!);

      expect(screen.getByText("Copy")).toBeInTheDocument();
    });

    it("shows submenu children on hover", () => {
      renderFileItem();

      const fileItem = screen.getByText("test.tsx").closest(".file-item");
      fireEvent.contextMenu(fileItem!);

      const copyItem = screen.getByText("Copy").closest(".context-menu-item");
      fireEvent.mouseEnter(copyItem!);

      expect(screen.getByText("Relative path")).toBeInTheDocument();
      expect(screen.getByText("Absolute path")).toBeInTheDocument();
      expect(screen.getByText("File name")).toBeInTheDocument();
    });

    it("copies relative path when 'Relative path' is clicked", () => {
      renderFileItem();

      const fileItem = screen.getByText("test.tsx").closest(".file-item");
      fireEvent.contextMenu(fileItem!);

      const copyItem = screen.getByText("Copy").closest(".context-menu-item");
      fireEvent.mouseEnter(copyItem!);
      fireEvent.click(screen.getByText("Relative path"));

      expect(copyToClipboard).toHaveBeenCalledWith("src/components/test.tsx");
    });

    it("copies absolute path when 'Absolute path' is clicked", () => {
      renderFileItem();

      const fileItem = screen.getByText("test.tsx").closest(".file-item");
      fireEvent.contextMenu(fileItem!);

      const copyItem = screen.getByText("Copy").closest(".context-menu-item");
      fireEvent.mouseEnter(copyItem!);
      fireEvent.click(screen.getByText("Absolute path"));

      expect(copyToClipboard).toHaveBeenCalledWith("/mock/repo/path/src/components/test.tsx");
    });

    it("copies file name when 'File name' is clicked", () => {
      renderFileItem();

      const fileItem = screen.getByText("test.tsx").closest(".file-item");
      fireEvent.contextMenu(fileItem!);

      const copyItem = screen.getByText("Copy").closest(".context-menu-item");
      fireEvent.mouseEnter(copyItem!);
      fireEvent.click(screen.getByText("File name"));

      expect(copyToClipboard).toHaveBeenCalledWith("test.tsx");
    });
  });
});
