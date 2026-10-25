import { readdirSync, statSync } from "node:fs";
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
 * Lowercased PATHEXT suffixes. `.exe` is always included. `""` allows a bare name.
 *
 * @param {string} pathext
 */
function windowsExtensions(pathext) {
	const extensions = new Set([".exe"]);
	for (const raw of pathext.split(";")) {
		const ext = raw.trim();
		if (ext === "" || ext === ".") {
			extensions.add("");
			continue;
		}
		const suffix = ext.startsWith(".") ? ext : `.${ext}`;
		extensions.add(suffix.toLowerCase());
	}
	return extensions;
}

/**
 * @param {string} command
 * @param {Set<string>} extensions
 */
function windowsNames(command, extensions) {
	const base = command.toLowerCase();
	const names = new Set();
	for (const ext of extensions) names.add(ext ? base + ext : base);
	return names;
}

/**
 * Stat only a name that already matched. Windows regular files need no stat.
 *
 * @param {string} dir
 * @param {import("node:fs").Dirent} entry
 * @param {string} platform
 */
function isRunnable(dir, entry, platform) {
	if (entry.isDirectory()) return false;
	if (platform === "win32" && entry.isFile()) return true;
	try {
		const stat = statSync(path.join(dir, entry.name));
		if (!stat.isFile()) return false;
		if (platform === "win32") return true;
		return (stat.mode & 0o111) !== 0;
	} catch {
		return false;
	}
}

/**
 * Locate `rg` and `fd` by scanning PATH. No processes are spawned.
 * One directory listing per PATH entry, and none after both `rg` and `fd` are found.
 * `fd` is `"fd"`, `"fdfind"` (Debian/Ubuntu), or null. A later `fd` wins over an earlier `fdfind`.
 *
 * @param {{ env?: NodeJS.ProcessEnv, platform?: string }} [options]
 * @returns {{ rg: boolean, fd: "fd" | "fdfind" | null }}
 */
export function detectSearchTools(options = {}) {
	const platform = options.platform ?? process.platform;
	const env = options.env ?? process.env;
	const windows = platform === "win32";
	const dirs = envValue(env, "PATH", platform)
		.split(windows ? ";" : ":")
		.filter((dir) => dir.length > 0);
	const extensions = windows ? windowsExtensions(envValue(env, "PATHEXT", platform) || WINDOWS_PATHEXT) : null;
	const rgNames = windows ? windowsNames("rg", extensions) : null;
	const fdNames = windows ? windowsNames("fd", extensions) : null;
	const fdfindNames = windows ? windowsNames("fdfind", extensions) : null;

	let rg = false;
	let fd = false;
	let fdfind = false;

	for (const dir of dirs) {
		if (rg && fd) break;
		let entries;
		try {
			entries = readdirSync(dir, { withFileTypes: true });
		} catch {
			continue;
		}
		for (const entry of entries) {
			const key = windows ? entry.name.toLowerCase() : entry.name;
			if (!rg && (windows ? rgNames.has(key) : key === "rg") && isRunnable(dir, entry, platform)) rg = true;
			if (!fd && (windows ? fdNames.has(key) : key === "fd") && isRunnable(dir, entry, platform)) fd = true;
			if (!fdfind && (windows ? fdfindNames.has(key) : key === "fdfind") && isRunnable(dir, entry, platform)) {
				fdfind = true;
			}
			if (rg && fd) break;
		}
	}

	return { rg, fd: fd ? "fd" : fdfind ? "fdfind" : null };
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
