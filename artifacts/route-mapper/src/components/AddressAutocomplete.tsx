import { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { MapPin, Loader2 } from "lucide-react";

interface Suggestion {
  displayName: string;
  shortName: string;
  lat: number;
  lng: number;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  "data-testid"?: string;
}

function formatSuggestion(f: any): Suggestion {
  const p = f.properties;
  const parts: string[] = [];
  const shortParts: string[] = [];

  if (p.housenumber && p.street) {
    parts.push(`${p.housenumber} ${p.street}`);
    shortParts.push(`${p.housenumber} ${p.street}`);
  } else if (p.street) {
    parts.push(p.street);
    shortParts.push(p.street);
  } else if (p.name) {
    parts.push(p.name);
    shortParts.push(p.name);
  }

  if (p.city || p.locality) parts.push(p.city ?? p.locality);
  if (p.state) parts.push(p.state);
  if (p.country) parts.push(p.country);

  const shortName = shortParts.length > 0
    ? `${shortParts[0]}, ${p.city ?? p.locality ?? p.state ?? ""}`.trim().replace(/,\s*$/, "")
    : parts.join(", ");

  return {
    displayName: parts.join(", "),
    shortName,
    lat: f.geometry.coordinates[1],
    lng: f.geometry.coordinates[0],
  };
}

export default function AddressAutocomplete({
  value,
  onChange,
  placeholder,
  className,
  "data-testid": testId,
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.trim().length < 3) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setIsLoading(true);
    try {
      const res = await fetch(
        `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=6&lang=en`,
        {
          headers: { "User-Agent": "ShowingsRouteMapper/1.0" },
          signal: abortRef.current.signal,
        }
      );
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      const features = data?.features ?? [];
      const results: Suggestion[] = features
        .filter((f: any) => f.properties?.street || f.properties?.name)
        .slice(0, 5)
        .map(formatSuggestion);
      setSuggestions(results);
      setIsOpen(results.length > 0);
      setActiveIndex(-1);
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setSuggestions([]);
        setIsOpen(false);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    onChange(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(v), 280);
  };

  const selectSuggestion = (suggestion: Suggestion) => {
    onChange(suggestion.displayName);
    setSuggestions([]);
    setIsOpen(false);
    setActiveIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      selectSuggestion(suggestions[activeIndex]);
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setActiveIndex(-1);
    }
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Input
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setIsOpen(true)}
          placeholder={placeholder}
          className={className}
          autoComplete="off"
          data-testid={testId}
        />
        {isLoading && (
          <Loader2
            size={14}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin pointer-events-none"
          />
        )}
      </div>

      {isOpen && suggestions.length > 0 && (
        <ul
          className="absolute z-50 mt-1 w-full bg-popover border border-border rounded-lg shadow-lg overflow-hidden"
          role="listbox"
        >
          {suggestions.map((s, i) => (
            <li
              key={i}
              role="option"
              aria-selected={i === activeIndex}
              onMouseDown={(e) => {
                e.preventDefault();
                selectSuggestion(s);
              }}
              onMouseEnter={() => setActiveIndex(i)}
              className={`flex items-start gap-2.5 px-3 py-2.5 cursor-pointer text-sm transition-colors ${
                i === activeIndex
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent hover:text-accent-foreground"
              }`}
              data-testid={`suggestion-item-${i}`}
            >
              <MapPin
                size={14}
                className={`mt-0.5 shrink-0 ${i === activeIndex ? "text-primary-foreground/80" : "text-primary"}`}
              />
              <div className="min-w-0">
                <div className="font-medium truncate">{s.shortName}</div>
                <div
                  className={`text-xs truncate ${
                    i === activeIndex ? "text-primary-foreground/70" : "text-muted-foreground"
                  }`}
                >
                  {s.displayName}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
