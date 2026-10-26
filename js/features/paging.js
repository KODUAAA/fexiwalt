// "Load more" for lists of ads that are already in memory (browse page, seller page).
// Shows PAGE_SIZE items at a time, with a button under the grid for the next batch.
export const PAGE_SIZE = 12;

// The button lives in a <div class="load-more"> placed right after the grid.
export function loadMoreBar(grid) {
  let bar = grid.nextElementSibling;
  if (!bar?.classList.contains("load-more")) {
    bar = document.createElement("div");
    bar.className = "load-more";
    bar.hidden = true;
    bar.innerHTML = '<button type="button" class="load-more-btn"></button><small></small>';
    grid.after(bar);
  }
  return bar;
}

/**
 * Render `items` into `grid` in batches. Calling it again starts over from the first batch
 * (use it whenever filters or sorting change).
 *   renderBatched(grid, ads, adCard)
 */
export function renderBatched(grid, items, renderItem, pageSize = PAGE_SIZE) {
  const bar = loadMoreBar(grid);
  const btn = bar.querySelector("button"), note = bar.querySelector("small");
  let shown = 0;

  const showNext = () => {
    const next = items.slice(shown, shown + pageSize);
    grid.insertAdjacentHTML("beforeend", next.map(renderItem).join(""));
    shown += next.length;
    const left = items.length - shown;
    bar.hidden = left <= 0;
    btn.textContent = `Load more (${Math.min(pageSize, left)} of ${left} left)`;
    note.textContent = `Showing ${shown} of ${items.length}`;
  };

  grid.innerHTML = "";
  bar.hidden = true;
  btn.onclick = showNext;
  if (items.length) showNext();
}

/** Remove the button (used when a list is empty or failed to load). */
export function clearLoadMore(grid) {
  const bar = grid.nextElementSibling;
  if (bar?.classList.contains("load-more")) bar.hidden = true;
}
