import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { WelcomeScreen } from "./WelcomeScreen";
import { cleanErrorMessage } from "../../utils/errorMessages";

// Mock dialog plugin
const mockDialogOpen = vi.fn();
vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: (...args: unknown[]) => mockDialogOpen(...args),
}));

// Mock stores
const mockOpenRepository = vi.fn();
vi.mock("../../stores/repositoryStore", () => ({
  useRepositoryStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ openRepository: mockOpenRepository }),
}));

describe("WelcomeScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows error notice when error prop is provided", () => {
    render(<WelcomeScreen error="Not a git repository" failedPath={null} />);
    expect(screen.getByText(/Not a git repository/)).toBeInTheDocument();
  });

  it("hides error notice when error is null", () => {
    render(<WelcomeScreen error={null} failedPath={null} />);
    expect(screen.queryByText("⚠")).not.toBeInTheDocument();
  });

  it("pre-fills path input with failedPath", () => {
    render(<WelcomeScreen error="Error" failedPath="/home/user/notARepo" />);
    const input = screen.getByLabelText("Repository path") as HTMLInputElement;
    expect(input.value).toBe("/home/user/notARepo");
  });

  it("Open button is disabled when input is empty", () => {
    render(<WelcomeScreen error={null} failedPath={null} />);
    const openButton = screen.getByRole("button", { name: "Open" });
    expect(openButton).toBeDisabled();
  });

  it("Open button is enabled when input has text", () => {
    render(<WelcomeScreen error={null} failedPath="/some/path" />);
    const openButton = screen.getByRole("button", { name: "Open" });
    expect(openButton).toBeEnabled();
  });

  it("calls openRepository when Open is clicked", async () => {
    mockOpenRepository.mockResolvedValue(undefined);
    render(<WelcomeScreen error={null} failedPath="/some/repo" />);

    fireEvent.click(screen.getByRole("button", { name: "Open" }));

    await waitFor(() => {
      expect(mockOpenRepository).toHaveBeenCalledWith("/some/repo");
    });
  });

  it("calls openRepository on Enter key in input", async () => {
    mockOpenRepository.mockResolvedValue(undefined);
    render(<WelcomeScreen error={null} failedPath="/some/repo" />);

    const input = screen.getByLabelText("Repository path");
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(mockOpenRepository).toHaveBeenCalledWith("/some/repo");
    });
  });

  it("shows open error when openRepository fails", async () => {
    mockOpenRepository.mockRejectedValue(new Error("Not a git repo"));
    render(<WelcomeScreen error={null} failedPath="/bad/path" />);

    fireEvent.click(screen.getByRole("button", { name: "Open" }));

    await waitFor(() => {
      expect(screen.getByText(/Not a git repo/)).toBeInTheDocument();
    });
  });

  it("Browse calls dialog open and then openRepository", async () => {
    mockDialogOpen.mockResolvedValue("/selected/repo");
    mockOpenRepository.mockResolvedValue(undefined);

    render(<WelcomeScreen error={null} failedPath="/default/path" />);

    fireEvent.click(screen.getByRole("button", { name: "Browse..." }));

    await waitFor(() => {
      expect(mockDialogOpen).toHaveBeenCalledWith({
        directory: true,
        defaultPath: "/default/path",
      });
    });

    await waitFor(() => {
      expect(mockOpenRepository).toHaveBeenCalledWith("/selected/repo");
    });
  });

  it("Browse does nothing when dialog is cancelled", async () => {
    mockDialogOpen.mockResolvedValue(null);

    render(<WelcomeScreen error={null} failedPath={null} />);

    fireEvent.click(screen.getByRole("button", { name: "Browse..." }));

    await waitFor(() => {
      expect(mockDialogOpen).toHaveBeenCalled();
    });

    expect(mockOpenRepository).not.toHaveBeenCalled();
  });

  it("renders Open a Repository card", () => {
    render(<WelcomeScreen error={null} failedPath={null} />);
    expect(screen.getByText("Open a Repository")).toBeInTheDocument();
    expect(screen.getByText("Select a Git repository to open")).toBeInTheDocument();
  });
});

describe("cleanErrorMessage", () => {
  it("strips 'Git error: ' prefix", () => {
    expect(cleanErrorMessage("Git error: something went wrong")).toBe("something went wrong");
  });

  it("strips '; class=...; code=...' suffix", () => {
    expect(
      cleanErrorMessage(
        "could not find repository from '/tmp/foo'; class=Repository (6); code=NotFound (-3)"
      )
    ).toBe("No git repository found at\n/tmp/foo");
  });

  it("extracts path from 'could not find repository' pattern", () => {
    expect(cleanErrorMessage("could not find repository at '/home/user/notARepo'")).toBe(
      "No git repository found at\n/home/user/notARepo"
    );
  });

  it("handles full git2 error format", () => {
    expect(
      cleanErrorMessage(
        "Git error: could not find repository from '/tmp/test'; class=Repository (6); code=NotFound (-3)"
      )
    ).toBe("No git repository found at\n/tmp/test");
  });

  it("returns cleaned string for other error formats", () => {
    expect(cleanErrorMessage("Some other error")).toBe("Some other error");
  });

  it("preserves simple messages without git2 noise", () => {
    expect(cleanErrorMessage("Permission denied")).toBe("Permission denied");
  });
});
