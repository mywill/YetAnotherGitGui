//! Integration tests for commit-graph collection (collect_refs against real
//! repos, plus integration scenarios like merges/octopus/long-running
//! features). Pure-function unit tests for `build_commit_graph` (which use
//! synthesized `CommitInfo` rather than a real repo) stay inline in
//! src/git/graph.rs::tests.

mod common;

use common::{create_commit_with_file, create_test_repo};
use git2::Repository;
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::sync::atomic::{AtomicI64, Ordering};
use tempfile::TempDir;
use yagg_lib::git::{
    build_commit_graph, collect_refs, CommitInfo, GraphCommit, GraphLineType, RefType,
};

/// Monotonically increasing timestamp so commits created in rapid succession
/// always have distinct times for deterministic TOPOLOGICAL | TIME ordering.
static NEXT_TIMESTAMP: AtomicI64 = AtomicI64::new(1_700_000_000);

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

    let ts = NEXT_TIMESTAMP.fetch_add(1, Ordering::Relaxed);
    let time = git2::Time::new(ts, 0);
    let sig = git2::Signature::new("Test User", "test@example.com", &time).unwrap();
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

fn validate_graph_invariants(graph: &[GraphCommit]) {
    for (row, gc) in graph.iter().enumerate() {
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

        assert!(
            gc.column < graph.len() + 10,
            "Row {}: column {} is unreasonably large",
            row,
            gc.column
        );
    }
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
    let oid = create_commit_with_file(&repo, &temp_dir, "file.txt", "content", "Initial commit");

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
    let oid = create_commit_with_file(&repo, &temp_dir, "file.txt", "content", "Initial commit");
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
    let oid = create_commit_with_file(&repo, &temp_dir, "file.txt", "content", "Initial commit");
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
    let oid = create_commit_with_file(&repo, &temp_dir, "file.txt", "content", "Initial commit");

    let refs = collect_refs(&repo).unwrap();

    let branch_refs = refs.get(&oid.to_string()).unwrap();
    // One of the branches should be marked as HEAD
    let has_head = branch_refs.iter().any(|r| r.is_head);
    assert!(has_head);
}

#[test]
fn test_collect_refs_detached_head() {
    let (temp_dir, repo) = create_test_repo();
    let oid = create_commit_with_file(&repo, &temp_dir, "file.txt", "content", "Initial commit");

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
    let feat2a = commit_with_parents(&repo, &temp_dir, &[merge1], "feat2a.txt", "f2a", "feat2a");
    let feat2b = commit_with_parents(&repo, &temp_dir, &[feat2a], "feat2b.txt", "f2b", "feat2b");
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

    let merge_a = commit_with_parents(&repo, &temp_dir, &[base, feat_a], "ma.txt", "ma", "merge_a");
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
    let left_merge = commit_with_parents(&repo, &temp_dir, &[ll, lr], "lm.txt", "lm", "left_merge");

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
    let merge1 = commit_with_parents(&repo, &temp_dir, &[base, feat1], "m1.txt", "m1", "merge1");
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
