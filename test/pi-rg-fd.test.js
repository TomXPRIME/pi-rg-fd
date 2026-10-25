import assert from "node:assert/strict";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { createExtension } from "../index.js";
import { BASH_RULE, BASH_SNIPPET, detectSearchTools, rewritePrompt } from "../prompt.js";

const SAMPLE = [
	"You are an expert coding assistant operating inside pi, a coding agent harness.",
	"<tools>",
	`- bash: ${BASH_SNIPPET}`,
	"- read: Read file contents",
	"</tools>",
	"<rules>",
	`- ${BASH_RULE}`,
	"- You can inspect PI_* environment variables for current model and session details.",
	"- Be concise in your responses",
	"Use bash or PowerShell for file operations like listing, searching, and finding files",
	"- grep: Search file contents for patterns (respects .gitignore)",
	"</rules>",
].join("\n");

/**
 * @param {string} name
 * @param {number} [mode]
 */
function place(dir, name, mode = 0o755) {
	const file = path.join(dir, name);
	writeFileSync(file, "");
	chmodSync(file, mode);
	return file;
}

test("detects rg and fd on a POSIX PATH, including a later directory", () => {
	const root = mkdtempSync(path.join(tmpdir(), "pi-rg-fd-"));
	try {
		const empty = path.join(root, "empty");
		const bin = path.join(root, "bin");
		mkdirSync(empty);
		mkdirSync(bin);
		place(bin, "rg");
		place(bin, "fd");
		place(empty, "rg", 0o644);
		mkdirSync(path.join(empty, "fd"));

		assert.deepEqual(detectSearchTools({ env: { PATH: `${empty}:${bin}` }, platform: "linux" }), {
			rg: true,
			fd: "fd",
		});
		assert.deepEqual(detectSearchTools({ env: { PATH: empty }, platform: "linux" }), {
			rg: false,
			fd: null,
		});
		assert.deepEqual(detectSearchTools({ env: { PATH: "" }, platform: "linux" }), {
			rg: false,
			fd: null,
		});
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("uses fdfind only when fd itself is absent", () => {
	const root = mkdtempSync(path.join(tmpdir(), "pi-rg-fd-"));
	try {
		const fdOnly = path.join(root, "fd");
		const both = path.join(root, "both");
		mkdirSync(fdOnly);
		mkdirSync(both);
		place(fdOnly, "fdfind");
		place(both, "fd");
		place(both, "fdfind");

		assert.deepEqual(detectSearchTools({ env: { PATH: fdOnly }, platform: "linux" }), {
			rg: false,
			fd: "fdfind",
		});
		assert.deepEqual(detectSearchTools({ env: { PATH: both }, platform: "linux" }), {
			rg: false,
			fd: "fd",
		});
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("finds rg.exe and fd.exe on Windows, including PATHEXT", () => {
	const root = mkdtempSync(path.join(tmpdir(), "pi-rg-fd-"));
	try {
		place(root, "rg.exe", 0o644);
		place(root, "fd.CMD", 0o644);
		const other = path.join(root, "other");
		mkdirSync(other);
		place(other, "fdfind.exe", 0o644);

		assert.deepEqual(
			detectSearchTools({
				env: { Path: root, PATHEXT: ".COM;.EXE;.BAT;.CMD" },
				platform: "win32",
			}),
			{ rg: true, fd: "fd" },
		);

		const bare = path.join(root, "bare");
		mkdirSync(bare);
		place(bare, "rg", 0o755);
		assert.deepEqual(
			detectSearchTools({
				env: { PATH: bare, PATHEXT: ".EXE" },
				platform: "win32",
			}),
			{ rg: false, fd: null },
		);

		assert.deepEqual(
			detectSearchTools({
				env: { PATH: other, PATHEXT: ".EXE" },
				platform: "win32",
			}),
			{ rg: false, fd: "fdfind" },
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("rewrites only the Pi 1.4 grep and find lines that have a tool on PATH", () => {
	const both = rewritePrompt(SAMPLE, { rg: true, fd: "fd" });
	assert.equal(both.includes("Execute bash commands (ls, rg, fd, etc.)"), true);
	assert.equal(both.includes("Use bash for file operations like ls, rg, fd"), true);
	assert.equal(both.includes("grep"), true);
	assert.equal(both.includes("- grep: Search file contents"), true);
	assert.equal(both.includes("finding files"), true);
	assert.equal(both.includes(BASH_SNIPPET), false);
	assert.equal(both.includes(BASH_RULE), false);
	assert.ok(both.length < SAMPLE.length);

	assert.equal(
		rewritePrompt(SAMPLE, { rg: true, fd: null }),
		SAMPLE.replace(BASH_SNIPPET, "Execute bash commands (ls, rg, find, etc.)"),
	);
	assert.equal(
		rewritePrompt(SAMPLE, { rg: false, fd: "fd" }),
		SAMPLE.replace(BASH_SNIPPET, "Execute bash commands (ls, grep, fd, etc.)").replace(
			BASH_RULE,
			"Use bash for file operations like ls, rg, fd",
		),
	);
	assert.equal(
		rewritePrompt(SAMPLE, { rg: false, fd: "fdfind" }),
		SAMPLE.replace(BASH_SNIPPET, "Execute bash commands (ls, grep, fdfind, etc.)").replace(
			BASH_RULE,
			"Use bash for file operations like ls, rg, fdfind",
		),
	);
	assert.equal(rewritePrompt(SAMPLE, { rg: false, fd: null }), SAMPLE);

	const custom = "Use grep and find exactly as I wrote them.";
	assert.equal(rewritePrompt(custom, { rg: true, fd: "fd" }), custom);
});

test("replacement is idempotent", () => {
	for (const tools of [
		{ rg: true, fd: "fd" },
		{ rg: true, fd: null },
		{ rg: false, fd: "fd" },
		{ rg: false, fd: "fdfind" },
		{ rg: false, fd: null },
	]) {
		const once = rewritePrompt(SAMPLE, tools);
		assert.equal(rewritePrompt(once, tools), once);
	}
});

test("before_agent_start returns a replacement only when a known line changed", () => {
	const hooks = {};
	createExtension({ rg: true, fd: "fd" })({
		on(event, handler) {
			hooks[event] = handler;
		},
	});
	const handler = hooks.before_agent_start;
	const first = handler({ systemPrompt: SAMPLE });
	const second = handler({ systemPrompt: SAMPLE });
	assert.deepEqual(first, second);
	assert.equal(first.systemPrompt.includes("ls, rg, fd"), true);
	assert.equal(handler({ systemPrompt: first.systemPrompt }), undefined);
	assert.equal(handler({ systemPrompt: "custom prompt without the default lines" }), undefined);

	let registered = 0;
	createExtension({ rg: false, fd: null })({
		on() {
			registered += 1;
		},
	});
	assert.equal(registered, 0);
});
