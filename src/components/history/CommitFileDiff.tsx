import type { FileDiff } from "../../types";
import "./CommitFileDiff.css";

interface CommitFileDiffProps {
  diff: FileDiff;
}

export function CommitFileDiff({ diff }: CommitFileDiffProps) {
  if (diff.is_binary) {
    return <div className="commit-file-diff binary">Binary file - cannot display diff</div>;
  }

  if (diff.hunks.length === 0) {
    return <div className="commit-file-diff empty">No changes to display</div>;
  }

  return (
    <div className="commit-file-diff">
      {diff.hunks.map((hunk, hunkIndex) => (
        <div key={hunkIndex} className="diff-hunk">
          <div className="hunk-lines">
            {hunk.lines.map((line, lineIndex) => (
              <div key={lineIndex} className={`diff-line line-${line.line_type}`}>
                <span className="line-number old">{line.old_lineno ?? ""}</span>
                <span className="line-number new">{line.new_lineno ?? ""}</span>
                <span className="line-prefix">
                  {line.line_type === "addition" ? "+" : line.line_type === "deletion" ? "-" : " "}
                </span>
                <span className="line-content">{line.content}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
