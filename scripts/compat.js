/**
 * Check pi-rg-fd against the installed @earendil-works/pi-coding-agent.
 *
 * Reads the bash prompt contribution and default system prompt from that
 * package, loads this extension with Pi's loader, and runs before_agent_start
 * with rg and fd present on PATH.
 */
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { BASH_RULE, BASH_SNIPPET } from "../prompt.js";

const REWRITTEN_SNIPPET = "Execute bash commands (ls, rg, fd, etc.)";
const REWRITTEN_RULE = "Use bash for file operations like ls, rg, fd";

const here = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.resolve(here, "../index.js");
const bin = mkdtempSync(path.join(tmpdir(), "pi-rg-fd-compat-"));

try {
	const piRoot = locatePi();
	const pi = JSON.parse(readFileSync(path.join(piRoot, "package.json"), "utf8"));
	const { buildSystemPrompt } = await import(piModule(piRoot, "dist/core/system-prompt.js"));
	const { bashToolSystemPromptContribution } = await import(piModule(piRoot, "dist/core/tools/bash.js"));
	const { loadExtensions } = await import(piModule(piRoot, "dist/core/extensions/loader.js"));

	const snippet = bashToolSystemPromptContribution.snippet;
	if (snippet !== BASH_SNIPPET) {
		throw new Error(
			`Pi ${pi.version} bash tool line changed.\n  Pi: ${snippet}\n  pi-rg-fd targets: ${BASH_SNIPPET}`,
		);
	}

	const prompt = buildSystemPrompt({
		cwd: process.cwd(),
		toolSnippets: { bash: snippet },
		toolGuidelines: { bash: [...bashToolSystemPromptContribution.guidelines] },
	});
	requireLine(prompt, BASH_SNIPPET, pi.version, "default system prompt");
	requireLine(prompt, BASH_RULE, pi.version, "default system prompt");

	placeTools(bin);
	const loaded = await loadExtensions([extensionPath], path.dirname(extensionPath));
	if (loaded.errors?.length) {
		throw new Error(loaded.errors.map((entry) => `${entry.path}: ${entry.error}`).join("\n"));
	}
	const handlers = loaded.extensions[0]?.handlers.get("before_agent_start") ?? [];
	if (handlers.length !== 1) {
		throw new Error(`Pi loaded ${handlers.length} before_agent_start handlers; expected 1 (rg and fd on PATH).`);
	}

	const result = await handlers[0]({ type: "before_agent_start", systemPrompt: prompt }, {});
	const rewritten = result?.systemPrompt;
	if (typeof rewritten !== "string") {
		throw new Error("before_agent_start did not replace the system prompt.");
	}
	requireLine(rewritten, REWRITTEN_SNIPPET, pi.version, "rewritten prompt");
	requireLine(rewritten, REWRITTEN_RULE, pi.version, "rewritten prompt");
	if (rewritten.includes(BASH_SNIPPET) || rewritten.includes(BASH_RULE)) {
		throw new Error("Rewritten prompt still contains the original grep/find lines.");
	}

	console.log(`@earendil-works/pi-coding-agent@${pi.version}`);
	console.log(`bash tool line: ${BASH_SNIPPET}`);
	console.log(`            -> ${REWRITTEN_SNIPPET}`);
	console.log(`guideline: ${BASH_RULE}`);
	console.log(`        -> ${REWRITTEN_RULE}`);
	console.log("pi-rg-fd compat ok");
} catch (error) {
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
} finally {
	rmSync(bin, { recursive: true, force: true });
}

function locatePi() {
	let entry;
	try {
		entry = fileURLToPath(import.meta.resolve("@earendil-works/pi-coding-agent"));
	} catch {
		throw new Error("Install Pi first: npm install --no-save @earendil-works/pi-coding-agent@latest");
	}
	let dir = path.dirname(entry);
	while (dir !== path.dirname(dir)) {
		const pkgPath = path.join(dir, "package.json");
		if (existsSync(pkgPath)) {
			const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
			if (pkg.name === "@earendil-works/pi-coding-agent") return dir;
		}
		dir = path.dirname(dir);
	}
	throw new Error("Could not locate @earendil-works/pi-coding-agent.");
}

function piModule(root, relativePath) {
	const file = path.join(root, relativePath);
	if (!existsSync(file)) {
		throw new Error(`Pi is missing ${relativePath}. The compat check needs that build file.`);
	}
	return pathToFileURL(file).href;
}

function requireLine(text, line, version, where) {
	if (!text.includes(line)) {
		throw new Error(`Pi ${version} ${where} is missing:\n${line}`);
	}
}

function placeTools(dir) {
	const windows = process.platform === "win32";
	for (const name of windows ? ["rg.exe", "fd.exe"] : ["rg", "fd"]) {
		const file = path.join(dir, name);
		writeFileSync(file, "");
		if (!windows) chmodSync(file, 0o755);
	}
	const current = process.env.PATH ?? "";
	process.env.PATH = current ? `${dir}${path.delimiter}${current}` : dir;
}
