import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Runs an async loader, tracking loading/error/data and cancelling the
 * in-flight request when inputs change or the component unmounts.
 *
 * `deps` behaves like a useEffect dependency list.
 */
export function useAsync(loader, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const [reloadToken, setReloadToken] = useState(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    setState((prev) => ({ ...prev, loading: true, error: null }));

    loaderRef.current({ signal: controller.signal })
      .then((data) => {
        if (active) setState({ data, error: null, loading: false });
      })
      .catch((error) => {
        if (active && !controller.signal.aborted) {
          setState({ data: null, error, loading: false });
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reloadToken]);

  const reload = useCallback(() => setReloadToken((n) => n + 1), []);

  return { ...state, reload };
}
