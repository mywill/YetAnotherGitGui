import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CliInstall } from "./CliInstall";
import { checkCliInstalled, installCli } from "../../services/system";

// Mock the system service
vi.mock("../../services/system", () => ({
  checkCliInstalled: vi.fn(),
  installCli: vi.fn(),
}));

describe("CliInstall", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("initial state check", () => {
    it("calls checkCliInstalled on mount", () => {
      vi.mocked(checkCliInstalled).mockResolvedValue(false);

      render(<CliInstall />);

      expect(checkCliInstalled).toHaveBeenCalledTimes(1);
    });
  });

  describe("when CLI is installed", () => {
    it("returns null when CLI is already installed", async () => {
      vi.mocked(checkCliInstalled).mockResolvedValue(true);

      const { container } = render(<CliInstall />);

      await waitFor(() => {
        expect(container.firstChild).toBeNull();
      });
    });
  });

  describe("when CLI is not installed", () => {
    beforeEach(() => {
      vi.mocked(checkCliInstalled).mockResolvedValue(false);
    });

    it("shows install button when CLI is not installed", async () => {
      render(<CliInstall />);

      await waitFor(() => {
        expect(screen.getByText("Install CLI Tool")).toBeInTheDocument();
      });
    });

    it("install button has correct title attribute", async () => {
      render(<CliInstall />);

      await waitFor(() => {
        const button = screen.getByText("Install CLI Tool");
        expect(button).toHaveAttribute(
          "title",
          "Install command-line tool to use 'yagg' from terminal"
        );
      });
    });
  });

  describe("when check fails", () => {
    it("returns null when checkCliInstalled throws error", async () => {
      vi.mocked(checkCliInstalled).mockRejectedValue(new Error("Not on macOS"));

      const { container } = render(<CliInstall />);

      await waitFor(() => {
        expect(container.firstChild).toBeNull();
      });
    });
  });

  describe("installing state", () => {
    beforeEach(() => {
      vi.mocked(checkCliInstalled).mockResolvedValue(false);
    });

    it("shows 'Installing...' during installation", async () => {
      // Make installCli hang to test installing state
      vi.mocked(installCli).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve("/usr/local/bin/yagg"), 1000))
      );

      render(<CliInstall />);

      await waitFor(() => {
        expect(screen.getByText("Install CLI Tool")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Install CLI Tool"));

      expect(screen.getByText("Installing...")).toBeInTheDocument();
    });

    it("disables button during installation", async () => {
      vi.mocked(installCli).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve("/usr/local/bin/yagg"), 1000))
      );

      render(<CliInstall />);

      await waitFor(() => {
        expect(screen.getByText("Install CLI Tool")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Install CLI Tool"));

      expect(screen.getByText("Installing...")).toBeDisabled();
    });
  });

  describe("successful installation", () => {
    beforeEach(() => {
      vi.mocked(checkCliInstalled).mockResolvedValue(false);
    });

    it("sets installed state to true after successful install", async () => {
      vi.mocked(installCli).mockResolvedValue("/usr/local/bin/yagg");

      const { container } = render(<CliInstall />);

      await waitFor(() => {
        expect(screen.getByText("Install CLI Tool")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Install CLI Tool"));

      // After successful install, isInstalled becomes true and component returns null
      await waitFor(() => {
        expect(container.firstChild).toBeNull();
      });
    });

    it("calls installCli when button is clicked", async () => {
      vi.mocked(installCli).mockResolvedValue("/usr/local/bin/yagg");

      render(<CliInstall />);

      await waitFor(() => {
        expect(screen.getByText("Install CLI Tool")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Install CLI Tool"));

      await waitFor(() => {
        expect(installCli).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe("failed installation", () => {
    beforeEach(() => {
      vi.mocked(checkCliInstalled).mockResolvedValue(false);
    });

    it("shows error message on failure", async () => {
      vi.mocked(installCli).mockRejectedValue(new Error("Permission denied"));

      render(<CliInstall />);

      await waitFor(() => {
        expect(screen.getByText("Install CLI Tool")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Install CLI Tool"));

      await waitFor(() => {
        expect(screen.getByText("Error: Permission denied")).toBeInTheDocument();
      });
    });

    it("re-enables button after failure", async () => {
      vi.mocked(installCli).mockRejectedValue(new Error("Permission denied"));

      render(<CliInstall />);

      await waitFor(() => {
        expect(screen.getByText("Install CLI Tool")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Install CLI Tool"));

      await waitFor(() => {
        const button = screen.getByText("Install CLI Tool");
        expect(button).not.toBeDisabled();
      });
    });
  });

  describe("CSS structure", () => {
    beforeEach(() => {
      vi.mocked(checkCliInstalled).mockResolvedValue(false);
    });

    it("has cli-install CSS class", async () => {
      const { container } = render(<CliInstall />);

      await waitFor(() => {
        expect(container.querySelector(".cli-install")).toBeInTheDocument();
      });
    });

    it("button has cli-install-button CSS class", async () => {
      const { container } = render(<CliInstall />);

      await waitFor(() => {
        expect(container.querySelector(".cli-install-button")).toBeInTheDocument();
      });
    });

    it("message has cli-install-message CSS class when error occurs", async () => {
      vi.mocked(installCli).mockRejectedValue(new Error("Permission denied"));

      const { container } = render(<CliInstall />);

      await waitFor(() => {
        expect(screen.getByText("Install CLI Tool")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Install CLI Tool"));

      await waitFor(() => {
        expect(container.querySelector(".cli-install-message")).toBeInTheDocument();
      });
    });
  });

  describe("message clearing", () => {
    beforeEach(() => {
      vi.mocked(checkCliInstalled).mockResolvedValue(false);
    });

    it("clears previous message when starting new install", async () => {
      // First install fails
      vi.mocked(installCli).mockRejectedValueOnce(new Error("First error"));

      render(<CliInstall />);

      await waitFor(() => {
        expect(screen.getByText("Install CLI Tool")).toBeInTheDocument();
      });

      // First click - should show error
      fireEvent.click(screen.getByText("Install CLI Tool"));

      await waitFor(() => {
        expect(screen.getByText("Error: First error")).toBeInTheDocument();
      });

      // Second install succeeds
      vi.mocked(installCli).mockResolvedValueOnce("/usr/local/bin/yagg");

      // Second click - should clear old message
      fireEvent.click(screen.getByText("Install CLI Tool"));

      // Old error should be cleared
      expect(screen.queryByText("Error: First error")).not.toBeInTheDocument();
    });
  });
});
