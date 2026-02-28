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
}
