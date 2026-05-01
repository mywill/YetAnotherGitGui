import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { StashesView } from "./StashesView";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { mockStore } from "../../test/mockStores";

vi.mock("../../stores/repositoryStore", () => ({
  useRepositoryStore: vi.fn(),
}));

vi.mock("../../stores/settingsStore", () => ({
  useSettingsStore: vi.fn(),
}));

vi.mock("./StashList", () => ({
  StashList: () => <div data-testid="stash-list">Stash List</div>,
}));

vi.mock("../sidebar/StashDetailsPanel", () => ({
  StashDetailsPanel: ({ loading }: { loading: boolean }) => (
    <div data-testid="stash-details-panel" data-loading={loading}>
      Stash Details
    </div>
  ),
}));

describe("StashesView", () => {
  const mockSetLayoutSize = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function setupStores({
    selectedStashDetails = null,
    stashDetailsLoading = false,
    storedListWidth = undefined as number | undefined,
  } = {}) {
    mockStore(useRepositoryStore, {
      selectedStashDetails,
      stashDetailsLoading,
    });
    mockStore(useSettingsStore, {
      layoutSizes: storedListWidth !== undefined ? { "stash.listWidth": storedListWidth } : {},
      setLayoutSize: mockSetLayoutSize,
    });
  }

  it("renders a stash list and an empty details state by default", () => {
    setupStores();
    render(<StashesView />);
    expect(screen.getByTestId("stash-list")).toBeInTheDocument();
    expect(screen.getByText("Select a stash to view details")).toBeInTheDocument();
  });

  it("renders the details panel when a stash is selected", () => {
    setupStores({
      selectedStashDetails: {
        index: 0,
        message: "wip",
        files: [],
        diff_stats: { files_changed: 0, insertions: 0, deletions: 0 },
      } as never,
    });
    render(<StashesView />);
    expect(screen.getByTestId("stash-details-panel")).toBeInTheDocument();
    expect(screen.queryByText("Select a stash to view details")).not.toBeInTheDocument();
  });

  it("renders the details panel when stashDetailsLoading is true", () => {
    setupStores({ stashDetailsLoading: true });
    render(<StashesView />);
    const panel = screen.getByTestId("stash-details-panel");
    expect(panel).toHaveAttribute("data-loading", "true");
  });

  it("renders a resize handle with an accessible label", () => {
    setupStores();
    render(<StashesView />);
    expect(screen.getByRole("separator", { name: "Resize stash list" })).toBeInTheDocument();
  });

  it("has the expected CSS class structure", () => {
    setupStores();
    const { container } = render(<StashesView />);
    expect(container.querySelector(".stashes-view")).toBeInTheDocument();
    expect(container.querySelector(".stash-list-col")).toBeInTheDocument();
    expect(container.querySelector(".stash-details-col")).toBeInTheDocument();
  });
});
