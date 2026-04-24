import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, RefObject } from "react";

export type EntityOption = {
  entity_id: string;
  friendly_name: string;
  area?: string | null;
  state?: string | null;
};

type Trigger = { at: number; query: string } | null;

type Args = {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  setValue: (v: string) => void;
};

export type AutocompleteState = {
  open: boolean;
  options: EntityOption[];
  highlighted: number;
  query: string;
  handleKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => boolean;
  onSelect: (idx: number) => void;
  dismiss: () => void;
};

export function useEntityAutocomplete({ textareaRef, value, setValue }: Args): AutocompleteState {
  const [options, setOptions] = useState<EntityOption[]>([]);
  const [highlighted, setHighlighted] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const lastFetchRef = useRef(0);

  const trigger: Trigger = useMemo(() => {
    const el = textareaRef.current;
    if (!el) return null;
    const pos = el.selectionStart ?? value.length;
    // Walk back from caret to find an '@' that starts a token (preceded by
    // whitespace or start-of-string). Stop if we hit whitespace first.
    let at = -1;
    for (let i = pos - 1; i >= 0; i--) {
      const ch = value[i];
      if (ch === "@") {
        const before = i === 0 ? " " : value[i - 1];
        if (/\s/.test(before)) at = i;
        break;
      }
      if (/\s/.test(ch)) break;
    }
    if (at < 0) return null;
    const query = value.slice(at + 1, pos);
    // Accept entity_id-ish chars: letters, digits, dot, underscore. Abort on others.
    if (!/^[a-zA-Z0-9._]*$/.test(query)) return null;
    return { at, query };
  }, [value, textareaRef]);

  useEffect(() => {
    if (dismissed) return;
    if (!trigger) {
      setOptions([]);
      return;
    }
    const q = trigger.query;
    const reqId = ++lastFetchRef.current;
    const tid = window.setTimeout(() => {
      fetch(`/entities?prefix=${encodeURIComponent(q)}&limit=8`)
        .then((r) => r.json())
        .then((d) => {
          if (reqId !== lastFetchRef.current) return;
          setOptions((d.entities ?? []) as EntityOption[]);
          setHighlighted(0);
        })
        .catch(() => setOptions([]));
    }, 100);
    return () => window.clearTimeout(tid);
  }, [trigger, dismissed]);

  useEffect(() => {
    if (!trigger && dismissed) setDismissed(false);
  }, [trigger, dismissed]);

  const insert = useCallback(
    (opt: EntityOption) => {
      const el = textareaRef.current;
      if (!el || !trigger) return;
      const pos = el.selectionStart ?? value.length;
      const before = value.slice(0, trigger.at);
      const after = value.slice(pos);
      const next = `${before}${opt.entity_id} ${after}`;
      setValue(next);
      setOptions([]);
      window.requestAnimationFrame(() => {
        const el2 = textareaRef.current;
        if (!el2) return;
        const caret = (before + opt.entity_id + " ").length;
        el2.focus();
        el2.setSelectionRange(caret, caret);
      });
    },
    [trigger, value, setValue, textareaRef],
  );

  const open = !!trigger && !dismissed && options.length > 0;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>): boolean => {
      if (!open) return false;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlighted((h) => (h + 1) % options.length);
        return true;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlighted((h) => (h - 1 + options.length) % options.length);
        return true;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        const opt = options[highlighted];
        if (opt) insert(opt);
        return true;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setDismissed(true);
        return true;
      }
      return false;
    },
    [open, options, highlighted, insert],
  );

  const onSelect = useCallback(
    (idx: number) => {
      const opt = options[idx];
      if (opt) insert(opt);
    },
    [options, insert],
  );

  const dismiss = useCallback(() => setDismissed(true), []);

  return {
    open,
    options,
    highlighted,
    query: trigger?.query ?? "",
    handleKeyDown,
    onSelect,
    dismiss,
  };
}
