import { useMemo, useRef, useState, useEffect } from "react";
import { Ban, CheckCircle2, Plus, Search, Tag, X } from "lucide-react";

interface EmployeeExcludedCategoriesSelectorProps {
  excludedCategories: string[];
  availableCategories: string[];
  onChange: (nextExcluded: string[]) => void;
  disabled?: boolean;
}

export const EmployeeExcludedCategoriesSelector = ({
  excludedCategories = [],
  availableCategories = [],
  onChange,
  disabled = false,
}: EmployeeExcludedCategoriesSelectorProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Normalizar conjunto de categorías excluidas en minúsculas para búsquedas rápidas
  const excludedSet = useMemo(
    () => new Set(excludedCategories.map((c) => c.trim().toLowerCase())),
    [excludedCategories]
  );

  // Cerrar dropdown al hacer clic fuera del contenedor
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Filtrar sugerencias disponibles según la búsqueda
  const suggestions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];

    return availableCategories
      .filter((cat) => {
        const norm = cat.trim().toLowerCase();
        return !excludedSet.has(norm) && norm.includes(q);
      })
      .slice(0, 10);
  }, [searchQuery, availableCategories, excludedSet]);

  const handleAddCategory = (categoryName: string) => {
    if (disabled) return;
    const trimmed = categoryName.trim();
    if (!trimmed) return;

    if (!excludedSet.has(trimmed.toLowerCase())) {
      onChange([...excludedCategories, trimmed]);
    }
    setSearchQuery("");
    setIsOpen(false);
  };

  const handleRemoveCategory = (categoryName: string) => {
    if (disabled) return;
    const norm = categoryName.trim().toLowerCase();
    const nextList = excludedCategories.filter((c) => c.trim().toLowerCase() !== norm);
    onChange(nextList);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const q = searchQuery.trim();
      if (!q) return;

      // Si hay una sugerencia exacta o primera sugerencia, usarla
      if (suggestions.length > 0) {
        handleAddCategory(suggestions[0]);
      } else {
        // Permitir agregar categoría personalizada escrita por el usuario
        handleAddCategory(q);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setSearchQuery("");
    }
  };

  const trimmedQuery = searchQuery.trim();
  const isExactSuggestion = suggestions.some(
    (s) => s.toLowerCase() === trimmedQuery.toLowerCase()
  );
  const showCustomOption =
    trimmedQuery.length > 0 &&
    !excludedSet.has(trimmedQuery.toLowerCase()) &&
    !isExactSuggestion;

  return (
    <div className="space-y-3">
      {/* Encabezado y Contador */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Ban size={15} className="text-rose-600 dark:text-rose-400" />
          <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">
            Categorías Excluidas del Descuento
          </h3>
          {excludedCategories.length > 0 ? (
            <span className="rounded-full bg-rose-100 dark:bg-rose-950 px-2 py-0.5 text-[10px] font-bold text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
              {excludedCategories.length} {excludedCategories.length === 1 ? "excluida" : "excluidas"}
            </span>
          ) : (
            <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-400">
              0 excluidas
            </span>
          )}
        </div>
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        Los productos pertenecientes a estas categorías se cobrarán a precio normal, sin aplicar el descuento de empleado.
      </p>

      {/* Buscador inteligente de categorías a excluir */}
      {!disabled && (
        <div ref={containerRef} className="relative max-w-md">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsOpen(true);
              }}
              onFocus={() => {
                if (searchQuery.trim().length > 0) setIsOpen(true);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Buscar categoría para excluir..."
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              data-lpignore="true"
              className="w-full h-8 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 pl-8 pr-7 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-1 focus:ring-indigo-500/20 outline-none transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setIsOpen(false);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 cursor-pointer"
                title="Limpiar búsqueda"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Menú desplegable de sugerencias */}
          {isOpen && trimmedQuery.length > 0 && (
            <div className="absolute left-0 top-full mt-1 z-30 w-full max-h-56 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl py-1 text-xs animate-in fade-in zoom-in-95">
              {suggestions.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => handleAddCategory(cat)}
                  className="w-full text-left px-3 py-1.5 flex items-center justify-between text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Tag size={12} className="text-slate-400" />
                    <span className="font-medium">{cat}</span>
                  </div>
                  <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 flex items-center gap-0.5">
                    <Plus size={11} /> Excluir
                  </span>
                </button>
              ))}

              {/* Opción para agregar categoría personalizada si no está en catálogo o no coincide */}
              {showCustomOption && (
                <button
                  type="button"
                  onClick={() => handleAddCategory(trimmedQuery)}
                  className="w-full text-left px-3 py-2 flex items-center justify-between text-indigo-700 dark:text-indigo-300 bg-indigo-50/60 dark:bg-indigo-950/40 hover:bg-indigo-100/80 dark:hover:bg-indigo-900/60 border-t border-slate-100 dark:border-slate-800 transition cursor-pointer font-semibold"
                >
                  <div className="flex items-center gap-2">
                    <Plus size={13} />
                    <span>Excluir &quot;{trimmedQuery}&quot;</span>
                  </div>
                  <span className="text-[10px] opacity-75 font-normal">(Personalizada)</span>
                </button>
              )}

              {suggestions.length === 0 && !showCustomOption && (
                <div className="px-3 py-2 text-center text-slate-400 dark:text-slate-500 text-[11px]">
                  Esta categoría ya está excluida o no coincide.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Lista de categorías seleccionadas (SOLO las excluidas) */}
      <div className="pt-1">
        {excludedCategories.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {excludedCategories.map((cat) => (
              <span
                key={cat}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold bg-rose-50 dark:bg-rose-950/70 text-rose-900 dark:text-rose-200 border border-rose-300 dark:border-rose-800 shadow-2xs select-none"
              >
                <Ban size={12} className="text-rose-600 dark:text-rose-400 shrink-0" />
                <span>{cat}</span>
                <span className="text-[10px] font-bold text-rose-700 dark:text-rose-400 opacity-80">
                  (Sin desc.)
                </span>
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => handleRemoveCategory(cat)}
                    className="ml-1 p-0.5 rounded-md hover:bg-rose-200/80 dark:hover:bg-rose-900/80 text-rose-700 dark:text-rose-300 transition cursor-pointer"
                    title={`Quitar ${cat} de las exclusiones`}
                  >
                    <X size={12} />
                  </button>
                )}
              </span>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-dashed border-slate-200 dark:border-slate-800 p-3 text-xs text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-900/20">
            <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
            <span>
              No hay categorías excluidas. El porcentaje de descuento aplica a <strong>todos los productos</strong> del comercio.
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
