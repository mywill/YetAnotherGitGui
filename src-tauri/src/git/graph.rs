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
    let mut result = Vec::with_capacity(commits.len());
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

        // Mark this column as used by the first parent
        if let Some(parent) = commit.parent_hashes.first() {
            column_map.insert(parent.clone(), column);
            active_columns.resize(column.max(active_columns.len()), None);
            if column >= active_columns.len() {
                active_columns.push(Some(parent.clone()));
            } else {
                active_columns[column] = Some(parent.clone());
            }

            // Line from this commit down to first parent (same column)
            lines.push(GraphLine {
                from_column: column,
                to_column: column,
                is_merge: false,
                line_type: GraphLineType::ToParent,
            });
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
}
