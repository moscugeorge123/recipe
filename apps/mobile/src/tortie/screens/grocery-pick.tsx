import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, useWindowDimensions, View } from 'react-native';

import {
  useAddShoppingItems,
  useShoppingList,
} from '@/features/shopping-list/hooks';
import { hapticSelection } from '@/lib/haptics';
import { usePlan } from '@/tortie/data/plan';
import {
  defaultGrocerySelection,
  groceryAddsForPick,
  groceryPickGroups,
  groceryPickLines,
  grocerySelectionToast,
} from '@/tortie/data/selection';
import { useFrame } from '@/tortie/frame';
import { emoOf, fmtIngQty, plz } from '@/tortie/lib/fmt';
import { toast, useNav } from '@/tortie/nav-store';
import { C, CSS_EASE } from '@/tortie/theme';
import { Checkbox, Grabber } from '@/tortie/ui/controls';
import { Press } from '@/tortie/ui/press';
import { Sheet, SheetScroll, useSheetPressCommits } from '@/tortie/ui/sheet';
import { sans, serif, T } from '@/tortie/ui/text';

/**
 * Ingredient picker shown before anything is written to the shopping list.
 * Every ingredient starts checked.
 */
export function GroceryPickSheet() {
  const f = useFrame();
  const { height: winH } = useWindowDimensions();
  const open = useNav((s) => s.grocPickOn);
  const pick = useNav((s) => s.grocPick);
  const nonce = useNav((s) => s.grocPickNonce);
  const shop = useShoppingList();
  const addItems = useAddShoppingItems();
  const [selected, setSelected] = useState<string[]>([]);
  const [touched, setTouched] = useState(false);
  const seenNonce = useRef(0);
  const recipes = pick?.recipes ?? [];

  const names = useMemo(
    () => (shop.data?.items ?? []).map((item) => item.name),
    [shop.data],
  );
  const lines = useMemo(
    () => groceryPickLines(recipes, names),
    [recipes, names],
  );
  const groups = useMemo(() => groceryPickGroups(lines), [lines]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const addCount = groceryAddsForPick(lines, selectedSet).length;
  const keptId = useMemo(() => {
    const first = new Map<string, string>();
    for (const line of lines) {
      if (selectedSet.has(line.id) && !first.has(line.key))
        first.set(line.key, line.id);
    }
    return first;
  }, [lines, selectedSet]);
  const allOn =
    lines.length > 0 && lines.every((line) => selectedSet.has(line.id));

  useEffect(() => {
    if (!open) return;
    if (seenNonce.current !== nonce) {
      seenNonce.current = nonce;
      setTouched(false);
      setSelected(defaultGrocerySelection(lines));
      return;
    }
    if (!touched) setSelected(defaultGrocerySelection(lines));
  }, [open, nonce, lines, touched]);

  useEffect(() => {
    if (!open || Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      useNav.getState().closeGroceryPick();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const close = () => useNav.getState().closeGroceryPick();

  const toggle = (id: string) => {
    setTouched(true);
    hapticSelection().catch(() => undefined);
    setSelected((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    );
  };

  const toggleAll = () => {
    setTouched(true);
    hapticSelection().catch(() => undefined);
    setSelected(allOn ? [] : lines.map((line) => line.id));
  };

  const confirm = () => {
    const add = groceryAddsForPick(lines, new Set(selected));
    if (!add.length) return;
    const mark = useNav.getState().grocPick?.markWeekMonday ?? null;
    close();
    if (mark) usePlan.getState().markAdded(mark);
    toast(grocerySelectionToast(add.length));
    addItems.mutate(add, {
      onError: () => toast('Couldn’t add to groceries. Try again.'),
    });
  };

  const subtitle =
    recipes.length === 1
      ? recipes[0]!.title
      : recipes.length > 1
        ? `${plz(recipes.length, 'recipe')} · ${plz(lines.length, 'ingredient')}`
        : '';

  return (
    <Sheet
      open={open}
      onClose={close}
      z={44}
      maxHeight={0.86}
      style={{ paddingTop: 0, paddingHorizontal: 0, paddingBottom: 0 }}
    >
      <View style={{ paddingTop: 10, paddingHorizontal: 20 }}>
        <Grabber />
        <T style={serif(26, 500, C.ink)}>Add to groceries</T>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: 12,
            marginTop: 6,
            marginBottom: 8,
          }}
        >
          <T
            numberOfLines={2}
            style={[sans(14, 400, C.ink2, { lineHeight: 20 }), { flex: 1 }]}
          >
            {subtitle}
          </T>
          {lines.length ? (
            <Press
              onPress={toggleAll}
              hitSlop={8}
              accessibilityLabel={allOn ? 'Deselect all' : 'Select all'}
            >
              <T style={sans(14, 700, C.green)}>
                {allOn ? 'Deselect all' : 'Select all'}
              </T>
            </Press>
          ) : null}
        </View>
      </View>
      <SheetScroll
        style={{
          flexGrow: 0,
          flexShrink: 1,
          maxHeight: Math.max(180, winH * 0.86 - 220 - f.sheetBottom),
        }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8 }}
        showsVerticalScrollIndicator={false}
      >
        {groups.map((group, gi) => (
          <View
            key={group.recipeId}
            style={{ marginTop: gi && recipes.length > 1 ? 18 : 0 }}
          >
            {recipes.length > 1 ? (
              <T
                numberOfLines={1}
                style={[serif(18, 500, C.ink), { marginBottom: 4 }]}
              >
                {group.title}
              </T>
            ) : null}
            {group.lines.map((line) => {
              const on = selectedSet.has(line.id);
              const merged = on && keptId.get(line.key) !== line.id;
              const qty = fmtIngQty(line.quantity, line.unit ?? '');
              const emo = emoOf(line.name);
              return (
                <Press
                  key={line.id}
                  onPress={() => toggle(line.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={line.label}
                  pressedBg={C.surface2}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    paddingVertical: 11,
                    borderBottomWidth: 1,
                    borderBottomColor: C.line,
                  }}
                >
                  <Checkbox checked={on} size={24} iconSize={16} />
                  <View
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      backgroundColor: emo.tint,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <T style={{ fontSize: 18, textAlign: 'center' }}>
                      {emo.emo}
                    </T>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <T
                      style={sans(15, on ? 600 : 400, on ? C.ink : C.ink2, {
                        lineHeight: 21,
                      })}
                    >
                      {line.label}
                    </T>
                    {line.onList ? (
                      <T style={sans(12, 500, C.ink3, { marginTop: 2 })}>
                        On your list
                      </T>
                    ) : merged ? (
                      <T style={sans(12, 500, C.ink3, { marginTop: 2 })}>
                        Combined with another recipe
                      </T>
                    ) : null}
                  </View>
                  {qty ? (
                    <T
                      style={sans(14, 700, on ? C.ink : C.ink3, {
                        lineHeight: 20,
                      })}
                    >
                      {qty}
                    </T>
                  ) : null}
                </Press>
              );
            })}
          </View>
        ))}
      </SheetScroll>
      <View
        style={{
          paddingTop: 12,
          paddingHorizontal: 20,
          paddingBottom: f.sheetBottom,
          borderTopWidth: 1,
          borderTopColor: C.surface3,
        }}
      >
        <ConfirmAdd
          count={addCount}
          label={
            addCount ? `Add ${plz(addCount, 'item')}` : 'Add to groceries'
          }
          onConfirm={confirm}
        />
      </View>
    </Sheet>
  );
}

function ConfirmAdd({
  count,
  label,
  onConfirm,
}: {
  count: number;
  label: string;
  onConfirm: () => void;
}) {
  const commitsPress = useSheetPressCommits();
  return (
    <Press
      onPress={() => {
        if (!commitsPress()) return;
        onConfirm();
      }}
      disabled={count === 0}
      scale={0.97}
      easing={CSS_EASE}
      accessibilityLabel={label}
      style={{
        height: 54,
        borderRadius: 99,
        backgroundColor: C.green,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: count === 0 ? 0.4 : 1,
      }}
    >
      <T style={sans(15, 700, C.bg)}>{label}</T>
    </Press>
  );
}
