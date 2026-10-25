import { rewritePrompt } from "./prompt.js";

export default function piRgFd(pi) {
	pi.on("before_agent_start", (event) => {
		const input = event.systemPrompt;
		if (typeof input !== "string") return;
		const next = rewritePrompt(input);
		return next !== input ? { systemPrompt: next } : undefined;
	});
}
