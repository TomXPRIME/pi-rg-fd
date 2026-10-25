import assert from "node:assert/strict";
import { test } from "node:test";
import piRgFd from "../index.js";
import { BASH_RULE, BASH_SNIPPET, rewritePrompt } from "../prompt.js";

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

test("rewrites the Pi 1.4 grep and find lines", () => {
	const next = rewritePrompt(SAMPLE);
	assert.equal(next.includes("Execute bash commands (ls, rg, fd, etc.)"), true);
	assert.equal(next.includes("Use bash for file operations like ls, rg, fd"), true);
	assert.equal(next.includes("- grep: Search file contents"), true);
	assert.equal(next.includes("finding files"), true);
	assert.equal(next.includes(BASH_SNIPPET), false);
	assert.equal(next.includes(BASH_RULE), false);
	assert.ok(next.length < SAMPLE.length);

	const custom = "Use grep and find exactly as I wrote them.";
	assert.equal(rewritePrompt(custom), custom);
});

test("replacement is idempotent", () => {
	const once = rewritePrompt(SAMPLE);
	assert.equal(rewritePrompt(once), once);
	assert.equal(rewritePrompt("custom prompt without the default lines"), "custom prompt without the default lines");
});

test("before_agent_start returns a replacement only when a known line changed", () => {
	const hooks = {};
	piRgFd({
		on(event, handler) {
			hooks[event] = handler;
		},
	});
	const handler = hooks.before_agent_start;
	const result = handler({ systemPrompt: SAMPLE });
	assert.equal(result.systemPrompt.includes("ls, rg, fd"), true);
	assert.equal(handler({ systemPrompt: result.systemPrompt }), undefined);
	assert.equal(handler({ systemPrompt: "custom prompt without the default lines" }), undefined);
});
