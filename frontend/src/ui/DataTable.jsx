import { useMemo, useState } from "react";
import { FiArrowDown, FiArrowUp, FiChevronDown, FiChevronUp } from "react-icons/fi";
import { Button, EmptyState, LoadingSkeleton } from "./primitives";

const cx = (...parts) => parts.filter(Boolean).join(" ");
const valueOf = (column, row) => (typeof column.accessor === "function" ? column.accessor(row) : row?.[column.accessor || column.key]);

/**
 * Citra-style data table that becomes a card list on phones.
 * columns: [{ key, header, accessor?, cell?(row), align?, sortable?, priority?: 'primary'|'secondary'|'hidden-tablet', mobile?: false }]
 * mobile:  { title(row), subtitle?(row), status?(row), actions?(row) } — every column not used
 *          for the title is still shown inside the card (secondary ones behind "Detail").
 */
export function DataTable({ columns, rows = [], rowKey = "id", onRowClick, loading, empty, mobile, toolbar, footer, className, caption }) {
  const [sort, setSort] = useState(null);
  const [expanded, setExpanded] = useState({});
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const column = columns.find((item) => item.key === sort.key);
    if (!column) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      const x = valueOf(column, a); const y = valueOf(column, b);
      if (x == null) return 1; if (y == null) return -1;
      return (x > y ? 1 : x < y ? -1 : 0) * (sort.desc ? -1 : 1);
    });
    return copy;
  }, [rows, sort, columns]);
  const keyOf = (row, index) => (typeof rowKey === "function" ? rowKey(row) : row?.[rowKey]) ?? index;
  const toggleSort = (key) => setSort((current) => (current?.key !== key ? { key, desc: false } : current.desc ? null : { key, desc: true }));
  const primary = columns.filter((column) => column.priority !== "secondary" && column.mobile !== false);
  const secondary = columns.filter((column) => column.priority === "secondary" && column.mobile !== false);
  const render = (column, row) => (column.cell ? column.cell(row) : valueOf(column, row) ?? "-");

  return (
    <div className={cx("ui-datatable", mobile && "ui-datatable--cards", className)}>
      {toolbar}
      {loading ? <LoadingSkeleton rows={5} /> : !sorted.length ? (empty || <EmptyState />) : (
        <>
          <div className="ui-table-wrap" tabIndex={0} role="region" aria-label={caption || "Tabel data"}>
            <table className="ui-table">
              {caption ? <caption className="ui-sr">{caption}</caption> : null}
              <thead><tr>{columns.map((column) => (
                <th key={column.key} scope="col" className={cx(column.align === "right" && "is-right", column.priority === "hidden-tablet" && "ui-hide-tablet")} style={column.width ? { width: column.width } : undefined} aria-sort={sort?.key === column.key ? (sort.desc ? "descending" : "ascending") : undefined}>
                  {column.sortable ? <button type="button" className="ui-table__sort" onClick={() => toggleSort(column.key)}>{column.header}{sort?.key === column.key ? (sort.desc ? <FiArrowDown /> : <FiArrowUp />) : null}</button> : column.header}
                </th>
              ))}</tr></thead>
              <tbody>{sorted.map((row, index) => (
                <tr key={keyOf(row, index)} className={onRowClick ? "is-clickable" : undefined} onClick={onRowClick ? () => onRowClick(row) : undefined} tabIndex={onRowClick ? 0 : undefined} onKeyDown={onRowClick ? (event) => event.key === "Enter" && onRowClick(row) : undefined}>
                  {columns.map((column) => <td key={column.key} className={cx(column.align === "right" && "is-right", column.priority === "hidden-tablet" && "ui-hide-tablet")}>{render(column, row)}</td>)}
                </tr>
              ))}</tbody>
            </table>
          </div>
          {mobile ? (
            <ul className="ui-list" aria-label={caption || "Daftar data"} style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {sorted.map((row, index) => {
                const key = keyOf(row, index);
                const open = Boolean(expanded[key]);
                const shown = primary.filter((column) => !mobile.hide?.includes(column.key));
                return (
                  <li key={key} className="ui-list__item">
                    <div className="ui-list__top">
                      <div style={{ minWidth: 0 }}>
                        <div className="ui-list__title">{mobile.title(row)}</div>
                        {mobile.subtitle ? <div className="ui-list__subtitle">{mobile.subtitle(row)}</div> : null}
                      </div>
                      {mobile.status ? mobile.status(row) : null}
                    </div>
                    {shown.length ? <dl className="ui-list__meta">{shown.map((column) => <div key={column.key}><dt>{column.header}</dt><dd>{render(column, row)}</dd></div>)}</dl> : null}
                    {open && secondary.length ? <dl className="ui-list__meta">{secondary.map((column) => <div key={column.key}><dt>{column.header}</dt><dd>{render(column, row)}</dd></div>)}</dl> : null}
                    {(mobile.actions || secondary.length || onRowClick) ? (
                      <div className="ui-list__actions">
                        {secondary.length ? <Button size="sm" variant="ghost" className="ui-list__more" aria-expanded={open} onClick={() => setExpanded((state) => ({ ...state, [key]: !open }))} icon={open ? <FiChevronUp /> : <FiChevronDown />}>{open ? "Sembunyikan" : "Detail"}</Button> : null}
                        {mobile.actions ? mobile.actions(row) : onRowClick ? <Button size="sm" onClick={() => onRowClick(row)}>Buka</Button> : null}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : null}
        </>
      )}
      {footer}
    </div>
  );
}
export const ResponsiveTable = DataTable;
export const ResponsiveDataList = DataTable;
