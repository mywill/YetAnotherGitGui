/**
 * Tauri API mocks for E2E testing
 * These mocks are injected into the browser to allow the app to run without Tauri
 */

export const tauriMocks = `
  // Mock Tauri globals - must be set BEFORE any modules load
  window.__TAURI_INTERNALS__ = {
    invoke: async (cmd, args) => {
      console.log('[E2E Mock] invoke:', cmd, args);

      // Handle plugin commands (format: plugin:name|command)
      if (cmd.startsWith('plugin:')) {
        const [pluginPart, pluginCmd] = cmd.split('|');
        const pluginName = pluginPart.replace('plugin:', '');

        if (pluginName === 'cli' && pluginCmd === 'cli_matches') {
          return {
            args: { path: { value: '/mock/repo/path', occurrences: 1 } },
            subcommand: null
          };
        }

        if (pluginName === 'clipboard-manager') {
          if (pluginCmd === 'write_text') return undefined;
          if (pluginCmd === 'read_text') return '';
        }

        if (pluginName === 'updater') {
          if (pluginCmd === 'check') return null;
          return null;
        }

        if (pluginName === 'process') {
          if (pluginCmd === 'restart') return undefined;
          return null;
        }

        if (pluginName === 'opener') {
          if (pluginCmd === 'open_url') return undefined;
          return null;
        }

        console.warn('[E2E Mock] Unhandled plugin command:', cmd);
        return null;
      }

      // Mock responses for different commands
      switch (cmd) {
        case 'get_current_dir':
          return '/mock/repo/path';

        case 'open_repository':
          return {
            path: args?.path || '/mock/repo/path',
            current_branch: 'main',
            is_detached: false,
            remotes: ['origin'],
            head_hash: 'abc123def456789'
          };

        case 'get_repository_info':
          return {
            path: '/mock/repo/path',
            current_branch: 'main',
            is_detached: false,
            remotes: ['origin'],
            head_hash: 'abc123def456789'
          };

        case 'get_commit_graph':
          return [
            {
              hash: 'abc123def456789',
              short_hash: 'abc123d',
              message: 'Initial commit',
              author_name: 'Test User',
              author_email: 'test@example.com',
              timestamp: Date.now() / 1000,
              parent_hashes: [],
              column: 0,
              lines: [],
              refs: [{ name: 'main', ref_type: 'branch', is_head: true }],
              is_tip: true
            }
          ];

        case 'get_file_statuses':
          return {
            staged: [
              { path: 'staged-file.ts', status: 'modified', is_staged: true }
            ],
            unstaged: [
              { path: 'unstaged-file1.ts', status: 'modified', is_staged: false },
              { path: 'unstaged-file2.ts', status: 'modified', is_staged: false },
              { path: 'unstaged-file3.ts', status: 'modified', is_staged: false }
            ],
            untracked: [
              { path: 'new-file1.ts', status: 'untracked', is_staged: false },
              { path: 'new-file2.ts', status: 'untracked', is_staged: false }
            ]
          };

        case 'get_file_diff':
          return {
            path: args?.path || 'test.ts',
            hunks: [
              {
                header: '@@ -1,3 +1,4 @@',
                old_start: 1,
                old_lines: 3,
                new_start: 1,
                new_lines: 4,
                lines: [
                  { content: 'const x = 1;', line_type: 'context', old_lineno: 1, new_lineno: 1 },
                  { content: 'const old = true;', line_type: 'deletion', old_lineno: 2, new_lineno: null },
                  { content: 'const new = true;', line_type: 'addition', old_lineno: null, new_lineno: 2 },
                  { content: 'export { x };', line_type: 'context', old_lineno: 3, new_lineno: 3 }
                ]
              }
            ],
            is_binary: false
          };

        case 'stage_file':
        case 'unstage_file':
        case 'revert_file':
        case 'delete_file':
        case 'stage_hunk':
        case 'unstage_hunk':
        case 'stage_lines':
        case 'discard_hunk':
        case 'revert_commit':
        case 'revert_commit_file':
        case 'revert_commit_file_lines':
          return undefined;

        case 'create_commit':
          return 'new-commit-hash-123';

        case 'list_branches':
          return [
            { name: 'main', is_remote: false, is_head: true, target_hash: 'abc123def456789' },
            { name: 'feature/test', is_remote: false, is_head: false, target_hash: 'def456789abc123' },
            { name: 'origin/main', is_remote: true, is_head: false, target_hash: 'abc123def456789' }
          ];

        case 'list_tags':
          return [
            { name: 'v1.0.0', target_hash: 'abc123def456789', is_annotated: true, message: 'First release' },
            { name: 'v0.9.0', target_hash: 'def456789abc123', is_annotated: false, message: null }
          ];

        case 'list_stashes':
          return [
            {
              index: 0,
              message: 'WIP on main: abc123d Initial commit',
              commit_hash: 'stash123abc',
              timestamp: Date.now() / 1000,
              branch_name: 'main'
            }
          ];

        case 'get_stash_details':
          return {
            index: args?.index || 0,
            message: 'WIP on main: abc123d Initial commit',
            commit_hash: 'stash123abc',
            timestamp: Date.now() / 1000,
            branch_name: 'main',
            files_changed: [
              { path: 'stashed-file.ts', status: 'modified', old_path: null }
            ]
          };

        case 'get_stash_file_diff':
          return {
            path: args?.filePath || 'stashed-file.ts',
            hunks: [
              {
                header: '@@ -1,2 +1,3 @@',
                old_start: 1,
                old_lines: 2,
                new_start: 1,
                new_lines: 3,
                lines: [
                  { content: 'const x = 1;', line_type: 'context', old_lineno: 1, new_lineno: 1 },
                  { content: 'const stashed = true;', line_type: 'addition', old_lineno: null, new_lineno: 2 }
                ]
              }
            ],
            is_binary: false
          };

        case 'apply_stash':
        case 'drop_stash':
          return undefined;

        case 'check_cli_installed':
          return window.__MOCK_CLI_INSTALLED__ !== undefined ? window.__MOCK_CLI_INSTALLED__ : true;

        case 'install_cli':
          window.__MOCK_CLI_INSTALLED__ = true;
          return 'CLI installed successfully. You can now use yagg from the terminal.';

        case 'uninstall_cli':
          window.__MOCK_CLI_INSTALLED__ = false;
          return 'CLI tool uninstalled successfully.';

        case 'get_app_info':
          return {
            version: '1.2.0',
            tauri_version: '2.0.0',
            platform: 'macos',
            arch: 'aarch64'
          };

        case 'write_update_log':
          return undefined;

        case 'get_update_log_path':
          return '/home/user/.local/share/yagg/update.log';

        case 'checkout_commit':
        case 'checkout_branch':
          return undefined;

        case 'get_commit_details':
          return {
            hash: args?.hash || 'abc123def456789',
            message: 'Initial commit',
            author_name: 'Test User',
            author_email: 'test@example.com',
            committer_name: 'Test User',
            committer_email: 'test@example.com',
            timestamp: Date.now() / 1000,
            parent_hashes: [],
            files_changed: [
              { path: 'src/main.ts', status: 'added', old_path: null },
              { path: 'README.md', status: 'modified', old_path: null }
            ]
          };

        case 'get_commit_file_diff':
          return {
            path: args?.filePath || 'test.ts',
            hunks: [
              {
                header: '@@ -1,3 +1,5 @@',
                old_start: 1,
                old_lines: 3,
                new_start: 1,
                new_lines: 5,
                lines: [
                  { content: 'const x = 1;', line_type: 'context', old_lineno: 1, new_lineno: 1 },
                  { content: 'const y = 2;', line_type: 'addition', old_lineno: null, new_lineno: 2 },
                  { content: 'export { x };', line_type: 'context', old_lineno: 2, new_lineno: 3 }
                ]
              }
            ],
            is_binary: false
          };

        default:
          console.warn('[E2E Mock] Unhandled command:', cmd);
          return null;
      }
    },
    transformCallback: (callback, once) => {
      // Return a unique ID for the callback
      const id = Math.random();
      window.__TAURI_CALLBACKS__ = window.__TAURI_CALLBACKS__ || {};
      window.__TAURI_CALLBACKS__[id] = { callback, once };
      return id;
    },
    unregisterCallback: (id) => {
      if (window.__TAURI_CALLBACKS__) {
        delete window.__TAURI_CALLBACKS__[id];
      }
    },
    convertFileSrc: (path) => path,
    metadata: {
      currentWindow: { label: 'main' },
      currentWebview: { label: 'main' }
    }
  };

  // Also set up __TAURI__ for older API patterns
  window.__TAURI__ = {
    core: {
      invoke: window.__TAURI_INTERNALS__.invoke,
      transformCallback: window.__TAURI_INTERNALS__.transformCallback,
      convertFileSrc: window.__TAURI_INTERNALS__.convertFileSrc
    },
    event: {
      listen: async () => () => {},
      once: async () => () => {},
      emit: async () => {}
    }
  };

  console.log('[E2E Mock] Tauri mocks initialized');
`;
