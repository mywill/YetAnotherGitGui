import type { GraphCommit } from "../../types";

const BRANCH_COLORS = [
  "var(--color-branch-1)",
  "var(--color-branch-2)",
  "var(--color-branch-3)",
  "var(--color-branch-4)",
  "var(--color-branch-5)",
  "var(--color-branch-6)",
  "var(--color-branch-7)",
  "var(--color-branch-8)",
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
    <svg width="100%" height={height} className="branch-lines-svg block">
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
        } else if (fromX !== toX) {
          // Convergence line — branch rejoining (|/ pattern)
          return (
            <path
              key={i}
              d={`M ${fromX} ${nodeY} Q ${fromX} ${height} ${toX} ${height}`}
              fill="none"
              stroke={getColor(line.from_column)}
              strokeWidth={2}
            />
          );
        } else {
          // Normal straight continuation line from node down to next row
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

      {/* Draw the commit node for every commit */}
      <circle
        cx={nodeX}
        cy={nodeY}
        r={NODE_RADIUS}
        fill={commit.is_tip ? getColor(commit.column) : "var(--color-bg-primary)"}
        stroke={getColor(commit.column)}
        strokeWidth={commit.is_tip ? 1 : 2}
      />
    </svg>
  );
}
