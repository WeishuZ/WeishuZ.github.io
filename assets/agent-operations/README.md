# Mock interface previews

The public interface and these images use a fixed synthetic scenario, explicitly labelled **Mock data · illustrative only** in the interface, screenshot, homepage caption and export metadata. They are not production measurements or evidence of deployment scale, performance or availability.

`projects/agent-operations/mock-scenario.js` generates the fixture locally. It does not use a server observation, private screenshot, user identity or network input. The public page shares the real tool's renderer and inspection controls, but selects an explicit mock adapter with no fallback to a live API. Missing fixture code fails closed.

Synthetic records include a collection gap, a failed worker, a failed health check and calculated percentiles. Aggregate counts use the full synthetic window, while chart points are bounded. All live metrics and the actual service remain private.
