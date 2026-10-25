/**
 * Default bash tool line in @earendil-works/pi-coding-agent 1.4.0
 * (`bashToolSystemPromptContribution.snippet`).
 */
export const BASH_SNIPPET = "Execute bash commands (ls, grep, find, etc.)";

/**
 * Default guideline in Pi 1.4.0 when bash is enabled and the grep, find, and
 * ls tools are not (`buildRules` in `system-prompt.js`).
 */
export const BASH_RULE = "Use bash for file operations like ls, rg, find";

const REWRITTEN_SNIPPET = "Execute bash commands (ls, rg, fd, etc.)";
const REWRITTEN_RULE = "Use bash for file operations like ls, rg, fd";

/**
 * @param {string} text
 * @param {string} from
 * @param {string} to
 */
function replaceExact(text, from, to) {
	if (from === to || !text.includes(from)) return text;
	return text.replaceAll(from, to);
}

/**
 * Replace Pi's default grep/find lines in place. Unknown text is returned
 * unchanged (same string when nothing matches).
 *
 * @param {string} prompt
 */
export function rewritePrompt(prompt) {
	let next = replaceExact(prompt, BASH_SNIPPET, REWRITTEN_SNIPPET);
	next = replaceExact(next, BASH_RULE, REWRITTEN_RULE);
	return next;
}
