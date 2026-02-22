/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import * as React from "react";
import { Check, ChevronsUpDown, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import axios from "axios";
import { logger } from "@/lib/logger";

interface LocationPickerProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function LocationPicker({
  value,
  onChange,
  className,
}: LocationPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [predictions, setPredictions] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (query.length > 2) {
        setLoading(true);
        try {
          const response = await axios.get(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`,
          );
          setPredictions(response.data);
        } catch (error) {
          logger.warn("Failed to fetch locations", {
            error: error instanceof Error ? error.message : String(error),
          });
        } finally {
          setLoading(false);
        }
      } else {
        setPredictions([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
        >
          {value ? (
            <span className="truncate">{value}</span>
          ) : (
            <span className="text-muted-foreground">Select location...</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0 bg-white dark:bg-[#0f172a] border border-gray-200 dark:border-gray-800 shadow-2xl">
        <div className="flex flex-col">
          <div className="flex items-center border-b px-3">
            <MapPin className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Search location..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="max-h-[300px] overflow-y-auto overflow-x-hidden">
            {loading && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Loading...
              </div>
            )}
            {!loading && predictions.length === 0 && query.length > 2 && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                No location found.
              </div>
            )}
            {!loading && predictions.length === 0 && query.length <= 2 && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Type to search...
              </div>
            )}
            {predictions.length > 0 && (
              <ul className="p-1">
                {predictions.map((prediction) => (
                  <li
                    key={prediction.place_id}
                    onClick={() => {
                      onChange(prediction.display_name);
                      setOpen(false);
                    }}
                    className={cn(
                      "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                      value === prediction.display_name &&
                        "bg-accent text-accent-foreground",
                    )}
                  >
                    <MapPin className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                    <span className="truncate">{prediction.display_name}</span>
                    <Check
                      className={cn(
                        "ml-auto h-4 w-4",
                        value === prediction.display_name
                          ? "opacity-100"
                          : "opacity-0",
                      )}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
