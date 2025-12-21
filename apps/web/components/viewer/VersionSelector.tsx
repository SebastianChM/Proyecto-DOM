"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface Version {
  id: string; // URN
  versionNumber: number;
  timestamp: string;
}

interface VersionSelectorProps {
  label: string;
  versions: Version[];
  selectedUrn: string;
  onChange: (urn: string) => void;
  disabled?: boolean;
}

export function VersionSelector({
  label,
  versions,
  selectedUrn,
  onChange,
  disabled,
}: VersionSelectorProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
        {label}
      </span>
      <Select value={selectedUrn} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="w-[180px] h-9 text-xs font-mono border-white/10 bg-white/5">
          <SelectValue placeholder="Select version" />
        </SelectTrigger>
        <SelectContent>
          {versions.map((ver) => (
            <SelectItem key={ver.id} value={ver.id} className="text-xs">
              <span className="font-bold">V{ver.versionNumber}</span>
              <span className="text-muted-foreground ml-2">
                {new Date(ver.timestamp).toLocaleDateString()}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
