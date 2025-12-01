"use client"

import * as React from "react"
import { Check, ChevronsUpDown, MapPin } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import axios from "axios"

interface LocationPickerProps {
  value: string
  onChange: (value: string) => void
  className?: string
}

export function LocationPicker({ value, onChange, className }: LocationPickerProps) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [predictions, setPredictions] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (query.length > 2) {
        setLoading(true)
        try {
          const response = await axios.get(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`
          )
          setPredictions(response.data)
        } catch (error) {
          console.error("Failed to fetch locations", error)
        } finally {
          setLoading(false)
        }
      } else {
        setPredictions([])
      }
    }, 500)

    return () => clearTimeout(delayDebounceFn)
  }, [query])

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
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder="Search location..." 
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {loading && <div className="py-6 text-center text-sm text-muted-foreground">Loading...</div>}
            {!loading && predictions.length === 0 && query.length > 2 && (
              <CommandEmpty>No location found.</CommandEmpty>
            )}
            {!loading && predictions.length === 0 && query.length <= 2 && (
               <div className="py-6 text-center text-sm text-muted-foreground">Type to search...</div>
            )}
            <CommandGroup>
              {predictions.map((prediction) => (
                <CommandItem
                  key={prediction.place_id}
                  value={prediction.place_id.toString()}
                  onSelect={() => {
                    onChange(prediction.display_name)
                    setOpen(false)
                  }}
                  onPointerDown={(e) => {
                    // Prevent default to avoid focus loss which might close the popover before selection
                    e.preventDefault()
                    onChange(prediction.display_name)
                    setOpen(false)
                  }}
                  className="cursor-pointer"
                >
                  <MapPin className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                  <span className="truncate">{prediction.display_name}</span>
                  <Check
                    className={cn(
                      "ml-auto h-4 w-4",
                      value === prediction.display_name ? "opacity-100" : "opacity-0"
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
