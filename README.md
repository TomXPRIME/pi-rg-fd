# pi-rg-fd

Pi coding agent extension that always rewrites the default system prompt's `grep` and `find` advice to `rg` and `fd`.

Pi 1.4's bash tool line names `grep` and `find`, and the default guideline still names `find`, so models reach for those commands. This package replaces those two exact lines in place. The usual prompt gets shorter, and text that is not one of those Pi 1.4 lines is left as Pi wrote it. You confirm that `rg` and `fd` run on your machine.

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

Those lines are always rewritten to:

```text
Execute bash commands (ls, rg, fd, etc.)
Use bash for file operations like ls, rg, fd
```

`rg` and `fd` are shorter than `grep` and `find`. If neither line is present (a custom system prompt, or a future Pi release that rewords them), the hook returns without changing the prompt.

Pi's interactive mode downloads `rg` and `fd` when they are missing, into `~/.pi/agent/bin` (or `$PI_CODING_AGENT_DIR/bin` when that variable is set; a leading `~` is expanded). Bash calls see that directory on `PATH`. The managed files are named `rg` and `fd`, plus `.exe` on Windows.

Debian and Ubuntu's apt package `fd-find` installs the binary as `fdfind`. Alias it so the rewritten prompt matches a command on `PATH`:

```bash
alias fd=fdfind
```

## Prompt text only

`pi-cli-guard` and `pi-prefer-rg` rewrite or block bash commands when the model runs them. `pi-rg-fd` edits the system prompt Pi already built. Commands the model still emits run unchanged.

## Compatibility

With `@earendil-works/pi-coding-agent` installed, `npm run compat` builds Pi's default system prompt from that package and loads this extension through Pi's extension loader. CI runs the same check on Ubuntu and Windows against the latest Pi release, every day and on manual dispatch.

```bash
npm install --no-save @earendil-works/pi-coding-agent@latest
npm run compat
```

## License

MIT
