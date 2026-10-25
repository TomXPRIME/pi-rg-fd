import { detectSearchTools, rewritePrompt } from "./prompt.js";

const CACHE_LIMIT = 8;

/**
 * @param {{ rg: boolean, fd: "fd" | "fdfind" | null }} [tools]
 */
export function createExtension(tools = detectSearchTools()) {
	/** @type {Map<string, string>} */
	const cache = new Map();

	return function piRgFd(pi) {
		if (!tools.rg && !tools.fd) return;

		pi.on("before_agent_start", (event) => {
			const input = event.systemPrompt;
			if (typeof input !== "string") return;

			let output = cache.get(input);
			if (output !== undefined) {
				cache.delete(input);
				cache.set(input, output);
			} else {
				output = rewritePrompt(input, tools);
				cache.set(input, output);
				if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value);
			}

			if (output !== input) return { systemPrompt: output };
		});
	};
}

export default createExtension();
