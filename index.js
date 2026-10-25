import { rewritePrompt } from "./prompt.js";

const CACHE_LIMIT = 8;

export function createExtension() {
	/** @type {Map<string, string>} */
	const cache = new Map();

	return function piRgFd(pi) {
		pi.on("before_agent_start", (event) => {
			const input = event.systemPrompt;
			if (typeof input !== "string") return;

			let output = cache.get(input);
			if (output !== undefined) {
				cache.delete(input);
				cache.set(input, output);
			} else {
				output = rewritePrompt(input);
				cache.set(input, output);
				if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value);
			}

			if (output !== input) return { systemPrompt: output };
		});
	};
}

export default createExtension();
