import { useEffect, useId, useRef, useState } from "react";
import { FiCornerDownLeft, FiSearch, FiX } from "react-icons/fi";
import { api } from "../../api";
import { CATEGORY_LABEL, dateLabel, rupiah } from "./format";

const MATCH_LABEL = { sku: "Kode barang", partNumber: "No. part", brand: "Merek", alias: "Nama alternatif" };

function Highlight({ text, query }) {
  const value = String(text || "");
  const needle = String(query || "").trim();
  if (!needle) return value;
  const index = value.toLocaleLowerCase("id-ID").indexOf(needle.toLocaleLowerCase("id-ID"));
  if (index < 0) return value;
  return <>{value.slice(0, index)}<mark>{value.slice(index, index + needle.length)}</mark>{value.slice(index + needle.length)}</>;
}

// Prominent combobox: suggestions while typing, arrow keys + Enter, Esc / ✕ to clear.
export default function SparepartSearch({ onSelect, compact = false, autoFocus = false }) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [results, setResults] = useState({ q: "", items: [], error: null });
  const inputRef = useRef(null);
  const listId = useId();
  const q = text.trim();

  useEffect(() => {
    if (!q) return undefined;
    let alive = true;
    const timer = setTimeout(() => {
      api(`/price-analytics/search?q=${encodeURIComponent(q)}`).then(
        (data) => { if (alive) { setResults({ q, items: data.items || [], error: null }); setActive(0); } },
        (error) => { if (alive) setResults({ q, items: [], error: error.message }); },
      );
    }, 180);
    return () => { alive = false; clearTimeout(timer); };
  }, [q]);

  const ready = q && results.q === q;
  const items = ready ? results.items : [];
  const showList = open && q.length > 0;

  function choose(item) {
    if (!item) return;
    setOpen(false);
    setText("");
    onSelect(item);
  }

  function onKeyDown(event) {
    if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); setActive((i) => Math.min(items.length - 1, i + 1)); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (event.key === "Enter") { if (showList && items[active]) { event.preventDefault(); choose(items[active]); } }
    else if (event.key === "Escape") { if (open && q) { setOpen(false); } else { setText(""); } }
  }

  return (
    <div className={`pa-search ${compact ? "compact" : ""}`}>
      <div className={`pa-search-box ${showList ? "is-open" : ""}`}>
        <FiSearch aria-hidden="true" className="pa-search-icon" />
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && items[active] ? `${listId}-${active}` : undefined}
          aria-label="Cari sparepart"
          placeholder="Cari nama sparepart, kode barang, merek, atau nomor part..."
          value={text}
          autoFocus={autoFocus}
          autoComplete="off"
          spellCheck="false"
          onChange={(event) => { setText(event.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKeyDown}
        />
        {text && <button type="button" className="pa-search-clear" aria-label="Hapus pencarian" onClick={() => { setText(""); inputRef.current?.focus(); }}><FiX /></button>}
      </div>
      {showList && (
        <div className="pa-search-pop">
          <ul id={listId} role="listbox" aria-label="Saran sparepart">
            {!ready && <li className="pa-search-note" aria-live="polite">Mencari…</li>}
            {ready && results.error && <li className="pa-search-note error">{results.error}</li>}
            {ready && !results.error && items.length === 0 && <li className="pa-search-note">Tidak ada sparepart yang cocok dengan “{q}”.</li>}
            {items.map((item, index) => (
              <li
                key={item.id}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === active}
                className={index === active ? "active" : ""}
                onMouseEnter={() => setActive(index)}
                onMouseDown={(event) => { event.preventDefault(); choose(item); }}
              >
                <span className="pa-search-main">
                  <strong><Highlight text={item.name} query={q} /></strong>
                  <small>
                    <span>{item.sku}</span>
                    {item.brand && <span>{item.brand}</span>}
                    {item.partNumber && <span>No. part {item.partNumber}</span>}
                    <span>{CATEGORY_LABEL[item.category] || item.category}</span>
                  </small>
                  {item.matchedOn !== "name" && <em>{MATCH_LABEL[item.matchedOn]}{item.alias ? `: ${item.alias}` : ""}</em>}
                </span>
                <span className="pa-search-side">
                  {item.historyCount ? (
                    <><b>{rupiah(item.latestPrice)}<small>/{item.unit}</small></b><small>{item.historyCount} pembelian · {dateLabel(item.latestDate)}</small></>
                  ) : <small className="muted">Belum ada riwayat pembelian</small>}
                </span>
                {index === active && <FiCornerDownLeft className="pa-search-enter" aria-hidden="true" />}
              </li>
            ))}
          </ul>
          <div className="pa-search-hint" aria-hidden="true"><kbd>↑</kbd><kbd>↓</kbd> pilih · <kbd>Enter</kbd> buka · <kbd>Esc</kbd> tutup</div>
        </div>
      )}
    </div>
  );
}
