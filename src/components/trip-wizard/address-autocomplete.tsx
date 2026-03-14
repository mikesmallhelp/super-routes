"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";

interface Suggestion {
  label: string;
  lat: number;
  lon: number;
}

interface AddressAutocompleteProps {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onSelect: (suggestion: Suggestion) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

export function AddressAutocomplete({
  label,
  placeholder,
  value,
  onChange,
  onSelect,
  onKeyDown,
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchSuggestions = useCallback(async (text: string) => {
    if (text.length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    try {
      const res = await fetch(
        `/api/autocomplete?text=${encodeURIComponent(text)}`
      );
      if (!res.ok) return;
      const data: Suggestion[] = await res.json();
      setSuggestions(data);
      setOpen(data.length > 0);
      setActiveIndex(-1);
    } catch {
      // silently ignore
    }
  }, []);

  function handleChange(text: string) {
    onChange(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(text), 300);
  }

  function handleSelect(suggestion: Suggestion) {
    onChange(suggestion.label);
    setSuggestions([]);
    setOpen(false);
    onSelect(suggestion);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (open && suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter" && activeIndex >= 0) {
        e.preventDefault();
        handleSelect(suggestions[activeIndex]);
        return;
      }
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
    }
    onKeyDown?.(e);
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div ref={containerRef} className="space-y-2 relative">
      <label className="text-sm font-medium">{label}</label>
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        autoComplete="off"
      />
      {open && (
        <ul className="absolute z-50 top-full left-0 right-0 mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
          {suggestions.map((s, i) => (
            <li
              key={`${s.lat}-${s.lon}-${i}`}
              className={`px-3 py-2 text-sm cursor-pointer ${
                i === activeIndex
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-accent/50"
              }`}
              onMouseDown={() => handleSelect(s)}
              onMouseEnter={() => setActiveIndex(i)}
            >
              {s.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
