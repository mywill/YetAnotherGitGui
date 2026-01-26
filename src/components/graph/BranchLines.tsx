import type { GraphCommit } from "../../types";

const BRANCH_COLORS = [
  "var(--branch-color-1)",
  "var(--branch-color-2)",
  "var(--branch-color-3)",
  "var(--branch-color-4)",
  "var(--branch-color-5)",
  "var(--branch-color-6)",
  "var(--branch-color-7)",
  "var(--branch-color-8)",
];

const COLUMN_WIDTH = 12;
const NODE_RADIUS = 4;

interface BranchLinesProps {
  commit: GraphCommit;
}

export function BranchLines({ commit }: BranchLinesProps) {
  const height = 28;
  const nodeX = COLUMN_WIDTH + commit.column * COLUMN_WIDTH;
  const nodeY = height / 2;

  const getColor = (column: number) => BRANCH_COLORS[column % BRANCH_COLORS.length];

  return (
    <svg width="100%" height={height} className="branch-lines-svg">
      {/* Draw connection lines */}
      {commit.lines.map((line, i) => {
        const fromX = COLUMN_WIDTH + line.from_column * COLUMN_WIDTH;
        const toX = COLUMN_WIDTH + line.to_column * COLUMN_WIDTH;

        if (line.line_type === "pass_through") {
          // Pass-through line - vertical line for branches passing by this row
          return (
            <line
              key={i}
              x1={fromX}
              y1={0}
              x2={fromX}
              y2={height}
              stroke={getColor(line.from_column)}
              strokeWidth={2}
            />
          );
        } else if (line.line_type === "from_above") {
          // Line coming from previous row to this commit's node
          return (
            <line
              key={i}
              x1={fromX}
              y1={0}
              x2={fromX}
              y2={nodeY}
              stroke={getColor(line.from_column)}
              strokeWidth={2}
            />
          );
        } else if (line.is_merge) {
          // Merge line - curves from node to parent column
          return (
            <path
              key={i}
              d={`M ${fromX} ${nodeY} Q ${fromX} ${height} ${toX} ${height}`}
              fill="none"
              stroke={getColor(line.to_column)}
              strokeWidth={2}
            />
          );
        } else {
          // Normal continuation line from node down to next row
          return (
            <line
              key={i}
              x1={fromX}
              y1={nodeY}
              x2={toX}
              y2={height}
              stroke={getColor(line.from_column)}
              strokeWidth={2}
            />
          );
        }
      })}

      {/* Draw the commit node - only for branch tips */}
      {commit.is_tip && (
        <circle
          cx={nodeX}
          cy={nodeY}
          r={NODE_RADIUS}
          fill={getColor(commit.column)}
          stroke={getColor(commit.column)}
          strokeWidth={1}
        />
      )}
    </svg>
  );
}
