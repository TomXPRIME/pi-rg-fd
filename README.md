# pi-rg-fd

Pi coding agent extension that rewrites the default system prompt's `grep` and `find` advice to `rg` and `fd` when those tools are on `PATH`.

Pi 1.4's bash tool line names `grep` and `find`, and the default guideline still names `find`, so models reach for those commands even when ripgrep and fd are installed. This package replaces those exact lines in place. The usual prompt gets shorter, and text that is not one of those Pi 1.4 lines is left as Pi wrote it.

## Install

```bash
pi install npm:pi-rg-fd
```

For one session without saving the install: `pi -e npm:pi-rg-fd`.

Requires [Pi](https://github.com/earendil-works/pi) 1.4.x (`@earendil-works/pi-coding-agent`).

## Replaced lines

Verified against the published `@earendil-works/pi-coding-agent@1.4.0` sources (`dist/core/tools/bash.js` and `dist/core/system-prompt.js`). These are the only default prompt lines that name the `grep` or `find` commands. The read, edit, write, and ls tool snippets do not. The optional `grep` and `find` tools are separate Pi tools (they already shell out to `rg` and `fd`); their lines are left alone.

Bash tool snippet, before:

```text
Execute bash commands (ls, grep, find, etc.)
```

Default guideline (bash enabled, and the grep/find/ls tools off), before:

```text
Use bash for file operations like ls, rg, find
```

With both `rg` and `fd` on `PATH`, those become:

```text
Execute bash commands (ls, rg, fd, etc.)
Use bash for file operations like ls, rg, fd
```

Each binary is swapped on its own. `fd` is checked independently of `rg`. On Windows the scan accepts `rg.exe` and `fd.exe` (and the rest of `PATHEXT`), matched case-insensitively. On Debian and Ubuntu, where the package installs `fdfind`, that name is used instead of `fd`. A later `fd` still wins over an earlier `fdfind`.

| On PATH | Bash tool line | Guideline |
| --- | --- | --- |
| `rg` and `fd` | `Execute bash commands (ls, rg, fd, etc.)` | `Use bash for file operations like ls, rg, fd` |
| `rg` only | `Execute bash commands (ls, rg, find, etc.)` | unchanged (it already says `rg`; `find` stays) |
| `fd` only | `Execute bash commands (ls, grep, fd, etc.)` | `Use bash for file operations like ls, rg, fd` |
| `fdfind` only | `Execute bash commands (ls, grep, fdfind, etc.)` | `Use bash for file operations like ls, rg, fdfind` |
| neither | unchanged | unchanged |

`rg` and `fd` are shorter than `grep` and `find`. `fdfind` is two characters longer than `find`, which is the Debian binary's name. If neither line is present (a custom system prompt, or a future Pi release that rewords them), the hook returns without changing the prompt.

Availability is resolved once, when the extension loads, by listing each directory on `PATH` (stopping once `rg` and `fd` are both found). The `before_agent_start` hook is a string replace cached by the prompt text, so the same input always yields the same output.

## Prompt text only

`pi-cli-guard` and `pi-prefer-rg` rewrite or block bash commands when the model runs them. `pi-rg-fd` edits the system prompt Pi already built. Commands the model still emits run unchanged.

## License

MIT
