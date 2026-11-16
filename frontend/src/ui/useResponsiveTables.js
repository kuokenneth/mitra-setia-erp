import { useEffect } from "react";

/**
 * Gives every data table inside `rootSelector` the information it needs to
 * render as a stacked card list on phones (see styles/modules.css, "Phone
 * tables"). It only adds attributes (data-label on cells, a class on the
 * table) — no element is moved, removed or re-rendered, so every button,
 * input and handler inside the table keeps working exactly as before.
 *
 * Opt out per table with data-keep-table (e.g. print layouts, matrices).
 */
const textOf = (cell) => (cell.getAttribute("aria-label") || cell.textContent || "").replace(/\s+/g, " ").trim();

function labelTable(table) {
  if (table.hasAttribute("data-keep-table") || table.closest("[data-keep-table]")) return;
  const headRow = table.tHead?.rows?.[table.tHead.rows.length - 1];
  if (!headRow) return;
  const labels = [];
  for (const th of headRow.cells) {
    const span = Math.max(1, th.colSpan || 1);
    const text = textOf(th);
    for (let i = 0; i < span; i += 1) labels.push(text);
  }
  if (labels.length < 3) return;
  table.classList.add("ms-cardtable");
  const actionIndex = labels.length - 1;
  const lastIsAction = /^(aksi|tindakan|action|actions|opsi|)$/i.test(labels[actionIndex]);
  for (const body of table.tBodies) {
    for (const row of body.rows) {
      let index = 0;
      for (const cell of row.cells) {
        const label = labels[index] || "";
        if (cell.colSpan >= labels.length - 1) cell.setAttribute("data-full", "");
        else if (cell.getAttribute("data-label") !== label) cell.setAttribute("data-label", label);
        if (lastIsAction && index === actionIndex) cell.setAttribute("data-actions", "");
        index += Math.max(1, cell.colSpan || 1);
      }
    }
  }
}

export default function useResponsiveTables(tableSelector = ".erp-content table, .ui-modal table") {
  useEffect(() => {
    const root = document.body;
    if (typeof MutationObserver === "undefined") return undefined;
    let frame = 0;
    const run = () => { frame = 0; root.querySelectorAll(tableSelector).forEach(labelTable); };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(run); };
    run();
    const observer = new MutationObserver(schedule);
    observer.observe(root, { childList: true, subtree: true });
    return () => { observer.disconnect(); if (frame) cancelAnimationFrame(frame); };
  }, [tableSelector]);
}
