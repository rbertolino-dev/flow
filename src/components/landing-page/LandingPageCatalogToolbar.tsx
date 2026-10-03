import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useLandingCatalogFilters } from "@/hooks/useLandingCatalogFilters";
import { LANDING_SORT_OPTIONS } from "@/lib/landingPageCatalogFilters";
import { ArrowUpDown, ChevronDown, LayoutGrid, Search } from "lucide-react";

function OptionRow({
  label,
  selected,
  primaryColor,
  onSelect,
}: {
  label: string;
  selected: boolean;
  primaryColor: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm"
      style={selected ? { backgroundColor: `${primaryColor}18`, color: primaryColor } : undefined}
    >
      <span className={selected ? "font-medium" : "text-gray-800"}>{label}</span>
      <span
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border"
        style={{ borderColor: selected ? primaryColor : "#d1d5db" }}
      >
        {selected && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: primaryColor }} />}
      </span>
    </button>
  );
}

export function LandingPageCatalogToolbar({
  filters,
  primaryColor,
}: {
  filters: ReturnType<typeof useLandingCatalogFilters>;
  primaryColor: string;
}) {
  const [sortOpen, setSortOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [draftCategory, setDraftCategory] = useState<string | null>(filters.category);
  const [categoryQuery, setCategoryQuery] = useState("");

  const visibleCategories = filters.categories.filter((name) =>
    name.toLowerCase().includes(categoryQuery.trim().toLowerCase()),
  );
  const showAll = "todos".includes(categoryQuery.trim().toLowerCase());

  return (
    <section className="sticky top-0 z-30 border-b border-gray-100 bg-white/95 py-3 backdrop-blur">
      <div className="container mx-auto flex flex-col gap-3 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center gap-2">
          <Popover open={sortOpen} onOpenChange={setSortOpen}>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" className="h-10 rounded-full border-gray-200 bg-gray-50 px-4 text-sm font-medium text-gray-800 shadow-none">
                <ArrowUpDown className="h-4 w-4" />
                Ordenar
                <ChevronDown className="h-4 w-4 text-gray-500" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80 rounded-xl p-3">
              <div className="mb-2 flex items-center justify-between px-2">
                <p className="text-sm font-semibold text-gray-900">Ordenar</p>
                <button type="button" className="text-sm text-gray-500" onClick={() => setSortOpen(false)}>
                  Cancelar
                </button>
              </div>
              <div role="radiogroup" aria-label="Ordenar" className="max-h-72 space-y-1 overflow-y-auto">
                {LANDING_SORT_OPTIONS.map((option) => (
                  <OptionRow
                    key={option.id}
                    label={option.label}
                    selected={filters.sort === option.id}
                    primaryColor={primaryColor}
                    onSelect={() => {
                      filters.setSort(option.id);
                      setSortOpen(false);
                    }}
                  />
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {filters.categories.length > 0 && (
            <Popover
              open={categoryOpen}
              onOpenChange={(open) => {
                setCategoryOpen(open);
                if (open) {
                  setDraftCategory(filters.category);
                  setCategoryQuery("");
                }
              }}
            >
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" className="h-10 rounded-full border-gray-200 bg-gray-50 px-4 text-sm font-medium text-gray-800 shadow-none">
                  <LayoutGrid className="h-4 w-4" />
                  {filters.category || "Categorias"}
                  <ChevronDown className="h-4 w-4 text-gray-500" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-80 rounded-xl p-3">
                <div className="mb-2 flex items-center justify-between px-2">
                  <p className="text-sm font-semibold text-gray-900">Categorias</p>
                  <button type="button" className="text-sm text-gray-500" onClick={() => setCategoryOpen(false)}>
                    Cancelar
                  </button>
                </div>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    value={categoryQuery}
                    onChange={(event) => setCategoryQuery(event.target.value)}
                    placeholder="Busque por uma opção"
                    className="h-10 rounded-lg pl-9"
                  />
                </div>
                <div role="radiogroup" aria-label="Categorias" className="max-h-64 space-y-1 overflow-y-auto">
                  {showAll && (
                    <OptionRow
                      label="Todos"
                      selected={draftCategory === null}
                      primaryColor={primaryColor}
                      onSelect={() => setDraftCategory(null)}
                    />
                  )}
                  {visibleCategories.map((name) => (
                    <OptionRow
                      key={name}
                      label={name}
                      selected={draftCategory === name}
                      primaryColor={primaryColor}
                      onSelect={() => setDraftCategory(name)}
                    />
                  ))}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    className="bg-gray-200 text-gray-700 hover:bg-gray-300"
                    onClick={() => {
                      setDraftCategory(null);
                      filters.setCategory(null);
                      setCategoryOpen(false);
                    }}
                  >
                    Remover
                  </Button>
                  <Button
                    type="button"
                    style={{ backgroundColor: primaryColor, color: "white" }}
                    onClick={() => {
                      filters.setCategory(draftCategory);
                      setCategoryOpen(false);
                    }}
                  >
                    Confirmar
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
          {filters.hasFilters && (
            <button type="button" className="shrink-0 text-sm text-gray-500 hover:text-gray-800" onClick={filters.clearAll}>
              Limpar todos
            </button>
          )}
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              value={filters.search}
              onChange={(event) => filters.setSearch(event.target.value)}
              placeholder="O que você está buscando?"
              className="h-10 rounded-full border-gray-200 bg-white pl-9"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
