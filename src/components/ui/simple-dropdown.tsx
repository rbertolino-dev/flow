import * as React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface SimpleDropdownOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SimpleDropdownProps {
  value?: string;
  onChange: (value: string) => void;
  options: SimpleDropdownOption[];
  placeholder?: string;
  disabled?: boolean;
  searchable?: boolean;
  emptyMessage?: string;
}

export function SimpleDropdown({
  value,
  onChange,
  options,
  placeholder = "Selecione...",
  disabled = false,
  searchable = false,
  emptyMessage = "Nenhuma opção disponível",
}: SimpleDropdownProps) {
  const [open, setOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");

  // Filtrar opções válidas (não vazias)
  const validOptions = React.useMemo(() => {
    return options.filter(
      (opt) =>
        opt.value &&
        typeof opt.value === "string" &&
        opt.value.trim() !== "" &&
        opt.value !== "null" &&
        opt.value !== "undefined"
    );
  }, [options]);

  // Filtrar por busca se searchable
  const filteredOptions = React.useMemo(() => {
    if (!searchable || !searchTerm) return validOptions;
    const term = searchTerm.toLowerCase();
    return validOptions.filter((opt) =>
      opt.label.toLowerCase().includes(term)
    );
  }, [validOptions, searchTerm, searchable]);

  // Encontrar label do valor selecionado
  const selectedOption = React.useMemo(() => {
    if (!value) return null;
    return validOptions.find((opt) => opt.value === value) || null;
  }, [value, validOptions]);

  const handleSelect = (optionValue: string) => {
    if (optionValue && optionValue.trim() !== "") {
      onChange(optionValue);
      setOpen(false);
      setSearchTerm("");
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled}
        >
          <span className="truncate">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        {searchable && (
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <Input
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-9 border-0 focus-visible:ring-0"
            />
          </div>
        )}
        <div className="max-h-[300px] overflow-auto p-1">
          {filteredOptions.length === 0 ? (
            <div className="px-2 py-1.5 text-sm text-muted-foreground text-center">
              {emptyMessage}
            </div>
          ) : (
            filteredOptions.map((option) => {
              const isSelected = value === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  disabled={option.disabled}
                  className={cn(
                    "relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors",
                    "hover:bg-accent hover:text-accent-foreground",
                    "focus:bg-accent focus:text-accent-foreground",
                    "disabled:pointer-events-none disabled:opacity-50",
                    isSelected && "bg-accent text-accent-foreground"
                  )}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      isSelected ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="truncate">{option.label}</span>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}


