import { statSync } from "node:fs";
import path from "node:path";

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

const WINDOWS_PATHEXT = ".COM;.EXE;.BAT;.CMD;.VBS;.VBE;.JS;.JSE;.WSF;.WSH;.MSC";

/**
 * @param {Record<string, string | undefined>} env
 * @param {string} name
 * @param {string} platform
 */
function envValue(env, name, platform) {
	if (platform !== "win32") return env[name] ?? "";
	const lower = name.toLowerCase();
	for (const key of Object.keys(env)) {
		if (key.toLowerCase() === lower) return env[key] ?? "";
	}
	return "";
}

/**
 * @param {string} name
 * @param {string} platform
 * @param {string} pathext
 */
function commandNames(name, platform, pathext) {
	if (platform !== "win32") return [name];
	const extensions = new Set([".exe", ".EXE"]);
	for (const raw of pathext.split(";")) {
		const ext = raw.trim();
		if (ext === "" || ext === ".") {
			extensions.add("");
			continue;
		}
		const suffix = ext.startsWith(".") ? ext : `.${ext}`;
		extensions.add(suffix);
		extensions.add(suffix.toLowerCase());
		extensions.add(suffix.toUpperCase());
	}
	return [...extensions].map((ext) => (ext ? name + ext : name));
}

/**
 * @param {string} file
 * @param {string} platform
 */
function isRunnableFile(file, platform) {
	try {
		const stat = statSync(file);
		if (!stat.isFile()) return false;
		if (platform === "win32") return true;
		return (stat.mode & 0o111) !== 0;
	} catch {
		return false;
	}
}

/**
 * Locate `rg` and `fd` by scanning PATH. No processes are spawned.
 * `fd` is `"fd"`, `"fdfind"` (Debian/Ubuntu), or null.
 *
 * @param {{ env?: NodeJS.ProcessEnv, platform?: string }} [options]
 * @returns {{ rg: boolean, fd: "fd" | "fdfind" | null }}
 */
export function detectSearchTools(options = {}) {
	const platform = options.platform ?? process.platform;
	const env = options.env ?? process.env;
	const dirs = envValue(env, "PATH", platform)
		.split(platform === "win32" ? ";" : ":")
		.filter((dir) => dir.length > 0);
	const pathext = platform === "win32" ? envValue(env, "PATHEXT", platform) || WINDOWS_PATHEXT : "";

	const has = (name) => {
		const names = commandNames(name, platform, pathext);
		for (const dir of dirs) {
			for (const candidate of names) {
				if (isRunnableFile(path.join(dir, candidate), platform)) return true;
			}
		}
		return false;
	};

	return {
		rg: has("rg"),
		fd: has("fd") ? "fd" : has("fdfind") ? "fdfind" : null,
	};
}

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
 * @param {{ rg: boolean, fd: "fd" | "fdfind" | null }} tools
 */
export function rewritePrompt(prompt, tools) {
	if (!tools.rg && !tools.fd) return prompt;
	const contentTool = tools.rg ? "rg" : "grep";
	const fileTool = tools.fd ?? "find";
	let next = replaceExact(prompt, BASH_SNIPPET, `Execute bash commands (ls, ${contentTool}, ${fileTool}, etc.)`);
	if (tools.fd) {
		next = replaceExact(next, BASH_RULE, `Use bash for file operations like ls, rg, ${tools.fd}`);
	}
	return next;
}
