// Returns `value` once it has stopped changing for `ms` milliseconds.
import { useEffect, useState } from 'react';

export function useDebouncedValue(value, ms = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}
