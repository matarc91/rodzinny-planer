import { useState, useMemo } from 'react';
import {
  ShoppingCart,
  Plus,
  Check,
  Trash2,
  Filter,
  Tag,
} from 'lucide-react';
import { COLORS, SHOPPING_CATEGORIES, uid } from '../utils/constants.js';
import { Chip } from '../components/ui/Chip.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';

// Słownik automatycznego wykrywania kategorii na podstawie słów kluczowych
const KEYWORD_CATEGORY_MAP = {
  produce: ['jabłk', 'banan', 'pomidor', 'ogórek', 'ziemniak', 'marchew', 'cebul', 'czosnek', 'sałat', 'owoc', 'warzyw', 'cytryn', 'mandarynk', 'pomarańcz', 'truskawk', 'borówk', 'papryk', 'brokuł', 'kalafior', 'pieczark'],
  dairy: ['mleko', 'ser', 'masło', 'jogurt', 'kefir', 'śmietan', 'twaróg', 'jajka', 'jaja', 'mozzarella', 'parmezan', 'serek'],
  bakery: ['chleb', 'bułk', 'bagietk', 'rogal', 'drożdżówk', 'pieczywo', 'chałk', 'chlebek', 'tost'],
  meat: ['kurczak', 'mięso', 'schab', 'szynk', 'kiełbas', 'parówk', 'wołowin', 'wieprzowin', 'indyck', 'filet', 'ryb', 'łosoś', 'dorsz', 'mielon'],
  pantry: ['makaron', 'ryż', 'mąk', 'cukier', 'sól', 'olej', 'oliw', 'kasza', 'płatk', 'sos', 'ketchup', 'musztard', 'herbata', 'kawa', 'przypraw', 'konserw', 'tuńczyk', 'przecier'],
  drinks: ['woda', 'sok', 'cola', 'pepsi', 'napój', 'oranżad', 'piwo', 'wino', 'syrop'],
  frozen: ['lody', 'mrożonk', 'pizza mrożon', 'frytki', 'mrożon', 'paluszk'],
  household: ['papier', 'proszek', 'płyn', 'mydło', 'pasta', 'szampon', 'żel', 'ręcznik', 'chusteczk', 'tabletki do zmywark', 'gąbk', 'worki', 'chemia'],
};

function detectCategory(name) {
  const lower = name.toLowerCase();
  for (const [catId, keywords] of Object.entries(KEYWORD_CATEGORY_MAP)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return catId;
    }
  }
  return 'other';
}

export function ShoppingView({
  shopping = [],
  people = [],
  currentUserId,
  onUpdateShopping,
  showToast,
}) {
  const [newItemText, setNewItemText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null); // null = auto
  const [activeCategoryFilter, setActiveCategoryFilter] = useState('all');
  const [viewFilter, setViewFilter] = useState('active'); // 'active' | 'completed' | 'all'
  const [quantityText, setQuantityText] = useState('');

  // Auto-kategoria wyliczana podczas pisania
  const autoCategory = useMemo(() => {
    if (!newItemText.trim()) return 'other';
    return detectCategory(newItemText);
  }, [newItemText]);

  const effectiveCategory = selectedCategory || autoCategory;

  const pendingItems = useMemo(
    () => shopping.filter((item) => !item.isCompleted),
    [shopping]
  );
  const completedItems = useMemo(
    () => shopping.filter((item) => item.isCompleted),
    [shopping]
  );

  const handleAddItem = (e) => {
    e?.preventDefault();
    const text = newItemText.trim();
    if (!text) return;

    const newItem = {
      id: uid('shop'),
      text,
      category: effectiveCategory,
      quantity: quantityText.trim() || null,
      isCompleted: false,
      personId: currentUserId || null,
      createdAt: new Date().toISOString(),
    };

    onUpdateShopping([newItem, ...shopping]);
    setNewItemText('');
    setSelectedCategory(null);
    setQuantityText('');
    showToast?.('Dodano do listy zakupów! 🛒');
  };

  const toggleItem = (itemId) => {
    const updated = shopping.map((item) => {
      if (item.id === itemId) {
        const nextCompleted = !item.isCompleted;
        return {
          ...item,
          isCompleted: nextCompleted,
          completedAt: nextCompleted ? new Date().toISOString() : null,
        };
      }
      return item;
    });
    onUpdateShopping(updated);
  };

  const deleteItem = (itemId) => {
    const updated = shopping.filter((item) => item.id !== itemId);
    onUpdateShopping(updated);
    showToast?.('Usunięto pozycję z listy');
  };

  const clearCompleted = () => {
    if (completedItems.length === 0) return;
    if (!confirm(`Czy na pewno chcesz usunąć ${completedItems.length} kupionych pozycji?`)) return;
    const updated = shopping.filter((item) => !item.isCompleted);
    onUpdateShopping(updated);
    showToast?.('Wyczyszczono kupione produkty 🧹');
  };

  // Filtrowanie listy
  const displayedItems = useMemo(() => {
    return shopping.filter((item) => {
      // Filtr stanu (do kupienia / kupione / wszystkie)
      if (viewFilter === 'active' && item.isCompleted) return false;
      if (viewFilter === 'completed' && !item.isCompleted) return false;

      // Filtr kategorii
      if (activeCategoryFilter !== 'all' && item.category !== activeCategoryFilter) {
        return false;
      }
      return true;
    });
  }, [shopping, viewFilter, activeCategoryFilter]);

  // Grupowanie wyświetlanych pozycji po kategoriach
  const groupedItems = useMemo(() => {
    const map = new Map();
    SHOPPING_CATEGORIES.forEach((cat) => map.set(cat.id, []));

    displayedItems.forEach((item) => {
      const catId = item.category || 'other';
      if (!map.has(catId)) map.set(catId, []);
      map.get(catId).push(item);
    });

    return Array.from(map.entries())
      .map(([catId, items]) => {
        const catInfo = SHOPPING_CATEGORIES.find((c) => c.id === catId) || {
          id: catId,
          name: 'Inne',
          icon: '🛒',
          color: '#A0A0AB',
        };
        return {
          category: catInfo,
          items,
        };
      })
      .filter((group) => group.items.length > 0);
  }, [displayedItems]);

  return (
    <div className="space-y-4 animate-fadeIn pb-8">
      {/* 1. NAGŁÓWEK I PODSUMOWANIE */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 style={{ fontFamily: 'Fraunces', color: COLORS.ink }} className="text-2xl font-bold flex items-center gap-2">
            <span>Lista Zakupów</span>
          </h2>
          <p className="text-xs text-stone-400 mt-0.5">Wspólne zakupy rodziny w czasie rzeczywistym</p>
        </div>

        {completedItems.length > 0 && (
          <button
            type="button"
            onClick={clearCompleted}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-stone-800/80 hover:bg-stone-800 text-stone-300 border border-stone-700/80 transition flex items-center gap-1.5 active:scale-95 shadow-xs"
          >
            <Trash2 size={13} className="text-rose-400" />
            <span>Wyczyść kupione ({completedItems.length})</span>
          </button>
        )}
      </div>

      {/* 2. FORMULARZ SZYBKIEGO DODAWANIA */}
      <form
        onSubmit={handleAddItem}
        style={{ background: COLORS.surface, borderColor: COLORS.border }}
        className="border rounded-2xl p-3.5 sm:p-4 shadow-sm space-y-3"
      >
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={newItemText}
              onChange={(e) => setNewItemText(e.target.value)}
              placeholder="Co kupić? (np. Mleko, Masło, Pomidory, Chleb...)"
              className="w-full border border-stone-700 rounded-xl pl-3.5 pr-10 py-2.5 text-sm bg-stone-900 text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-500/80 focus:ring-2 focus:ring-amber-500/20 transition"
            />
            {newItemText && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-base pointer-events-none" title={`Kategoria: ${SHOPPING_CATEGORIES.find(c => c.id === effectiveCategory)?.name}`}>
                {SHOPPING_CATEGORIES.find((c) => c.id === effectiveCategory)?.icon || '🛒'}
              </span>
            )}
          </div>

          <input
            type="text"
            value={quantityText}
            onChange={(e) => setQuantityText(e.target.value)}
            placeholder="Ilość (np. 2 szt, 1 kg)"
            className="w-28 sm:w-36 border border-stone-700 rounded-xl px-3 py-2.5 text-sm bg-stone-900 text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-500/80 focus:ring-2 focus:ring-amber-500/20 transition"
          />

          <button
            type="submit"
            disabled={!newItemText.trim()}
            style={{ background: COLORS.accent, color: '#121214' }}
            className="px-4 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition disabled:opacity-40 active:scale-95 shadow-sm shrink-0"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Dodaj</span>
          </button>
        </div>

        {/* Szybki wybór kategorii */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar pt-0.5">
          <span className="text-[11px] text-stone-500 font-medium shrink-0 mr-1 flex items-center gap-1">
            <Tag size={11} /> Kategoria:
          </span>
          {SHOPPING_CATEGORIES.map((cat) => {
            const isSelected = effectiveCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                style={{
                  background: isSelected ? `${cat.color}22` : 'transparent',
                  borderColor: isSelected ? cat.color : '#33333C',
                  color: isSelected ? cat.color : '#A0A0AB',
                }}
                className={`px-2.5 py-1 rounded-full border text-[11px] font-medium flex items-center gap-1 shrink-0 transition ${
                  isSelected ? 'font-bold' : 'hover:border-stone-600'
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.name}</span>
              </button>
            );
          })}
        </div>
      </form>

      {/* 3. FILTRY WIDOKU I KATEGORII */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          {/* Przełącznik: Do kupienia / Kupione / Wszystkie */}
          <div
            style={{ background: COLORS.surfaceHighlight, borderColor: COLORS.border }}
            className="flex p-1 rounded-xl border text-xs font-semibold gap-1"
          >
            <button
              type="button"
              onClick={() => setViewFilter('active')}
              style={{
                background: viewFilter === 'active' ? COLORS.accent : 'transparent',
                color: viewFilter === 'active' ? '#121214' : COLORS.inkSoft,
              }}
              className="px-3 py-1.5 rounded-lg transition"
            >
              Do kupienia ({pendingItems.length})
            </button>
            <button
              type="button"
              onClick={() => setViewFilter('completed')}
              style={{
                background: viewFilter === 'completed' ? COLORS.accent : 'transparent',
                color: viewFilter === 'completed' ? '#121214' : COLORS.inkSoft,
              }}
              className="px-3 py-1.5 rounded-lg transition"
            >
              W koszyku ({completedItems.length})
            </button>
            <button
              type="button"
              onClick={() => setViewFilter('all')}
              style={{
                background: viewFilter === 'all' ? COLORS.accent : 'transparent',
                color: viewFilter === 'all' ? '#121214' : COLORS.inkSoft,
              }}
              className="px-3 py-1.5 rounded-lg transition"
            >
              Wszystkie ({shopping.length})
            </button>
          </div>

          {/* Szybkie filtrowanie działu */}
          {SHOPPING_CATEGORIES.length > 0 && (
            <div className="flex items-center gap-1 text-xs text-stone-400">
              <Filter size={13} className="text-amber-400" />
              <select
                value={activeCategoryFilter}
                onChange={(e) => setActiveCategoryFilter(e.target.value)}
                className="bg-stone-900 border border-stone-700 rounded-xl px-2.5 py-1.5 text-xs text-stone-200 focus:outline-none"
              >
                <option value="all">Wszystkie działy</option>
                {SHOPPING_CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icon} {cat.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* 4. LISTA PRODUKTÓW ZGRUPOWANA PO KATEGORIACH */}
      {groupedItems.length === 0 ? (
        <EmptyState
          text={
            viewFilter === 'completed'
              ? 'Koszyk jest pusty'
              : pendingItems.length === 0 && shopping.length > 0
              ? 'Wszystko kupione! Brawo 🎉'
              : 'Lista zakupów jest pusta'
          }
          icon={ShoppingCart}
        />
      ) : (
        <div className="space-y-4">
          {groupedItems.map(({ category, items }) => (
            <div
              key={category.id}
              style={{ background: COLORS.surface, borderColor: COLORS.border }}
              className="border rounded-2xl p-4 shadow-sm space-y-2.5"
            >
              {/* Belka kategorii */}
              <div className="flex items-center justify-between pb-1.5 border-b border-stone-800">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{category.icon}</span>
                  <span className="text-sm font-bold text-stone-100">{category.name}</span>
                </div>
                <span className="text-xs font-mono text-stone-400 bg-stone-900 px-2 py-0.5 rounded-full border border-stone-800">
                  {items.length} {items.length === 1 ? 'poz.' : 'poz.'}
                </span>
              </div>

              {/* Pozycje w kategorii */}
              <div className="space-y-2">
                {items.map((item) => {
                  const author = people.find((p) => p.id === item.personId);
                  const isDone = item.isCompleted;

                  return (
                    <div
                      key={item.id}
                      onClick={() => toggleItem(item.id)}
                      style={{
                        background: isDone ? '#18181B' : COLORS.surfaceHighlight,
                        borderColor: isDone ? '#27272A' : COLORS.border,
                      }}
                      className={`border rounded-xl p-3 flex items-center gap-3 transition cursor-pointer select-none group ${
                        isDone ? 'opacity-55' : 'hover:border-stone-600'
                      }`}
                    >
                      {/* Checkbox */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleItem(item.id);
                        }}
                        style={{
                          borderColor: isDone ? COLORS.success : '#52525B',
                          background: isDone ? COLORS.success : 'transparent',
                        }}
                        className="w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition"
                      >
                        {isDone && <Check size={14} color="#fff" strokeWidth={3.5} />}
                      </button>

                      {/* Nazwa i ilość */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-sm font-medium transition ${
                              isDone ? 'line-through text-stone-500' : 'text-stone-100 font-semibold'
                            }`}
                          >
                            {item.text}
                          </span>
                          {item.quantity && (
                            <span className="text-xs font-mono bg-stone-800 text-amber-300 px-2 py-0.5 rounded-md border border-stone-700">
                              {item.quantity}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Osoba dodająca */}
                      {author && (
                        <div className="shrink-0 flex items-center gap-1 text-[11px] text-stone-400">
                          <Chip person={author} size="sm" />
                        </div>
                      )}

                      {/* Usunięcie pozycji */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteItem(item.id);
                        }}
                        className="p-1.5 text-stone-500 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition"
                        title="Usuń z listy"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ShoppingView;
