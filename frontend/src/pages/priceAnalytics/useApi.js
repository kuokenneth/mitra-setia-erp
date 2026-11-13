import { useCallback, useEffect, useState } from "react";
import { api } from "../../api";

// GET `path` whenever it changes. Keeps the previous data while the next
// request loads (no flashing), and exposes reload(). `path = null` = idle.
export default function useApi(path) {
  const [nonce, setNonce] = useState(0);
  const [state, setState] = useState({ key: null, data: null, error: null });
  const key = path ? `${path}#${nonce}` : null;

  useEffect(() => {
    if (!path) return undefined;
    let alive = true;
    const requestKey = `${path}#${nonce}`;
    api(path).then(
      (data) => { if (alive) setState({ key: requestKey, data, error: null }); },
      (error) => { if (alive) setState((previous) => ({ key: requestKey, data: previous.data, error: error.message || "Gagal memuat data" })); },
    );
    return () => { alive = false; };
  }, [path, nonce]);

  const reload = useCallback(() => setNonce((value) => value + 1), []);
  const settled = state.key === key;
  return {
    data: state.data,
    error: settled ? state.error : null,
    loading: Boolean(key) && !settled,
    initial: Boolean(key) && state.data == null && !state.error,
    reload,
  };
}
