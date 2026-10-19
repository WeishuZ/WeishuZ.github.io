(() => {
  const features = [...document.querySelectorAll(".operations-feature")];
  const image = document.querySelector("#preview-image");
  if (!features.length || !image) return;
  const views = {
    overview: {
      caption: "Resource overview",
      alt: "Redacted Agent Operations interface showing resource panels and inventory fields, with operational values withheld.",
    },
    instances: {
      caption: "Instance diagnostics",
      alt: "Redacted Agent Operations interface showing diagnostic fields and accounting sources, with instance identity and values withheld.",
    },
    reliability: {
      caption: "Reliability explorer",
      alt: "Redacted Agent Operations interface showing health-check and latency fields, with check history and values withheld.",
    },
    signals: {
      caption: "Signal coverage",
      alt: "Redacted Agent Operations interface showing metric definitions and source contracts, with deployment coverage withheld.",
    },
  };
  function select(view) {
    const description = views[view];
    if (!description) return;
    image.src = `assets/agent-operations/${view}.png`;
    image.alt = description.alt;
    document.querySelector("#preview-mobile").srcset =
      `assets/agent-operations/${view}-mobile.png`;
    document.querySelector("#preview-caption").textContent =
      description.caption;
    document
      .querySelector("#preview-link")
      .setAttribute(
        "aria-label",
        `Open redacted ${description.caption.toLowerCase()}`,
      );
    for (const link of [
      document.querySelector("#preview-link"),
      document.querySelector("#open-console"),
    ])
      link.href = `projects/agent-operations/preview.html#${view}`;
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
})();
