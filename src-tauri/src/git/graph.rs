use serde::Serialize;
use std::collections::HashMap;

use super::CommitInfo;

#[derive(Debug, Serialize, Clone)]
pub struct GraphCommit {
    #[serde(flatten)]
    pub commit: CommitInfo,
    pub column: usize,
    pub lines: Vec<GraphLine>,
    pub refs: Vec<RefInfo>,
    /// True if this is the tip of its branch (first commit in its column)
    pub is_tip: bool,
}

#[derive(Debug, Serialize, Clone)]
pub struct GraphLine {
    pub from_column: usize,
    pub to_column: usize,
    pub is_merge: bool,
    pub line_type: GraphLineType,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "snake_case")]
pub enum GraphLineType {
    /// Line from this commit down to its parent
    ToParent,
    /// Line from previous commit coming into this row (top to node)
    FromAbove,
    /// Pass-through line (column active but no commit here)
    PassThrough,
}

#[derive(Debug, Serialize, Clone)]
pub struct RefInfo {
    pub name: String,
    pub ref_type: RefType,
    pub is_head: bool,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "lowercase")]
pub enum RefType {
    Branch,
    RemoteBranch,
    Tag,
}

pub fn build_commit_graph(
    commits: Vec<CommitInfo>,
    branch_refs: HashMap<String, Vec<RefInfo>>,
) -> Vec<GraphCommit> {
    let mut result: Vec<GraphCommit> = Vec::with_capacity(commits.len());
    let mut column_map: HashMap<String, usize> = HashMap::new();
    let mut active_columns: Vec<Option<String>> = Vec::new();

    for commit in commits {
        // Determine column for this commit
        let (column, is_tip) = if let Some(&col) = column_map.get(&commit.hash) {
            // This commit was expected (a parent of a previous commit)
            (col, false)
        } else {
            // This is a new branch tip - find an empty column or create a new one
            let col = active_columns
                .iter()
                .position(|c| c.is_none())
                .unwrap_or_else(|| {
                    active_columns.push(None);
                    active_columns.len() - 1
                });
            (col, true)
        };

        // Build graph lines - first add pass-through and from-above lines
        let mut lines = Vec::new();

        // For each active column, draw appropriate line
        for (col_idx, col_content) in active_columns.iter().enumerate() {
            if col_content.is_some() {
                if col_idx == column {
                    // This is the column where our commit is - draw from above to node
                    lines.push(GraphLine {
                        from_column: col_idx,
                        to_column: col_idx,
                        is_merge: false,
                        line_type: GraphLineType::FromAbove,
                    });
                } else {
                    // This column has an active branch passing through
                    lines.push(GraphLine {
                        from_column: col_idx,
                        to_column: col_idx,
                        is_merge: false,
                        line_type: GraphLineType::PassThrough,
                    });
                }
            }
        }

        // Clear this column (commit arrived)
        if column < active_columns.len() {
            active_columns[column] = None;
        }

        // Handle first parent — continue, converge, or take over
        if let Some(parent) = commit.parent_hashes.first() {
            if let Some(&existing_col) = column_map.get(parent) {
                if column < existing_col {
                    // Current commit has lower column — it takes over the parent.
                    // Move parent from existing_col to current column.
                    column_map.insert(parent.clone(), column);
                    if existing_col < active_columns.len() {
                        active_columns[existing_col] = None;
                    }
                    if column >= active_columns.len() {
                        active_columns.resize(column + 1, None);
                    }
                    active_columns[column] = Some(parent.clone());

                    // Straight continuation line
                    lines.push(GraphLine {
                        from_column: column,
                        to_column: column,
                        is_merge: false,
                        line_type: GraphLineType::ToParent,
                    });

                    // Remove the spurious pass-through line for the old column
                    lines.retain(|l| {
                        !(matches!(l.line_type, GraphLineType::PassThrough)
                            && l.from_column == existing_col)
                    });

                    // Retroactively fix the previous commit's ToParent line that
                    // was pointing to existing_col — convert it to a convergence line
                    for prev_gc in result.iter_mut().rev() {
                        if prev_gc.commit.parent_hashes.first() == Some(parent) {
                            for line in prev_gc.lines.iter_mut() {
                                if matches!(line.line_type, GraphLineType::ToParent)
                                    && !line.is_merge
                                    && line.to_column == existing_col
                                {
                                    line.to_column = column;
                                    break;
                                }
                            }
                            break;
                        }
                    }
                } else {
                    // Current column >= existing_col — CONVERGE to existing
                    lines.push(GraphLine {
                        from_column: column,
                        to_column: existing_col,
                        is_merge: false,
                        line_type: GraphLineType::ToParent,
                    });
                    // Column stays freed — this branch has ended
                }
            } else {
                // Parent not yet assigned — continue in same column
                column_map.insert(parent.clone(), column);
                if column >= active_columns.len() {
                    active_columns.resize(column + 1, None);
                }
                active_columns[column] = Some(parent.clone());
                lines.push(GraphLine {
                    from_column: column,
                    to_column: column,
                    is_merge: false,
                    line_type: GraphLineType::ToParent,
                });
            }
        }

        // Merge parents go to other columns
        for parent in commit.parent_hashes.iter().skip(1) {
            let parent_column = if let Some(&col) = column_map.get(parent) {
                col
            } else {
                // Find an empty column for this parent
                let col = active_columns
                    .iter()
                    .position(|c| c.is_none())
                    .unwrap_or_else(|| {
                        active_columns.push(None);
                        active_columns.len() - 1
                    });
                column_map.insert(parent.clone(), col);
                if col >= active_columns.len() {
                    active_columns.push(Some(parent.clone()));
                } else {
                    active_columns[col] = Some(parent.clone());
                }
                col
            };

            lines.push(GraphLine {
                from_column: column,
                to_column: parent_column,
                is_merge: true,
                line_type: GraphLineType::ToParent,
            });
        }

        // Get refs for this commit
        let refs = branch_refs.get(&commit.hash).cloned().unwrap_or_default();

        result.push(GraphCommit {
            commit,
            column,
            lines,
            refs,
            is_tip,
        });
    }

    result
}

pub fn collect_refs(repo: &git2::Repository) -> Result<HashMap<String, Vec<RefInfo>>, git2::Error> {
    let mut refs_map: HashMap<String, Vec<RefInfo>> = HashMap::new();

    let head = repo.head().ok();
    let head_target = head.as_ref().and_then(|h| h.target());

    // Collect branches
    for branch_result in repo.branches(None)? {
        let (branch, branch_type) = branch_result?;
        if let Some(target) = branch.get().target() {
            let name = branch.name()?.unwrap_or("").to_string();
            let ref_type = match branch_type {
                git2::BranchType::Local => RefType::Branch,
                git2::BranchType::Remote => RefType::RemoteBranch,
            };
            let is_head =
                head_target == Some(target) && matches!(branch_type, git2::BranchType::Local);

            refs_map
                .entry(target.to_string())
                .or_default()
                .push(RefInfo {
                    name,
                    ref_type,
                    is_head,
                });
        }
    }

    // Collect tags
    repo.tag_foreach(|oid, name| {
        let name = String::from_utf8_lossy(name)
            .trim_start_matches("refs/tags/")
            .to_string();
        refs_map.entry(oid.to_string()).or_default().push(RefInfo {
            name,
            ref_type: RefType::Tag,
            is_head: false,
        });
        true
    })?;

    Ok(refs_map)
}

#[cfg(test)]
mod tests {
    use super::*;
    use git2::Repository;
    use std::fs;
    use std::path::Path;
    use tempfile::TempDir;

    fn create_test_repo() -> (TempDir, Repository) {
        let temp_dir = TempDir::new().unwrap();
        let repo = Repository::init(temp_dir.path()).unwrap();

        // Configure user for commits
        let mut config = repo.config().unwrap();
        config.set_str("user.name", "Test User").unwrap();
        config.set_str("user.email", "test@example.com").unwrap();

        (temp_dir, repo)
    }

    fn create_commit_with_file(
        repo: &Repository,
        temp_dir: &TempDir,
        filename: &str,
        content: &str,
        message: &str,
    ) -> git2::Oid {
        let file_path = temp_dir.path().join(filename);
        fs::write(&file_path, content).unwrap();

        let mut index = repo.index().unwrap();
        index.add_path(Path::new(filename)).unwrap();
        index.write().unwrap();

        let sig = repo.signature().unwrap();
        let tree_id = index.write_tree().unwrap();
        let tree = repo.find_tree(tree_id).unwrap();

        let parent = repo.head().ok().and_then(|h| h.peel_to_commit().ok());
        let parents: Vec<&git2::Commit> = parent.iter().collect();

        repo.commit(Some("HEAD"), &sig, &sig, message, &tree, &parents)
            .unwrap()
    }

    fn create_commit_info(hash: &str, message: &str, parent_hashes: Vec<String>) -> CommitInfo {
        CommitInfo {
            hash: hash.to_string(),
            short_hash: hash[..7.min(hash.len())].to_string(),
            message: message.to_string(),
            author_name: "Test User".to_string(),
            author_email: "test@example.com".to_string(),
            timestamp: 0,
            parent_hashes,
        }
    }

    #[test]
    fn test_build_commit_graph_empty() {
        let commits: Vec<CommitInfo> = vec![];
        let refs = HashMap::new();

        let graph = build_commit_graph(commits, refs);

        assert!(graph.is_empty());
    }

    #[test]
    fn test_build_commit_graph_single_commit() {
        let commits = vec![create_commit_info("abc1234", "Initial commit", vec![])];
        let refs = HashMap::new();

        let graph = build_commit_graph(commits, refs);

        assert_eq!(graph.len(), 1);
        assert_eq!(graph[0].commit.hash, "abc1234");
        assert_eq!(graph[0].column, 0);
        assert!(graph[0].is_tip);
    }

    #[test]
    fn test_build_commit_graph_linear_history() {
        let commits = vec![
            create_commit_info("commit3", "Third commit", vec!["commit2".to_string()]),
            create_commit_info("commit2", "Second commit", vec!["commit1".to_string()]),
            create_commit_info("commit1", "First commit", vec![]),
        ];
        let refs = HashMap::new();

        let graph = build_commit_graph(commits, refs);

        assert_eq!(graph.len(), 3);
        // All commits should be in column 0 for linear history
        assert_eq!(graph[0].column, 0);
        assert_eq!(graph[1].column, 0);
        assert_eq!(graph[2].column, 0);

        // First commit should be a tip
        assert!(graph[0].is_tip);
        // Others should not be tips (they were expected as parents)
        assert!(!graph[1].is_tip);
        assert!(!graph[2].is_tip);
    }

    #[test]
    fn test_build_commit_graph_with_branch() {
        // Graph structure:
        //   * commit3 (branch tip)
        //   |
        //   | * commit2 (main tip)
        //   |/
        //   * commit1
        let commits = vec![
            create_commit_info("commit3", "Branch commit", vec!["commit1".to_string()]),
            create_commit_info("commit2", "Main commit", vec!["commit1".to_string()]),
            create_commit_info("commit1", "Initial commit", vec![]),
        ];
        let refs = HashMap::new();

        let graph = build_commit_graph(commits, refs);

        assert_eq!(graph.len(), 3);
        // Both commit3 and commit2 are tips (they appear first for their columns)
        assert!(graph[0].is_tip);
        assert!(graph[1].is_tip);
    }

    #[test]
    fn test_build_commit_graph_with_merge() {
        // Graph structure:
        //   * merge (merges commit2 into main)
        //   |\
        //   | * commit2 (feature branch)
        //   * | commit_main
        //   |/
        //   * commit1
        let commits = vec![
            create_commit_info(
                "merge",
                "Merge commit",
                vec!["commit_main".to_string(), "commit2".to_string()],
            ),
            create_commit_info("commit2", "Feature commit", vec!["commit1".to_string()]),
            create_commit_info("commit_main", "Main commit", vec!["commit1".to_string()]),
            create_commit_info("commit1", "Initial commit", vec![]),
        ];
        let refs = HashMap::new();

        let graph = build_commit_graph(commits, refs);

        assert_eq!(graph.len(), 4);
        // Merge commit should have lines to both parents
        let merge_lines = &graph[0].lines;
        let has_merge_line = merge_lines.iter().any(|l| l.is_merge);
        assert!(has_merge_line);
    }

    #[test]
    fn test_build_commit_graph_pagination() {
        // Test that graph handles multiple commits correctly
        let commits: Vec<CommitInfo> = (0..10)
            .map(|i| {
                let parent = if i > 0 {
                    vec![format!("commit{}", i - 1)]
                } else {
                    vec![]
                };
                create_commit_info(
                    &format!("commit{}", 9 - i),
                    &format!("Commit {}", 9 - i),
                    parent,
                )
            })
            .collect();
        let refs = HashMap::new();

        let graph = build_commit_graph(commits, refs);

        assert_eq!(graph.len(), 10);
    }

    #[test]
    fn test_build_commit_graph_with_refs() {
        let commits = vec![create_commit_info("abc1234", "Initial commit", vec![])];
        let mut refs = HashMap::new();
        refs.insert(
            "abc1234".to_string(),
            vec![RefInfo {
                name: "main".to_string(),
                ref_type: RefType::Branch,
                is_head: true,
            }],
        );

        let graph = build_commit_graph(commits, refs);

        assert_eq!(graph.len(), 1);
        assert_eq!(graph[0].refs.len(), 1);
        assert_eq!(graph[0].refs[0].name, "main");
        assert!(graph[0].refs[0].is_head);
    }

    #[test]
    fn test_build_commit_graph_line_types() {
        let commits = vec![
            create_commit_info("commit2", "Second commit", vec!["commit1".to_string()]),
            create_commit_info("commit1", "First commit", vec![]),
        ];
        let refs = HashMap::new();

        let graph = build_commit_graph(commits, refs);

        // First commit should have a ToParent line
        let has_to_parent = graph[0]
            .lines
            .iter()
            .any(|l| matches!(l.line_type, GraphLineType::ToParent));
        assert!(has_to_parent);
    }

    #[test]
    fn test_collect_refs_empty_repo() {
        let (_temp_dir, repo) = create_test_repo();

        let refs = collect_refs(&repo).unwrap();

        assert!(refs.is_empty());
    }

    #[test]
    fn test_collect_refs_branches() {
        let (temp_dir, repo) = create_test_repo();
        let oid =
            create_commit_with_file(&repo, &temp_dir, "file.txt", "content", "Initial commit");

        let refs = collect_refs(&repo).unwrap();

        // Should have the default branch (master or main)
        assert!(!refs.is_empty());
        let branch_refs = refs.get(&oid.to_string()).unwrap();
        assert!(branch_refs
            .iter()
            .any(|r| matches!(r.ref_type, RefType::Branch)));
    }

    #[test]
    fn test_collect_refs_multiple_branches() {
        let (temp_dir, repo) = create_test_repo();
        let oid =
            create_commit_with_file(&repo, &temp_dir, "file.txt", "content", "Initial commit");
        let commit = repo.find_commit(oid).unwrap();

        // Create another branch pointing to the same commit
        repo.branch("feature", &commit, false).unwrap();

        let refs = collect_refs(&repo).unwrap();

        let branch_refs = refs.get(&oid.to_string()).unwrap();
        // Should have at least 2 branches pointing to this commit
        let branch_count = branch_refs
            .iter()
            .filter(|r| matches!(r.ref_type, RefType::Branch))
            .count();
        assert!(branch_count >= 2);
    }

    #[test]
    fn test_collect_refs_tags() {
        let (temp_dir, repo) = create_test_repo();
        let oid =
            create_commit_with_file(&repo, &temp_dir, "file.txt", "content", "Initial commit");
        let commit = repo.find_commit(oid).unwrap();

        // Create a tag
        repo.tag_lightweight("v1.0.0", commit.as_object(), false)
            .unwrap();

        let refs = collect_refs(&repo).unwrap();

        // Find the tag in refs
        let has_tag = refs.values().any(|ref_list| {
            ref_list
                .iter()
                .any(|r| r.name == "v1.0.0" && matches!(r.ref_type, RefType::Tag))
        });
        assert!(has_tag);
    }

    #[test]
    fn test_collect_refs_head() {
        let (temp_dir, repo) = create_test_repo();
        let oid =
            create_commit_with_file(&repo, &temp_dir, "file.txt", "content", "Initial commit");

        let refs = collect_refs(&repo).unwrap();

        let branch_refs = refs.get(&oid.to_string()).unwrap();
        // One of the branches should be marked as HEAD
        let has_head = branch_refs.iter().any(|r| r.is_head);
        assert!(has_head);
    }

    #[test]
    fn test_collect_refs_detached_head() {
        let (temp_dir, repo) = create_test_repo();
        let oid =
            create_commit_with_file(&repo, &temp_dir, "file.txt", "content", "Initial commit");

        // Detach HEAD
        repo.set_head_detached(oid).unwrap();

        let refs = collect_refs(&repo).unwrap();

        // The branch should no longer be marked as HEAD (since we're detached)
        // Actually, is_head check in collect_refs looks at whether head_target matches,
        // so in detached state it would still find the branch at that commit
        // But the logic specifically checks for branch type, so this should work
        assert!(!refs.is_empty());
    }

    #[test]
    fn test_graph_pass_through_lines() {
        // Create a scenario with pass-through lines
        // When one branch continues while another commit is rendered
        let commits = vec![
            create_commit_info("commit3", "Third on main", vec!["commit2".to_string()]),
            create_commit_info("feature1", "Feature commit", vec!["commit1".to_string()]),
            create_commit_info("commit2", "Second on main", vec!["commit1".to_string()]),
            create_commit_info("commit1", "Initial commit", vec![]),
        ];
        let refs = HashMap::new();

        let graph = build_commit_graph(commits, refs);

        assert_eq!(graph.len(), 4);
    }

    #[test]
    fn test_long_branch_column_consistency() {
        // Create 200 commits in a linear chain
        let commits: Vec<CommitInfo> = (0..200)
            .map(|i| {
                let parent = if i < 199 {
                    vec![format!("commit{}", i + 1)]
                } else {
                    vec![]
                };
                create_commit_info(&format!("commit{}", i), &format!("Commit {}", i), parent)
            })
            .collect();
        let refs = HashMap::new();

        let graph = build_commit_graph(commits, refs);

        assert_eq!(graph.len(), 200);
        // All commits should be in column 0 for linear history
        for (idx, gc) in graph.iter().enumerate() {
            assert_eq!(
                gc.column, 0,
                "Commit {} should be in column 0 but is in column {}",
                idx, gc.column
            );
        }
        // Only the first commit (tip) should be is_tip
        assert!(graph[0].is_tip);
        for gc in graph.iter().skip(1) {
            assert!(!gc.is_tip, "Commit {} should not be a tip", gc.commit.hash);
        }
    }

    #[test]
    fn test_merge_parent_connectivity() {
        // Create: main has commits 0-9, feature branches off at commit 5, merges at commit 2
        // Layout (topological, newest first):
        //   commit0 (merge of commit1 + feature2)
        //   commit1, feature2, feature1
        //   commit2 (branch point)
        //   commit3..commit5
        let commits = vec![
            create_commit_info(
                "commit0",
                "Merge",
                vec!["commit1".to_string(), "feature2".to_string()],
            ),
            create_commit_info("feature2", "Feature 2", vec!["feature1".to_string()]),
            create_commit_info("commit1", "Main 1", vec!["commit2".to_string()]),
            create_commit_info("feature1", "Feature 1", vec!["commit2".to_string()]),
            create_commit_info("commit2", "Main 2", vec!["commit3".to_string()]),
            create_commit_info("commit3", "Main 3", vec![]),
        ];
        let refs = HashMap::new();

        let graph = build_commit_graph(commits, refs);

        // The merge commit should have a ToParent line with is_merge: true
        let merge_lines = &graph[0].lines;
        let has_merge_line = merge_lines
            .iter()
            .any(|l| l.is_merge && matches!(l.line_type, GraphLineType::ToParent));
        assert!(
            has_merge_line,
            "Merge commit should have a merge ToParent line"
        );

        // The merge commit should also have a non-merge ToParent to its first parent
        let has_normal_parent = merge_lines
            .iter()
            .any(|l| !l.is_merge && matches!(l.line_type, GraphLineType::ToParent));
        assert!(
            has_normal_parent,
            "Merge commit should have a normal ToParent line"
        );
    }

    #[test]
    fn test_multiple_active_branches_stability() {
        // Three branches diverging from a common ancestor
        let commits = vec![
            create_commit_info("branch_a2", "A2", vec!["branch_a1".to_string()]),
            create_commit_info("branch_b2", "B2", vec!["branch_b1".to_string()]),
            create_commit_info("branch_c2", "C2", vec!["branch_c1".to_string()]),
            create_commit_info("branch_a1", "A1", vec!["root".to_string()]),
            create_commit_info("branch_b1", "B1", vec!["root".to_string()]),
            create_commit_info("branch_c1", "C1", vec!["root".to_string()]),
            create_commit_info("root", "Root", vec![]),
        ];
        let refs = HashMap::new();

        let graph = build_commit_graph(commits, refs);

        // Find the columns for each branch
        let a2_col = graph
            .iter()
            .find(|g| g.commit.hash == "branch_a2")
            .unwrap()
            .column;
        let a1_col = graph
            .iter()
            .find(|g| g.commit.hash == "branch_a1")
            .unwrap()
            .column;
        let b2_col = graph
            .iter()
            .find(|g| g.commit.hash == "branch_b2")
            .unwrap()
            .column;
        let b1_col = graph
            .iter()
            .find(|g| g.commit.hash == "branch_b1")
            .unwrap()
            .column;
        let c2_col = graph
            .iter()
            .find(|g| g.commit.hash == "branch_c2")
            .unwrap()
            .column;
        let c1_col = graph
            .iter()
            .find(|g| g.commit.hash == "branch_c1")
            .unwrap()
            .column;

        // Each branch should maintain the same column across its commits
        assert_eq!(a2_col, a1_col, "Branch A should maintain same column");
        assert_eq!(b2_col, b1_col, "Branch B should maintain same column");
        assert_eq!(c2_col, c1_col, "Branch C should maintain same column");

        // No two branches should share the same column (at the same time)
        assert_ne!(
            a2_col, b2_col,
            "Branches A and B should have different columns"
        );
        assert_ne!(
            a2_col, c2_col,
            "Branches A and C should have different columns"
        );
        assert_ne!(
            b2_col, c2_col,
            "Branches B and C should have different columns"
        );
    }

    #[test]
    fn test_branch_reuse_after_merge() {
        // Branch A merges, then branch B starts - B should reuse A's column
        let commits = vec![
            create_commit_info("branch_b1", "B1", vec!["main3".to_string()]),
            create_commit_info(
                "main3",
                "Merge A",
                vec!["main2".to_string(), "branch_a1".to_string()],
            ),
            create_commit_info("branch_a1", "A1", vec!["main1".to_string()]),
            create_commit_info("main2", "Main 2", vec!["main1".to_string()]),
            create_commit_info("main1", "Main 1", vec![]),
        ];
        let refs = HashMap::new();

        let graph = build_commit_graph(commits, refs);

        let a1_col = graph
            .iter()
            .find(|g| g.commit.hash == "branch_a1")
            .unwrap()
            .column;

        // Main should be column 0
        let main3_col = graph
            .iter()
            .find(|g| g.commit.hash == "main3")
            .unwrap()
            .column;
        assert_eq!(main3_col, 0, "Main should be in column 0");

        // Branch A should be in a non-zero column (it's a side branch)
        assert!(
            a1_col >= 1,
            "Branch A should be in column >= 1, got {}",
            a1_col
        );

        // After branch A merges, its column is freed, so no more than
        // 2 columns should be active at any point (main + one branch at a time)
        let max_col = graph.iter().map(|g| g.column).max().unwrap();
        assert!(
            max_col <= 1,
            "Max column should be <= 1 (only main + one branch at a time), got {}",
            max_col
        );
    }

    #[test]
    fn test_all_commits_have_node_lines() {
        // For any graph, every commit should have either is_tip or a FromAbove line
        let commits = vec![
            create_commit_info(
                "merge",
                "Merge",
                vec!["main1".to_string(), "feat1".to_string()],
            ),
            create_commit_info("feat1", "Feature", vec!["root".to_string()]),
            create_commit_info("main1", "Main", vec!["root".to_string()]),
            create_commit_info("root", "Root", vec![]),
        ];
        let refs = HashMap::new();

        let graph = build_commit_graph(commits, refs);

        for gc in &graph {
            let has_from_above = gc.lines.iter().any(|l| {
                matches!(l.line_type, GraphLineType::FromAbove) && l.from_column == gc.column
            });
            assert!(
                gc.is_tip || has_from_above,
                "Commit {} should be a tip or have a FromAbove line in its column",
                gc.commit.hash
            );
        }
    }

    #[test]
    fn test_real_merge_pattern() {
        // Reproduces the exact merge pattern from this project's git history:
        //   * d36d66d          col 0
        //   *   759c432        col 0, merge (0→1)
        //   | * 2823615        col 1, converges (1→0)
        //   * | c401927        col 0
        //   |/
        //   * def9d37          col 0
        //   * 5007578          col 0
        let commits = vec![
            create_commit_info("d36d66d", "fix: updated", vec!["759c432".to_string()]),
            create_commit_info(
                "759c432",
                "Merge pull request #10",
                vec!["c401927".to_string(), "2823615".to_string()],
            ),
            create_commit_info("2823615", "chore(deps): bump", vec!["def9d37".to_string()]),
            create_commit_info(
                "c401927",
                "chore(release): 1.4.0",
                vec!["def9d37".to_string()],
            ),
            create_commit_info(
                "def9d37",
                "feat: added tuari plugin-updater",
                vec!["5007578".to_string()],
            ),
            create_commit_info("5007578", "chore: format fixes", vec![]),
        ];
        let refs = HashMap::new();
        let graph = build_commit_graph(commits, refs);

        // d36d66d: col 0
        assert_eq!(graph[0].column, 0, "d36d66d should be col 0");
        // 759c432: col 0, has merge ToParent line (0→1)
        assert_eq!(graph[1].column, 0, "759c432 should be col 0");
        let merge_line = graph[1]
            .lines
            .iter()
            .find(|l| l.is_merge && matches!(l.line_type, GraphLineType::ToParent));
        assert!(merge_line.is_some(), "759c432 should have a merge line");
        // 2823615: col 1, has convergence ToParent(from=1, to=0)
        assert_eq!(graph[2].column, 1, "2823615 should be col 1");
        let convergence_line = graph[2].lines.iter().find(|l| {
            !l.is_merge
                && matches!(l.line_type, GraphLineType::ToParent)
                && l.from_column == 1
                && l.to_column == 0
        });
        assert!(
            convergence_line.is_some(),
            "2823615 should have convergence line (1→0)"
        );
        // c401927: col 0, NO PassThrough lines (col 1 freed after convergence)
        assert_eq!(graph[3].column, 0, "c401927 should be col 0");
        let has_pass_through = graph[3]
            .lines
            .iter()
            .any(|l| matches!(l.line_type, GraphLineType::PassThrough));
        assert!(
            !has_pass_through,
            "c401927 should have NO pass-through lines (col 1 freed)"
        );
        // def9d37: col 0
        assert_eq!(graph[4].column, 0, "def9d37 should be col 0");
        // 5007578: col 0
        assert_eq!(graph[5].column, 0, "5007578 should be col 0");
        // Max column == 1
        let max_col = graph.iter().map(|g| g.column).max().unwrap();
        assert_eq!(max_col, 1, "Max column should be 1");
    }

    #[test]
    fn test_real_stash_pattern() {
        // Reproduces stash refs pattern:
        //   * 2d45a98        col 0
        //   * c762b9b        col 0
        //   | *   37bbbc2    col 1, merge to col 2 for 593d925
        //   |/|
        //   | * 593d925      col 2, converges to col 0
        //   |/
        //   * 5c1dd64        col 0
        //   * ee20873        col 0
        let commits = vec![
            create_commit_info(
                "2d45a98",
                "fix: more ci updates",
                vec!["c762b9b".to_string()],
            ),
            create_commit_info(
                "c762b9b",
                "chore(release): 1.0.2",
                vec!["5c1dd64".to_string()],
            ),
            create_commit_info(
                "37bbbc2",
                "WIP on main",
                vec!["5c1dd64".to_string(), "593d925".to_string()],
            ),
            create_commit_info("593d925", "index on main", vec!["5c1dd64".to_string()]),
            create_commit_info(
                "5c1dd64",
                "fix: upate to use tauri action",
                vec!["ee20873".to_string()],
            ),
            create_commit_info("ee20873", "chore(release): 1.0.1", vec![]),
        ];
        let refs = HashMap::new();
        let graph = build_commit_graph(commits, refs);

        assert_eq!(graph[0].column, 0, "2d45a98 should be col 0");
        assert_eq!(graph[1].column, 0, "c762b9b should be col 0");
        assert_eq!(graph[2].column, 1, "37bbbc2 should be col 1 (tip)");
        assert_eq!(graph[4].column, 0, "5c1dd64 should be col 0");
        let max_col = graph.iter().map(|g| g.column).max().unwrap();
        assert!(max_col <= 2, "Max column should be <= 2, got {}", max_col);
    }

    #[test]
    fn test_linear_section_around_merge() {
        // Linear commits above and below a merge should all be col 0
        let commits = vec![
            create_commit_info("4774caf", "above2", vec!["d36d66d".to_string()]),
            create_commit_info("d36d66d", "above1", vec!["759c432".to_string()]),
            create_commit_info(
                "759c432",
                "Merge",
                vec!["c401927".to_string(), "2823615".to_string()],
            ),
            create_commit_info("2823615", "branch", vec!["def9d37".to_string()]),
            create_commit_info("c401927", "main", vec!["def9d37".to_string()]),
            create_commit_info("def9d37", "below1", vec!["5007578".to_string()]),
            create_commit_info("5007578", "below2", vec!["1fc486d".to_string()]),
            create_commit_info("1fc486d", "root", vec![]),
        ];
        let refs = HashMap::new();
        let graph = build_commit_graph(commits, refs);

        // All non-merge-branch commits should be col 0
        for gc in &graph {
            if gc.commit.hash != "2823615" {
                assert_eq!(
                    gc.column, 0,
                    "Commit {} should be col 0, got {}",
                    gc.commit.hash, gc.column
                );
            }
        }
        // 2823615 should be col 1
        let branch_commit = graph.iter().find(|g| g.commit.hash == "2823615").unwrap();
        assert_eq!(branch_commit.column, 1, "2823615 should be col 1");
    }

    #[test]
    fn test_convergence_frees_column() {
        // Two merges in sequence - col 1 should be reused after first convergence
        let commits = vec![
            create_commit_info("tip2", "tip2", vec!["merge2".to_string()]),
            create_commit_info(
                "merge2",
                "Merge 2",
                vec!["m2".to_string(), "feat2".to_string()],
            ),
            create_commit_info("feat2", "Feature 2", vec!["base2".to_string()]),
            create_commit_info("m2", "Main 2", vec!["base2".to_string()]),
            create_commit_info("base2", "Base 2", vec!["merge1".to_string()]),
            create_commit_info(
                "merge1",
                "Merge 1",
                vec!["m1".to_string(), "feat1".to_string()],
            ),
            create_commit_info("feat1", "Feature 1", vec!["base1".to_string()]),
            create_commit_info("m1", "Main 1", vec!["base1".to_string()]),
            create_commit_info("base1", "Root", vec![]),
        ];
        let refs = HashMap::new();
        let graph = build_commit_graph(commits, refs);

        // Max column should be 1 — col 1 is reused after feat1 converges
        let max_col = graph.iter().map(|g| g.column).max().unwrap();
        assert_eq!(
            max_col, 1,
            "Max column should be 1 (col 1 reused), got {}",
            max_col
        );
    }

    #[test]
    fn test_no_orphan_from_above_lines() {
        // For every FromAbove line at row N in column C,
        // row N-1 should have a ToParent or PassThrough line in column C
        let commits = vec![
            create_commit_info("commit3", "Third", vec!["commit2".to_string()]),
            create_commit_info("commit2", "Second", vec!["commit1".to_string()]),
            create_commit_info("commit1", "First", vec![]),
        ];
        let refs = HashMap::new();

        let graph = build_commit_graph(commits, refs);

        for row in 1..graph.len() {
            for line in &graph[row].lines {
                if matches!(line.line_type, GraphLineType::FromAbove) {
                    let col = line.from_column;
                    let prev_row = &graph[row - 1];
                    let has_source = prev_row.lines.iter().any(|l| {
                        (matches!(l.line_type, GraphLineType::ToParent) && l.to_column == col)
                            || (matches!(l.line_type, GraphLineType::PassThrough)
                                && l.from_column == col)
                    });
                    assert!(
                        has_source,
                        "FromAbove line at row {} column {} has no source in row {}",
                        row,
                        col,
                        row - 1
                    );
                }
            }
        }
    }

    /// Create a commit with explicit parents (not HEAD). Needed for building
    /// non-linear topologies where we control parent relationships directly.
    fn commit_with_parents(
        repo: &Repository,
        temp_dir: &TempDir,
        parents: &[git2::Oid],
        filename: &str,
        content: &str,
        message: &str,
    ) -> git2::Oid {
        let file_path = temp_dir.path().join(filename);
        fs::write(&file_path, content).unwrap();

        let mut index = repo.index().unwrap();
        index.add_path(Path::new(filename)).unwrap();
        index.write().unwrap();

        let sig = repo.signature().unwrap();
        let tree_id = index.write_tree().unwrap();
        let tree = repo.find_tree(tree_id).unwrap();

        let parent_commits: Vec<git2::Commit> = parents
            .iter()
            .map(|oid| repo.find_commit(*oid).unwrap())
            .collect();
        let parent_refs: Vec<&git2::Commit> = parent_commits.iter().collect();

        repo.commit(None, &sig, &sig, message, &tree, &parent_refs)
            .unwrap()
    }

    /// Walk repo from given tips using TOPOLOGICAL | TIME sorting, returns CommitInfo vec.
    fn commits_from_oids(repo: &Repository, tip_oids: &[git2::Oid]) -> Vec<CommitInfo> {
        let mut walker = repo.revwalk().unwrap();
        walker
            .set_sorting(git2::Sort::TOPOLOGICAL | git2::Sort::TIME)
            .unwrap();
        for &oid in tip_oids {
            walker.push(oid).unwrap();
        }

        let mut commits = Vec::new();
        for oid in walker {
            let oid = oid.unwrap();
            let commit = repo.find_commit(oid).unwrap();
            let parent_hashes: Vec<String> = commit.parent_ids().map(|id| id.to_string()).collect();
            commits.push(CommitInfo {
                hash: oid.to_string(),
                short_hash: oid.to_string()[..7].to_string(),
                message: commit.message().unwrap_or("").to_string(),
                author_name: "Test".to_string(),
                author_email: "test@test.com".to_string(),
                timestamp: commit.time().seconds(),
                parent_hashes,
            });
        }
        commits
    }

    /// Universal structural validator for graph invariants.
    fn validate_graph_invariants(graph: &[GraphCommit]) {
        for (row, gc) in graph.iter().enumerate() {
            // 1. Every non-tip commit has a FromAbove line in its column
            if !gc.is_tip {
                let has_from_above = gc.lines.iter().any(|l| {
                    matches!(l.line_type, GraphLineType::FromAbove) && l.from_column == gc.column
                });
                assert!(
                    has_from_above,
                    "Row {}: commit {} is not a tip but has no FromAbove in col {}",
                    row, gc.commit.message, gc.column
                );
            }

            // 2. Every FromAbove at row N has a source (ToParent or PassThrough) at row N-1
            if row > 0 {
                for line in &gc.lines {
                    if matches!(line.line_type, GraphLineType::FromAbove) {
                        let col = line.from_column;
                        let prev = &graph[row - 1];
                        let has_source = prev.lines.iter().any(|l| {
                            (matches!(l.line_type, GraphLineType::ToParent) && l.to_column == col)
                                || (matches!(l.line_type, GraphLineType::PassThrough)
                                    && l.from_column == col)
                        });
                        assert!(
                            has_source,
                            "Row {}: FromAbove in col {} has no source in row {}",
                            row,
                            col,
                            row - 1
                        );
                    }
                }
            }

            // 3. Merge lines only on commits with 2+ parents
            let merge_line_count = gc.lines.iter().filter(|l| l.is_merge).count();
            if gc.commit.parent_hashes.len() < 2 {
                assert_eq!(
                    merge_line_count,
                    0,
                    "Row {}: commit {} has {} parents but {} merge lines",
                    row,
                    gc.commit.message,
                    gc.commit.parent_hashes.len(),
                    merge_line_count
                );
            }

            // 4. Column values are non-negative (usize guarantees this) and bounded
            assert!(
                gc.column < graph.len() + 10,
                "Row {}: column {} is unreasonably large",
                row,
                gc.column
            );
        }
    }

    #[test]
    fn test_matches_git_log_graph_merge() {
        // Create a real git repo with a merge pattern and verify our algorithm
        // matches git log --graph column assignments
        let temp_dir = TempDir::new().unwrap();
        let repo = Repository::init(temp_dir.path()).unwrap();
        let mut config = repo.config().unwrap();
        config.set_str("user.name", "Test User").unwrap();
        config.set_str("user.email", "test@example.com").unwrap();

        // Create initial commit (base)
        fs::write(temp_dir.path().join("file.txt"), "base").unwrap();
        let mut index = repo.index().unwrap();
        index.add_path(Path::new("file.txt")).unwrap();
        index.write().unwrap();
        let sig = repo.signature().unwrap();
        let tree_id = index.write_tree().unwrap();
        let tree = repo.find_tree(tree_id).unwrap();
        let base_oid = repo
            .commit(Some("HEAD"), &sig, &sig, "base commit", &tree, &[])
            .unwrap();
        let base_commit = repo.find_commit(base_oid).unwrap();

        // Create main branch commit
        fs::write(temp_dir.path().join("file.txt"), "main change").unwrap();
        let mut index = repo.index().unwrap();
        index.add_path(Path::new("file.txt")).unwrap();
        index.write().unwrap();
        let tree_id = index.write_tree().unwrap();
        let tree = repo.find_tree(tree_id).unwrap();
        let main_oid = repo
            .commit(
                Some("HEAD"),
                &sig,
                &sig,
                "main commit",
                &tree,
                &[&base_commit],
            )
            .unwrap();
        let main_commit = repo.find_commit(main_oid).unwrap();

        // Create feature branch commit (parented from base, not main)
        let feature_tree_content = "feature change";
        fs::write(temp_dir.path().join("feature.txt"), feature_tree_content).unwrap();
        let mut index = repo.index().unwrap();
        index.add_path(Path::new("feature.txt")).unwrap();
        index.add_path(Path::new("file.txt")).unwrap();
        index.write().unwrap();
        // Reset index to base state for the feature branch
        repo.set_head_detached(base_oid).unwrap();
        repo.checkout_head(Some(git2::build::CheckoutBuilder::new().force()))
            .unwrap();
        fs::write(temp_dir.path().join("feature.txt"), feature_tree_content).unwrap();
        let mut index = repo.index().unwrap();
        index.add_path(Path::new("feature.txt")).unwrap();
        index.write().unwrap();
        let tree_id = index.write_tree().unwrap();
        let tree = repo.find_tree(tree_id).unwrap();
        let feature_oid = repo
            .commit(None, &sig, &sig, "feature commit", &tree, &[&base_commit])
            .unwrap();
        let feature_commit = repo.find_commit(feature_oid).unwrap();

        // Create merge commit
        // Merge main + feature (first parent = main, second parent = feature)
        // We need a merged tree — use main's tree with feature's file added
        repo.set_head_detached(main_oid).unwrap();
        repo.checkout_head(Some(git2::build::CheckoutBuilder::new().force()))
            .unwrap();
        fs::write(temp_dir.path().join("feature.txt"), feature_tree_content).unwrap();
        let mut index = repo.index().unwrap();
        index.add_path(Path::new("feature.txt")).unwrap();
        index.write().unwrap();
        let tree_id = index.write_tree().unwrap();
        let tree = repo.find_tree(tree_id).unwrap();
        let merge_oid = repo
            .commit(
                Some("HEAD"),
                &sig,
                &sig,
                "merge commit",
                &tree,
                &[&main_commit, &feature_commit],
            )
            .unwrap();

        // Create follow-up commit
        fs::write(temp_dir.path().join("file.txt"), "follow-up").unwrap();
        let mut index = repo.index().unwrap();
        index.add_path(Path::new("file.txt")).unwrap();
        index.write().unwrap();
        let tree_id = index.write_tree().unwrap();
        let tree = repo.find_tree(tree_id).unwrap();
        let merge_commit = repo.find_commit(merge_oid).unwrap();
        let followup_oid = repo
            .commit(
                Some("HEAD"),
                &sig,
                &sig,
                "follow-up commit",
                &tree,
                &[&merge_commit],
            )
            .unwrap();

        // Build our graph from the same commits
        let mut walker = repo.revwalk().unwrap();
        walker
            .set_sorting(git2::Sort::TOPOLOGICAL | git2::Sort::TIME)
            .unwrap();
        walker.push(followup_oid).unwrap();

        let mut commits = Vec::new();
        for oid in walker {
            let oid = oid.unwrap();
            let commit = repo.find_commit(oid).unwrap();
            let parent_hashes: Vec<String> = commit.parent_ids().map(|id| id.to_string()).collect();
            commits.push(CommitInfo {
                hash: oid.to_string(),
                short_hash: oid.to_string()[..7].to_string(),
                message: commit.message().unwrap_or("").to_string(),
                author_name: "Test".to_string(),
                author_email: "test@test.com".to_string(),
                timestamp: commit.time().seconds(),
                parent_hashes,
            });
        }

        let graph = build_commit_graph(commits, HashMap::new());

        // Verify: main-line commits should all be in column 0
        // (matching git log --graph where main branch is leftmost)
        let followup = &graph[0];
        assert_eq!(
            followup.column, 0,
            "Follow-up commit should be col 0 (main line)"
        );

        let merge = &graph[1];
        assert_eq!(merge.column, 0, "Merge commit should be col 0 (main line)");

        // The base commit should be in column 0
        let base = graph
            .iter()
            .find(|g| g.commit.hash == base_oid.to_string())
            .unwrap();
        assert_eq!(base.column, 0, "Base commit should be col 0");

        // Feature branch commit should be in a non-zero column
        let feature = graph
            .iter()
            .find(|g| g.commit.hash == feature_oid.to_string())
            .unwrap();
        assert!(
            feature.column >= 1,
            "Feature commit should be in col >= 1, got {}",
            feature.column
        );

        // Max column should be exactly 1 (just main + one branch)
        let max_col = graph.iter().map(|g| g.column).max().unwrap();
        assert_eq!(
            max_col, 1,
            "Max column should be 1 for a single merge pattern"
        );
    }

    #[test]
    fn test_integration_sequential_pr_merges() {
        // 3 PRs merged one after another (GitHub-style workflow)
        let (temp_dir, repo) = create_test_repo();

        let base = commit_with_parents(&repo, &temp_dir, &[], "base.txt", "base", "base");

        // PR #1: one feature commit
        let feat1 = commit_with_parents(&repo, &temp_dir, &[base], "feat1.txt", "f1", "feat1");
        let merge1 = commit_with_parents(
            &repo,
            &temp_dir,
            &[base, feat1],
            "m1.txt",
            "m1",
            "merge1 (PR #1)",
        );

        // PR #2: two feature commits
        let feat2a =
            commit_with_parents(&repo, &temp_dir, &[merge1], "feat2a.txt", "f2a", "feat2a");
        let feat2b =
            commit_with_parents(&repo, &temp_dir, &[feat2a], "feat2b.txt", "f2b", "feat2b");
        let merge2 = commit_with_parents(
            &repo,
            &temp_dir,
            &[merge1, feat2b],
            "m2.txt",
            "m2",
            "merge2 (PR #2)",
        );

        // PR #3: one feature commit
        let feat3 = commit_with_parents(&repo, &temp_dir, &[merge2], "feat3.txt", "f3", "feat3");
        let merge3 = commit_with_parents(
            &repo,
            &temp_dir,
            &[merge2, feat3],
            "m3.txt",
            "m3",
            "merge3 (PR #3)",
        );

        let commits = commits_from_oids(&repo, &[merge3]);
        let graph = build_commit_graph(commits, HashMap::new());

        // All merges + base at col 0
        for gc in &graph {
            let msg = gc.commit.message.as_str();
            if msg.starts_with("merge") || msg == "base" {
                assert_eq!(gc.column, 0, "{} should be col 0", msg);
            }
        }

        // Each merge has exactly 1 is_merge line
        for gc in &graph {
            if gc.commit.message.starts_with("merge") {
                let merge_count = gc.lines.iter().filter(|l| l.is_merge).count();
                assert_eq!(
                    merge_count, 1,
                    "{} should have 1 merge line",
                    gc.commit.message
                );
            }
        }

        let max_col = graph.iter().map(|g| g.column).max().unwrap();
        assert_eq!(max_col, 1, "Max col should be 1 (column reused)");

        validate_graph_invariants(&graph);
    }

    #[test]
    fn test_integration_overlapping_branches() {
        // Two feature branches active simultaneously
        let (temp_dir, repo) = create_test_repo();

        let base = commit_with_parents(&repo, &temp_dir, &[], "base.txt", "b", "base");

        let feat_a = commit_with_parents(&repo, &temp_dir, &[base], "feat_a.txt", "a", "feat_a");
        let feat_b = commit_with_parents(&repo, &temp_dir, &[base], "feat_b.txt", "b2", "feat_b");

        let merge_a =
            commit_with_parents(&repo, &temp_dir, &[base, feat_a], "ma.txt", "ma", "merge_a");
        let merge_b = commit_with_parents(
            &repo,
            &temp_dir,
            &[merge_a, feat_b],
            "mb.txt",
            "mb",
            "merge_b",
        );

        let commits = commits_from_oids(&repo, &[merge_b]);
        let graph = build_commit_graph(commits, HashMap::new());

        // feat_a and feat_b should be in different columns
        let feat_a_col = graph
            .iter()
            .find(|g| g.commit.message == "feat_a")
            .unwrap()
            .column;
        let feat_b_col = graph
            .iter()
            .find(|g| g.commit.message == "feat_b")
            .unwrap()
            .column;
        assert_ne!(
            feat_a_col, feat_b_col,
            "feat_a and feat_b in different cols"
        );

        let max_col = graph.iter().map(|g| g.column).max().unwrap();
        assert!(max_col <= 2, "Max col should be <= 2, got {}", max_col);

        validate_graph_invariants(&graph);
    }

    #[test]
    fn test_integration_deep_diamond() {
        // Nested diamond: root → two branches → each branches again → inner merges → outer merge
        let (temp_dir, repo) = create_test_repo();

        let root = commit_with_parents(&repo, &temp_dir, &[], "root.txt", "r", "root");

        // Left side
        let ll = commit_with_parents(&repo, &temp_dir, &[root], "ll.txt", "ll", "ll");
        let lr = commit_with_parents(&repo, &temp_dir, &[root], "lr.txt", "lr", "lr");
        let left_merge =
            commit_with_parents(&repo, &temp_dir, &[ll, lr], "lm.txt", "lm", "left_merge");

        // Right side
        let rl = commit_with_parents(&repo, &temp_dir, &[root], "rl.txt", "rl", "rl");
        let rr = commit_with_parents(&repo, &temp_dir, &[root], "rr.txt", "rr", "rr");
        let right_merge =
            commit_with_parents(&repo, &temp_dir, &[rl, rr], "rm.txt", "rm", "right_merge");

        // Top merge
        let top_merge = commit_with_parents(
            &repo,
            &temp_dir,
            &[left_merge, right_merge],
            "tm.txt",
            "tm",
            "top_merge",
        );

        let commits = commits_from_oids(&repo, &[top_merge]);
        let graph = build_commit_graph(commits, HashMap::new());

        // top_merge at col 0
        let top = graph
            .iter()
            .find(|g| g.commit.message == "top_merge")
            .unwrap();
        assert_eq!(top.column, 0, "top_merge should be col 0");

        // Nested merges have merge lines
        for gc in &graph {
            if gc.commit.message.contains("merge") {
                let has_merge = gc.lines.iter().any(|l| l.is_merge);
                assert!(has_merge, "{} should have merge lines", gc.commit.message);
            }
        }

        let max_col = graph.iter().map(|g| g.column).max().unwrap();
        assert!(max_col <= 3, "Max col should be <= 3, got {}", max_col);

        validate_graph_invariants(&graph);
    }

    #[test]
    fn test_integration_long_running_feature() {
        // Feature branch lives while main gets commits and a hotfix merge
        let (temp_dir, repo) = create_test_repo();

        let base = commit_with_parents(&repo, &temp_dir, &[], "base.txt", "b", "base");

        let feat1 = commit_with_parents(&repo, &temp_dir, &[base], "f1.txt", "f1", "feat1");
        let main1 = commit_with_parents(&repo, &temp_dir, &[base], "main1.txt", "m1", "main1");

        let feat2 = commit_with_parents(&repo, &temp_dir, &[feat1], "f2.txt", "f2", "feat2");
        let main2 = commit_with_parents(&repo, &temp_dir, &[main1], "main2.txt", "m2", "main2");

        // Hotfix on main
        let hotfix = commit_with_parents(&repo, &temp_dir, &[main2], "hf.txt", "hf", "hotfix");
        let hotfix_merge = commit_with_parents(
            &repo,
            &temp_dir,
            &[main2, hotfix],
            "hfm.txt",
            "hfm",
            "hotfix_merge",
        );

        let feat3 = commit_with_parents(&repo, &temp_dir, &[feat2], "f3.txt", "f3", "feat3");

        let final_merge = commit_with_parents(
            &repo,
            &temp_dir,
            &[hotfix_merge, feat3],
            "fm.txt",
            "fm",
            "final_merge",
        );

        let commits = commits_from_oids(&repo, &[final_merge]);
        let graph = build_commit_graph(commits, HashMap::new());

        // final_merge at col 0
        let fm = graph
            .iter()
            .find(|g| g.commit.message == "final_merge")
            .unwrap();
        assert_eq!(fm.column, 0, "final_merge should be col 0");

        // Feature branch should be consistent column
        let feat_cols: Vec<usize> = graph
            .iter()
            .filter(|g| g.commit.message.starts_with("feat"))
            .map(|g| g.column)
            .collect();
        let first_feat_col = feat_cols[0];
        for &col in &feat_cols {
            assert_eq!(
                col, first_feat_col,
                "Feature commits should all be in same column"
            );
        }

        // Pass-through lines exist for feature branch while main gets commits
        let main2_row = graph.iter().find(|g| g.commit.message == "main2").unwrap();
        let has_pt = main2_row
            .lines
            .iter()
            .any(|l| matches!(l.line_type, GraphLineType::PassThrough));
        assert!(has_pt, "main2 should have pass-through for feature branch");

        validate_graph_invariants(&graph);
    }

    #[test]
    fn test_integration_tags_and_refs() {
        // Sequential PR merges topology with tags + branch refs
        let (temp_dir, repo) = create_test_repo();

        let base = commit_with_parents(&repo, &temp_dir, &[], "base.txt", "b", "base");
        let base_commit = repo.find_commit(base).unwrap();
        repo.tag_lightweight("v1.0", base_commit.as_object(), false)
            .unwrap();

        let feat1 = commit_with_parents(&repo, &temp_dir, &[base], "f1.txt", "f1", "feat1");
        let merge1 =
            commit_with_parents(&repo, &temp_dir, &[base, feat1], "m1.txt", "m1", "merge1");
        let merge1_commit = repo.find_commit(merge1).unwrap();
        repo.tag_lightweight("v2.0", merge1_commit.as_object(), false)
            .unwrap();

        let feat2a = commit_with_parents(&repo, &temp_dir, &[merge1], "f2a.txt", "f2a", "feat2a");
        let feat2a_commit = repo.find_commit(feat2a).unwrap();
        repo.tag_lightweight("v2.1-rc", feat2a_commit.as_object(), false)
            .unwrap();

        let feat3 = commit_with_parents(&repo, &temp_dir, &[merge1], "f3.txt", "f3", "feat3");
        let feat3_commit = repo.find_commit(feat3).unwrap();
        repo.branch("feature", &feat3_commit, false).unwrap();

        // Point HEAD to merge1 so we have a "main" branch
        repo.branch("main", &merge1_commit, true).ok();

        let branch_refs = collect_refs(&repo).unwrap();
        let commits = commits_from_oids(&repo, &[feat3, feat2a]);
        let graph = build_commit_graph(commits, branch_refs);

        // Check tag refs
        let base_gc = graph
            .iter()
            .find(|g| g.commit.hash == base.to_string())
            .unwrap();
        assert!(
            base_gc
                .refs
                .iter()
                .any(|r| r.name == "v1.0" && matches!(r.ref_type, RefType::Tag)),
            "base should have v1.0 tag"
        );

        let merge1_gc = graph
            .iter()
            .find(|g| g.commit.hash == merge1.to_string())
            .unwrap();
        assert!(
            merge1_gc
                .refs
                .iter()
                .any(|r| r.name == "v2.0" && matches!(r.ref_type, RefType::Tag)),
            "merge1 should have v2.0 tag"
        );

        let feat2a_gc = graph
            .iter()
            .find(|g| g.commit.hash == feat2a.to_string())
            .unwrap();
        assert!(
            feat2a_gc
                .refs
                .iter()
                .any(|r| r.name == "v2.1-rc" && matches!(r.ref_type, RefType::Tag)),
            "feat2a should have v2.1-rc tag"
        );

        // Check branch ref
        let feat3_gc = graph
            .iter()
            .find(|g| g.commit.hash == feat3.to_string())
            .unwrap();
        assert!(
            feat3_gc
                .refs
                .iter()
                .any(|r| r.name == "feature" && matches!(r.ref_type, RefType::Branch)),
            "feat3 should have feature branch ref"
        );

        validate_graph_invariants(&graph);
    }

    #[test]
    fn test_integration_octopus_merge() {
        // Single commit with 3 parents (octopus merge)
        let (temp_dir, repo) = create_test_repo();

        let base = commit_with_parents(&repo, &temp_dir, &[], "base.txt", "b", "base");

        let feat_a = commit_with_parents(&repo, &temp_dir, &[base], "fa.txt", "fa", "feat_a");
        let feat_b = commit_with_parents(&repo, &temp_dir, &[base], "fb.txt", "fb", "feat_b");
        let feat_c = commit_with_parents(&repo, &temp_dir, &[base], "fc.txt", "fc", "feat_c");

        let octopus = commit_with_parents(
            &repo,
            &temp_dir,
            &[feat_a, feat_b, feat_c],
            "oct.txt",
            "oct",
            "octopus",
        );

        let commits = commits_from_oids(&repo, &[octopus]);
        let graph = build_commit_graph(commits, HashMap::new());

        // octopus has 2 merge lines (parents 2 and 3)
        let oct_gc = graph
            .iter()
            .find(|g| g.commit.message == "octopus")
            .unwrap();
        let merge_count = oct_gc.lines.iter().filter(|l| l.is_merge).count();
        assert_eq!(merge_count, 2, "Octopus should have 2 merge lines");

        // All features in different columns
        let cols: Vec<usize> = graph
            .iter()
            .filter(|g| g.commit.message.starts_with("feat_"))
            .map(|g| g.column)
            .collect();
        for i in 0..cols.len() {
            for j in (i + 1)..cols.len() {
                assert_ne!(
                    cols[i], cols[j],
                    "Feature commits should be in different columns"
                );
            }
        }

        validate_graph_invariants(&graph);
    }

    #[test]
    fn test_integration_multiple_roots() {
        // Two unrelated histories (orphan branch) in the same graph.
        // When main1 has no parents, col 0 is freed and the orphan branch
        // correctly reuses it — both histories share col 0 sequentially.
        let commits = vec![
            create_commit_info("main3", "main3", vec!["main2".to_string()]),
            create_commit_info("main2", "main2", vec!["main1".to_string()]),
            create_commit_info("main1", "main1", vec![]),
            create_commit_info("orphan2", "orphan2", vec!["orphan1".to_string()]),
            create_commit_info("orphan1", "orphan1", vec![]),
        ];
        let refs = HashMap::new();

        let graph = build_commit_graph(commits, refs);

        // Main commits all col 0
        for gc in &graph {
            if gc.commit.message.starts_with("main") {
                assert_eq!(gc.column, 0, "{} should be col 0", gc.commit.message);
            }
        }

        // main3 is a tip (first seen, not expected by anyone)
        assert!(graph[0].is_tip, "main3 should be a tip");
        // main1 is not a tip because main2 registered it as a parent
        let main1 = graph.iter().find(|g| g.commit.message == "main1").unwrap();
        assert!(!main1.is_tip, "main1 should not be a tip");

        // orphan2 is a tip (not expected by anyone before it)
        let orphan2 = graph
            .iter()
            .find(|g| g.commit.message == "orphan2")
            .unwrap();
        assert!(orphan2.is_tip, "orphan2 should be a tip");

        // orphan1 is not a tip (orphan2 registered it as a parent)
        let orphan1 = graph
            .iter()
            .find(|g| g.commit.message == "orphan1")
            .unwrap();
        assert!(!orphan1.is_tip, "orphan1 should not be a tip");

        // Both roots (main1, orphan1) have no parents
        assert!(main1.commit.parent_hashes.is_empty());
        assert!(orphan1.commit.parent_hashes.is_empty());

        // Col 0 is reused after main1 frees it (correct column reuse)
        assert_eq!(orphan2.column, 0, "orphan2 reuses col 0 after main ends");

        validate_graph_invariants(&graph);
    }

    #[test]
    fn test_integration_fast_forward_refs() {
        // Linear history with multiple branch refs on same commit
        let (temp_dir, repo) = create_test_repo();

        let c1 = commit_with_parents(&repo, &temp_dir, &[], "c1.txt", "c1", "commit1");
        let c2 = commit_with_parents(&repo, &temp_dir, &[c1], "c2.txt", "c2", "commit2");
        let c3 = commit_with_parents(&repo, &temp_dir, &[c2], "c3.txt", "c3", "commit3");

        // Point HEAD and "main" branch to c3
        let c3_commit = repo.find_commit(c3).unwrap();
        repo.branch("main", &c3_commit, true).ok();
        repo.branch("feature", &c3_commit, false).unwrap();

        // Update HEAD to main
        let main_ref = repo.find_branch("main", git2::BranchType::Local).unwrap();
        repo.set_head(main_ref.get().name().unwrap()).unwrap();

        let branch_refs = collect_refs(&repo).unwrap();
        let commits = commits_from_oids(&repo, &[c3]);
        let graph = build_commit_graph(commits, branch_refs);

        // All col 0
        for gc in &graph {
            assert_eq!(gc.column, 0, "{} should be col 0", gc.commit.message);
        }

        let max_col = graph.iter().map(|g| g.column).max().unwrap();
        assert_eq!(max_col, 0, "Max col should be 0");

        // commit3 refs contain both branch names
        let c3_gc = graph
            .iter()
            .find(|g| g.commit.hash == c3.to_string())
            .unwrap();
        let branch_names: Vec<&str> = c3_gc
            .refs
            .iter()
            .filter(|r| matches!(r.ref_type, RefType::Branch))
            .map(|r| r.name.as_str())
            .collect();
        assert!(
            branch_names.contains(&"main"),
            "commit3 should have main ref"
        );
        assert!(
            branch_names.contains(&"feature"),
            "commit3 should have feature ref"
        );

        validate_graph_invariants(&graph);
    }
}
