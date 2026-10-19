(() => {
  const projects = {
    operations: {
      directory: "assets/agent-operations",
      version: "mock-1",
      label: "Open mock",
      views: {
        overview: {
          caption: "Resource overview",
          alt: "Mock Agent Operations interface showing resource panels and inventory fields, using illustrative mock data.",
          url: "projects/agent-operations/preview.html#overview",
          cta: "Explore mock interface ↗",
        },
        instances: {
          caption: "Instance diagnostics",
          alt: "Mock Agent Operations interface showing diagnostic fields and accounting sources, using synthetic instance identities and values.",
          url: "projects/agent-operations/preview.html#instances",
          cta: "Explore mock interface ↗",
        },
        reliability: {
          caption: "Reliability explorer",
          alt: "Mock Agent Operations interface showing health-check and latency fields, using synthetic check history and values.",
          url: "projects/agent-operations/preview.html#reliability",
          cta: "Explore mock interface ↗",
        },
        signals: {
          caption: "Signal coverage",
          alt: "Mock Agent Operations interface showing metric definitions and source contracts, with illustrative coverage.",
          url: "projects/agent-operations/preview.html#signals",
          cta: "Explore mock interface ↗",
        },
      },
    },
    "mini-vllm": {
      directory: "assets/mini-vllm",
      version: "mini-1",
      label: "Open mini-vLLM",
      views: {
        terminal: {
          caption: "Serving terminal",
          alt: "Mock mini-vLLM terminal alongside physical KV blocks and the request queue.",
          url: "projects/mini-vllm/",
          cta: "Open terminal ↗",
        },
        "kv-blocks": {
          caption: "KV block inspection",
          alt: "Mock mini-vLLM request selected to show its non-contiguous physical KV block table.",
          url: "projects/mini-vllm/?inspect=req-02#kv-inspector",
          cta: "Inspect KV blocks ↗",
        },
        pressure: {
          caption: "Recompute under pressure",
          alt: "Mock mini-vLLM pressure scenario showing KV eviction, recomputation and request diagnostics.",
          url: "projects/mini-vllm/?scenario=pressure&steps=20&inspect=req-02#kv-inspector",
          cta: "Try the pressure scenario ↗",
        },
      },
    },
  };
  for (const root of document.querySelectorAll("[data-project-showcase]")) {
    const project = projects[root.dataset.projectShowcase];
    if (!project) continue;
    const features = [...root.querySelectorAll(".operations-feature")];
    const image = root.querySelector("[data-preview-image]");
    function select(view) {
      const description = project.views[view];
      if (!description) return;
      image.src = `${project.directory}/${view}.png?v=${project.version}`;
      image.alt = description.alt;
      root.querySelector("[data-preview-mobile]").srcset =
        `${project.directory}/${view}-mobile.png?v=${project.version}`;
      root.querySelector("[data-preview-caption]").textContent =
        description.caption;
      const previewLink = root.querySelector("[data-preview-link]");
      previewLink.setAttribute(
        "aria-label",
        `${project.label} ${description.caption.toLowerCase()}`,
      );
      previewLink.href = description.url;
      const cta = root.querySelector("[data-preview-cta]");
      cta.href = description.url;
      cta.textContent = description.cta;
    }
    for (const [index, feature] of features.entries()) {
      feature.addEventListener("toggle", () => {
        if (!feature.open) return;
        for (const other of features) if (other !== feature) other.open = false;
        select(feature.dataset.view);
      });
      feature.querySelector("summary").addEventListener("keydown", (event) => {
        let next;
        if (event.key === "ArrowDown") next = (index + 1) % features.length;
        if (event.key === "ArrowUp")
          next = (index - 1 + features.length) % features.length;
        if (event.key === "Home") next = 0;
        if (event.key === "End") next = features.length - 1;
        if (next !== undefined) {
          event.preventDefault();
          features[next].querySelector("summary").focus();
        }
      });
    }
  }
})();
