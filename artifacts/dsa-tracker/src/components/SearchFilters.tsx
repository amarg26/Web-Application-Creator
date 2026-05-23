import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";

export type SortOption = "nextRevision" | "confidence" | "name";

export interface FilterState {
  search: string;
  confidence: string;
  platform: string;
  sort: SortOption;
}

interface SearchFiltersProps {
  filters: FilterState;
  setFilters: (filters: FilterState) => void;
}

export function SearchFilters({ filters, setFilters }: SearchFiltersProps) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center py-4" data-testid="search-filters">
      <div className="relative flex-1">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search questions..."
          className="pl-9 bg-card/50 border-border/50"
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          data-testid="input-search"
        />
      </div>
      
      <div className="flex flex-wrap gap-2">
        <Select 
          value={filters.confidence} 
          onValueChange={(val) => setFilters({ ...filters, confidence: val })}
        >
          <SelectTrigger className="w-[140px] bg-card/50 border-border/50" data-testid="select-confidence">
            <SelectValue placeholder="Confidence" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            <SelectItem value="weak">Weak (1-2)</SelectItem>
            <SelectItem value="medium">Medium (3)</SelectItem>
            <SelectItem value="strong">Strong (4-5)</SelectItem>
          </SelectContent>
        </Select>

        <Select 
          value={filters.platform} 
          onValueChange={(val) => setFilters({ ...filters, platform: val })}
        >
          <SelectTrigger className="w-[140px] bg-card/50 border-border/50" data-testid="select-platform">
            <SelectValue placeholder="Platform" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Platforms</SelectItem>
            <SelectItem value="LeetCode">LeetCode</SelectItem>
            <SelectItem value="GFG">GFG</SelectItem>
            <SelectItem value="Codeforces">Codeforces</SelectItem>
            <SelectItem value="Other">Other</SelectItem>
          </SelectContent>
        </Select>

        <Select 
          value={filters.sort} 
          onValueChange={(val: SortOption) => setFilters({ ...filters, sort: val })}
        >
          <SelectTrigger className="w-[160px] bg-card/50 border-border/50" data-testid="select-sort">
            <SelectValue placeholder="Sort By" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="nextRevision">Next Revision</SelectItem>
            <SelectItem value="confidence">Confidence</SelectItem>
            <SelectItem value="name">Name</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
