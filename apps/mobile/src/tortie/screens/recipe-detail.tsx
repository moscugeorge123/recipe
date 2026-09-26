import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BlurView } from 'expo-blur';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ScrollView,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import {
  useAddCollectionRecipe,
  useCollections,
  useRemoveCollectionRecipe,
  useSetCollectionMembership,
} from '@/features/collections/hooks';
import {
  useCreateMealPlanEntry,
  useMealPlan,
} from '@/features/meal-plan/hooks';
import { mondayOfWeek } from '@/features/meal-plan/types';
import { daysOfWeek, localTodayIso } from '@/features/meal-plan/week';
import { useRecipeNutrition } from '@/features/nutrition/hooks';
import {
  collectionKeys,
  mealPlanKeys,
  recipeKeys,
} from '@/features/query-keys';
import { deleteRecipe } from '@/features/recipes/api';
import {
  useAddFromRecipe,
  useShoppingList,
} from '@/features/shopping-list/hooks';
import { useCook } from '@/tortie/cook-store';
import { collName } from '@/tortie/data/cookbook';
import { collectionMembership } from '@/tortie/data/selection';
import { useMotion } from '@/tortie/motion';
import { useServings } from '@/tortie/data/recipe-ui';
import { fmtQ, useTRecipe } from '@/tortie/data/recipes';
import { useFrame } from '@/tortie/frame';
import { DAYNAMES, fmtT, plz } from '@/tortie/lib/fmt';
import { afterMotion, toast, useNav } from '@/tortie/nav-store';
import { C, CSS_EASE, EASE, F, SH, SPRING } from '@/tortie/theme';
import { tw } from '@/tortie/ui/anim';
import { Grabber, Segmented } from '@/tortie/ui/controls';
import { Glyph } from '@/tortie/ui/icon';
import { Photo } from '@/tortie/ui/photo';
import { Press } from '@/tortie/ui/press';
import { Sheet } from '@/tortie/ui/sheet';
import { em, sans, serif, T } from '@/tortie/ui/text';

const FROST = 'rgba(248,250,245,.92)';

/** Nutrition row values (prototype NUTR fallback: "—" / "not calculated"). */
function useNutritionLine(id: string | null) {
  const q = useRecipeNutrition(id ?? undefined);
  const d = q.data;
  const ok = d && (d.status === 'READY' || d.status === 'PARTIAL');
  const p = ok ? d.perPortion?.calories : undefined;
  const h = ok ? d.per100g?.calories : undefined;
  return {
    kcalP: p != null ? Math.round(p) + ' kcal' : '—',
    kcal100: h != null ? Math.round(h) + ' kcal' : '—',
    portionG:
      p != null && h
        ? '≈' + Math.round((p / h) * 100) + ' g'
        : 'not calculated',
  };
}

const qtyOf = (q: number | null, u: string, scale: number) =>
  q ? fmtQ(q * scale) + (u ? ' ' + u : '') : u || '';

export function RecipeDetail() {
  const id = useNav((s) => s.detailId);
  const nonce = useNav((s) => s.detailNonce);
  const f = useFrame();
  const { width } = useWindowDimensions();
  const { r } = useTRecipe(id);
  const nutr = useNutritionLine(id);
  const [serv, setServ] = useServings(id, r?.base ?? 2);
  const resuming = useCook(
    (s) => s.activeOn && !!s.active && s.active.id === id,
  );
  const [seg, setSeg] = useState<0 | 1>(0);
  const [scr, setScr] = useState(false);
  const ref = useRef<ScrollView>(null);
  const [seenNonce, setSeenNonce] = useState(nonce);
  if (nonce !== seenNonce) {
    setSeenNonce(nonce);
    setSeg(0);
    setScr(false);
  }

  useEffect(() => {
    ref.current?.scrollTo({ y: 0, animated: false });
  }, [nonce]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const v = e.nativeEvent.contentOffset.y > 250;
    if (v !== scr) setScr(v);
  };

  const track = useAnimatedStyle(() => ({
    transform: [{ translateX: tw(seg ? -width : 0, 460, EASE) }],
  }));
  const o0 = useAnimatedStyle(() => ({
    opacity: tw(seg ? 0 : 1, 300, CSS_EASE),
  }));
  const o1 = useAnimatedStyle(() => ({
    opacity: tw(seg ? 1 : 0, 300, CSS_EASE),
  }));
  const hdr = useAnimatedStyle(() => ({
    opacity: tw(scr ? 1 : 0, 220, CSS_EASE),
  }));
  const hdrT = useAnimatedStyle(() => ({
    transform: [{ translateY: tw(scr ? 0 : 6, 220, CSS_EASE) }],
  }));

  if (!id) return null;
  const hue = r?.hue ?? 0;
  const scale = serv / (r?.base ?? serv);
  const barPad = Math.max(30, f.bottom);
  const topBarH = f.pushTop + 54;

  const cook = () => {
    useCook.getState().begin(id);
    useNav.getState().openCook(id);
  };

  return (
    <>
      <ScrollView
        ref={ref}
        style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}
        contentContainerStyle={{ paddingBottom: 120 + barPad - 30 }}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={onScroll}
      >
        <Photo
          hue={hue}
          uri={r?.uri}
          caption={r ? 'photo · ' + r.photo : undefined}
          captionSize={11}
          captionStyle={{ left: 20, bottom: 46 }}
          style={{ height: 370 }}
        />
        <View
          style={{
            marginTop: -30,
            backgroundColor: C.bg,
            borderTopLeftRadius: 30,
            borderTopRightRadius: 30,
            paddingTop: 24,
            paddingHorizontal: 20,
          }}
        >
          {r?.tag ? (
            <View
              style={{
                alignSelf: 'flex-start',
                backgroundColor: C.greenSoft,
                paddingVertical: 5,
                paddingHorizontal: 12,
                borderRadius: 99,
              }}
            >
              <T style={sans(12, 700, C.green)}>{r.tag}</T>
            </View>
          ) : null}
          <T
            style={serif(31, 500, C.ink, {
              lineHeight: 34.72,
              letterSpacing: em(31, -0.02),
              marginTop: 12,
            })}
          >
            {r?.title ?? ''}
          </T>
          {r?.desc ? (
            <T
              style={{
                fontFamily: F.serif400i,
                fontSize: 17,
                lineHeight: 25.5,
                color: C.ink2,
                marginTop: 10,
              }}
            >
              {r.desc}
            </T>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
            <MetaTile
              icon="schedule"
              color={C.green}
              label="Total time"
              value={r && r.time > 0 ? fmtT(r.time) : '—'}
            />
            <MetaTile
              icon="skillet"
              color={C.terra}
              label="Level"
              value={r?.level ?? '—'}
            />
            <MetaTile
              icon="format_list_numbered"
              color={C.green}
              label="Steps"
              value={String(r?.steps.length || r?.stepCount || 0)}
            />
          </View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              marginTop: 10,
              paddingVertical: 12,
              paddingHorizontal: 16,
              backgroundColor: C.surface2,
              borderRadius: 16,
              boxShadow: SH.hairline,
            }}
          >
            <Glyph name="local_fire_department" size={20} color={C.terra} />
            <View
              style={{ flex: 1, minWidth: 0, flexDirection: 'row', gap: 12 }}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <T style={sans(11, 400, C.ink2)}>
                  Per portion · {nutr.portionG}
                </T>
                <T style={sans(16, 700)}>{nutr.kcalP}</T>
              </View>
              <View
                style={{
                  flex: 1,
                  gap: 2,
                  borderLeftWidth: 1,
                  borderLeftColor: C.line,
                  paddingLeft: 12,
                }}
              >
                <T style={sans(11, 400, C.ink2)}>Per 100 g</T>
                <T style={sans(16, 700)}>{nutr.kcal100}</T>
              </View>
            </View>
          </View>
          <Segmented
            style={{ marginTop: 24 }}
            height={40}
            index={seg}
            items={[
              { label: 'Ingredients', onPress: () => setSeg(0) },
              { label: 'Method', onPress: () => setSeg(1) },
            ]}
          />
          <View style={{ overflow: 'hidden', marginHorizontal: -20 }}>
            <Animated.View
              style={[
                {
                  flexDirection: 'row',
                  width: width * 2,
                  alignItems: 'flex-start',
                },
                track,
              ]}
            >
              <Animated.View style={[{ width, paddingHorizontal: 20 }, o0]}>
                <View style={{ paddingTop: 18, paddingBottom: 8 }}>
                  <T
                    style={sans(14, 600, C.ink2)}
                  >{`${r?.ings.length ?? 0} ingredients`}</T>
                </View>
                {r?.ings.map((x, i) => (
                  <View
                    key={i}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 14,
                      paddingVertical: 12,
                      borderBottomWidth: 1,
                      borderBottomColor: C.line,
                    }}
                  >
                    <View
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 10,
                        backgroundColor: x.tint,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <T style={{ fontSize: 18, textAlign: 'center' }}>
                        {x.emo}
                      </T>
                    </View>
                    <View
                      style={{
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'flex-start',
                      }}
                    >
                      <T
                        style={sans(15, 700, C.ink, {
                          lineHeight: 21,
                          minWidth: 64,
                        })}
                      >
                        {qtyOf(x.q, x.u, scale)}
                      </T>
                      <T
                        style={sans(15, 400, C.ink, {
                          lineHeight: 21,
                          flex: 1,
                        })}
                      >
                        {x.n}
                      </T>
                    </View>
                  </View>
                ))}
              </Animated.View>
              <Animated.View
                style={[{ width, paddingTop: 8, paddingHorizontal: 20 }, o1]}
              >
                {r?.steps.map((st, i) => (
                  <View
                    key={i}
                    style={{
                      flexDirection: 'row',
                      gap: 14,
                      padding: 16,
                      marginTop: 8,
                      backgroundColor: C.surface2,
                      borderRadius: 16,
                      boxShadow: SH.hairline,
                    }}
                  >
                    <View
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        backgroundColor: i === 0 ? C.terraBright : C.line,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <T style={sans(15, 700, i === 0 ? C.terraInk2 : C.ink)}>
                        {String(i + 1)}
                      </T>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          gap: 8,
                        }}
                      >
                        <T
                          style={sans(15, 700, C.ink, {
                            lineHeight: 20.25,
                            flexShrink: 1,
                          })}
                        >
                          {st.t}
                        </T>
                        {st.m > 0 ? (
                          <View
                            style={{
                              backgroundColor: C.terraSoft,
                              paddingVertical: 3,
                              paddingHorizontal: 10,
                              borderRadius: 99,
                            }}
                          >
                            <T style={sans(11, 700, C.terra)}>{fmtT(st.m)}</T>
                          </View>
                        ) : null}
                      </View>
                      {st.d ? (
                        <T
                          style={sans(14, 400, C.ink2, {
                            lineHeight: 21.7,
                            marginTop: 4,
                          })}
                        >
                          {st.d}
                        </T>
                      ) : null}
                    </View>
                  </View>
                ))}
              </Animated.View>
            </Animated.View>
          </View>
        </View>
      </ScrollView>

      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: topBarH,
            overflow: 'hidden',
            boxShadow: '0 1px 0 #e1e3de',
            justifyContent: 'flex-end',
            alignItems: 'center',
            paddingLeft: 70,
            paddingRight: 170,
            paddingBottom: 21,
          },
          hdr,
        ]}
      >
        <BlurView
          intensity={30}
          tint="light"
          style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}
        />
        <View
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(248,250,245,.94)',
          }}
        />
        <Animated.Text
          allowFontScaling={false}
          numberOfLines={1}
          style={[serif(18, 600), hdrT]}
        >
          {r?.title ?? ''}
        </Animated.Text>
      </Animated.View>

      <FrostButton
        top={f.pushTop}
        left={16}
        onPress={() => useNav.getState().closeRecipe()}
        label="Back"
      >
        <Glyph name="arrow_back" size={24} color={C.ink} />
      </FrostButton>
      <FrostButton
        top={f.pushTop}
        right={66}
        onPress={() => useNav.getState().openEditor(id)}
        label="Edit recipe"
      >
        <Glyph name="edit" size={21} color={C.ink} />
      </FrostButton>
      <FrostButton
        top={f.pushTop}
        right={16}
        onPress={() => useNav.getState().openMenu()}
        label="More actions"
      >
        <Glyph name="more_horiz" size={24} color={C.ink} />
      </FrostButton>

      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingTop: 14,
          paddingHorizontal: 20,
          paddingBottom: barPad,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(248,250,245,0)', C.bg, C.bg]}
          locations={[0, 0.36, 1]}
          style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}
        />
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: C.white,
            borderWidth: 1,
            borderColor: C.line,
            borderRadius: 99,
            padding: 3,
            height: 56,
            boxShadow: '0 8px 20px -14px rgba(36,39,36,.5)',
          }}
        >
          <StepBtn
            icon="remove"
            label="Fewer servings"
            onPress={() => setServ(serv - 1)}
          />
          <View style={{ minWidth: 44, alignItems: 'center' }}>
            <T style={serif(19, 600, C.ink, { lineHeight: 19 })}>
              {String(serv)}
            </T>
            <T style={sans(10, 700, C.ink2, { lineHeight: 10, marginTop: 2 })}>
              servings
            </T>
          </View>
          <StepBtn
            icon="add"
            label="More servings"
            onPress={() => setServ(serv + 1)}
          />
        </View>
        <Press
          onPress={cook}
          scale={0.97}
          ms={220}
          style={{
            flex: 1,
            minWidth: 0,
            height: 56,
            borderRadius: 99,
            backgroundColor: C.terra,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            boxShadow: '0 12px 28px -12px rgba(162,62,24,.7)',
          }}
        >
          <Glyph name="play_arrow" size={22} fill color={C.bg} />
          <T style={sans(16, 700, C.bg)}>
            {resuming ? 'Resume cooking' : 'Start cooking'}
          </T>
        </Press>
      </View>
    </>
  );
}

function MetaTile({
  icon,
  color,
  label,
  value,
}: {
  icon: string;
  color: string;
  label: string;
  value: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        minWidth: 0,
        alignItems: 'center',
        gap: 2,
        paddingVertical: 10,
        paddingHorizontal: 6,
        backgroundColor: C.surface2,
        borderRadius: 16,
        boxShadow: SH.hairline,
      }}
    >
      <Glyph name={icon} size={20} color={color} />
      <T style={sans(11, 400, C.ink2, { textAlign: 'center' })}>{label}</T>
      <T style={sans(16, 700, C.ink, { textAlign: 'center' })}>{value}</T>
    </View>
  );
}

/** 42px frosted round button over the hero (press .9 / 200ms). */
function FrostButton({
  top,
  left,
  right,
  onPress,
  label,
  scale = 0.9,
  children,
}: {
  top: number;
  left?: number;
  right?: number;
  onPress: () => void;
  label: string;
  scale?: number;
  children: ReactNode;
}) {
  return (
    <Press
      onPress={onPress}
      accessibilityLabel={label}
      scale={scale}
      ms={200}
      easing={CSS_EASE}
      style={{
        position: 'absolute',
        top,
        left,
        right,
        width: 42,
        height: 42,
        borderRadius: 21,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <BlurView
        intensity={20}
        tint="light"
        style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}
      />
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          right: 0,
          bottom: 0,
          backgroundColor: FROST,
        }}
      />
      {children}
    </Press>
  );
}

/** 44×48 stepper button with a 50%-radius (elliptical) #f3f4ef fill; press .88 / 180ms. */
function StepBtn({
  icon,
  label,
  onPress,
}: {
  icon: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Press
      onPress={onPress}
      accessibilityLabel={label}
      scale={0.88}
      ms={180}
      easing={CSS_EASE}
      style={{
        width: 44,
        height: 48,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          position: 'absolute',
          top: 2,
          left: 0,
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: C.surface2,
          transform: [{ scaleY: 48 / 44 }],
        }}
      />
      <Glyph name={icon} size={20} color={C.ink} />
    </Press>
  );
}

type MenuItem = {
  icon: string;
  l: string;
  sub: string;
  trail: string;
  ic: string;
  on: () => void;
};

export function RecipeMenuSheet() {
  const f = useFrame();
  const { m } = useMotion();
  const sheetMs = Math.round(520 * m);
  const open = useNav((s) => s.menu);
  const menuV = useNav((s) => s.menuV);
  const menuBulk = useNav((s) => s.menuBulk);
  const sel = useNav((s) => s.sel);
  const id = useNav((s) => s.detailId);
  const [showBulk, setShowBulk] = useState(false);
  if (menuBulk && open && !showBulk) setShowBulk(true);
  useEffect(() => {
    if (open || !showBulk) return;
    const t = setTimeout(() => setShowBulk(false), sheetMs);
    return () => clearTimeout(t);
  }, [open, showBulk, sheetMs]);
  const bulkView = menuBulk || (showBulk && !open);
  const { r } = useTRecipe(id);
  const [serv] = useServings(id, r?.base ?? 2);
  const client = useQueryClient();

  const collections = useCollections();
  const addToColl = useAddCollectionRecipe();
  const removeFromColl = useRemoveCollectionRecipe();
  const setMembership = useSetCollectionMembership();
  const monday = mondayOfWeek(localTodayIso());
  const plan = useMealPlan(monday);
  const createEntry = useCreateMealPlanEntry();
  const shop = useShoppingList();
  const addFromRecipe = useAddFromRecipe();
  const del = useMutation({
    mutationFn: (rid: string) => deleteRecipe(rid),
    onSuccess: (_d, rid) => {
      client.setQueriesData({ queryKey: recipeKeys.all }, (cur: unknown) => {
        if (!cur || typeof cur !== 'object' || !('items' in cur)) return cur;
        const page = cur as { items: { id: string }[] };
        return { ...page, items: page.items.filter((x) => x.id !== rid) };
      });
      for (const key of [recipeKeys.all, collectionKeys.all, mealPlanKeys.all])
        client.invalidateQueries({ queryKey: key }).catch(() => undefined);
      toast('Recipe deleted');
    },
    onError: () => toast('Couldn’t delete that recipe. Try again.'),
  });

  const colls = useMemo(
    () => collections.data?.items ?? [],
    [collections.data],
  );
  const inC = id ? colls.filter((c) => c.recipeIds.includes(id)).length : 0;

  const freeDay = useMemo(() => {
    const days = daysOfWeek(monday);
    const today = (new Date().getDay() + 6) % 7;
    const items = plan.data?.items ?? [];
    for (let i = today; i < 7; i++) {
      const d = days[i]!;
      if (!items.some((e) => e.slot === 'DINNER' && e.date.slice(0, 10) === d))
        return i;
    }
    return null;
  }, [monday, plan.data]);

  const missing = useMemo(() => {
    const groc = (shop.data?.items ?? []).map((g) => g.name.toLowerCase());
    return (r?.ings ?? []).filter((x) => {
      const k = x.n.split(',')[0]!.toLowerCase();
      return !groc.some((g) => g.includes(k) || k.includes(g));
    });
  }, [shop.data, r?.ings]);

  const close = () => useNav.getState().closeMenu();
  if (!id && !menuBulk && !showBulk) return null;
  const selIds = sel ?? [];

  const items: MenuItem[] = [
    {
      icon: 'edit',
      l: 'Edit recipe',
      sub: 'Title, ingredients, steps & photo',
      trail: 'chevron_right',
      ic: C.green,
      on: () => {
        if (!id) return;
        close();
        afterMotion(220, () => useNav.getState().openEditor(id));
      },
    },
    {
      icon: 'library_add',
      l: 'Add to collection',
      sub: inC
        ? 'In ' + inC + ' collection' + (inC > 1 ? 's' : '')
        : 'Not in any collection yet',
      trail: 'chevron_right',
      ic: C.green,
      on: () => useNav.getState().set({ menuV: 'coll' }),
    },
    {
      icon: 'calendar_add_on',
      l: 'Add to meal plan',
      sub:
        freeDay != null
          ? 'Next free dinner · ' + DAYNAMES[freeDay]
          : 'This week’s dinners are full',
      trail: '',
      ic: C.green,
      on: () => {
        if (freeDay == null) {
          toast('No free dinners this week');
          return;
        }
        if (!id) return;
        const date = daysOfWeek(monday)[freeDay]!;
        createEntry.mutate(
          { date, slot: 'DINNER', kind: 'RECIPE', recipeId: id },
          { onError: () => toast('Couldn’t add it to your plan. Try again.') },
        );
        close();
        toast('Planned for ' + DAYNAMES[freeDay] + ' dinner');
      },
    },
    {
      icon: 'add_shopping_cart',
      l: 'Add ingredients to groceries',
      sub: missing.length
        ? missing.length + ' not on your list yet'
        : 'Everything’s already on your list',
      trail: '',
      ic: C.terra,
      on: () => {
        if (!id) return;
        close();
        if (!missing.length) {
          toast('Already on your list');
          return;
        }
        addFromRecipe.mutate(
          { recipeId: id, servings: serv },
          { onError: () => toast('Couldn’t add to groceries. Try again.') },
        );
        toast(missing.length + ' items added to groceries');
      },
    },
    {
      icon: 'ios_share',
      l: 'Share recipe',
      sub: 'Send a link or a printable card',
      trail: '',
      ic: C.green,
      on: () => {
        close();
        Clipboard.setStringAsync(r?.originalUrl || r?.title || '').catch(
          () => undefined,
        );
        toast('Link copied');
      },
    },
  ];

  const nIngs = r ? r.ings.length || r.ingCount : 0;
  const meta = r
    ? fmtT(r.time) + ' · ' + r.level + ' · ' + nIngs + ' ingredients'
    : '';

  return (
    <Sheet open={open} onClose={close} style={{ paddingBottom: f.sheetBottom }}>
      <Grabber />
      {!bulkView && menuV !== 'coll' && id ? (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Photo
              hue={r?.hue ?? 0}
              uri={r?.uri}
              radius={14}
              style={{ width: 52, height: 52 }}
            />
            <View style={{ flex: 1, minWidth: 0 }}>
              <T
                numberOfLines={1}
                style={serif(19, 600, C.ink, { lineHeight: 22.8 })}
              >
                {r?.title ?? ''}
              </T>
              <T style={sans(12, 400, C.ink2, { marginTop: 3 })}>{meta}</T>
            </View>
          </View>
          <View
            style={{
              marginTop: 16,
              backgroundColor: C.white,
              borderWidth: 1,
              borderColor: C.line,
              borderRadius: 18,
              paddingHorizontal: 16,
            }}
          >
            {items.map((it, i) => (
              <Press
                key={it.l}
                onPress={it.on}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 14,
                  paddingVertical: 13,
                  borderBottomWidth: 1,
                  borderBottomColor:
                    i < items.length - 1 ? C.surface3 : 'transparent',
                }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: C.surface2,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Glyph name={it.icon} size={20} color={it.ic} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T style={sans(15, 600)}>{it.l}</T>
                  <T style={sans(12, 400, C.ink2, { marginTop: 2 })}>
                    {it.sub}
                  </T>
                </View>
                {it.trail ? (
                  <Glyph name={it.trail} size={20} color={C.ink3} />
                ) : null}
              </Press>
            ))}
          </View>
          <Press
            onPress={() => {
              if (!id) return;
              useNav.getState().set({
                menu: false,
                menuBulk: false,
                detailOpen: false,
              });
              del.mutate(id);
            }}
            style={{
              marginTop: 10,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 14,
              paddingVertical: 13,
              paddingHorizontal: 16,
              borderWidth: 1,
              borderColor: C.line,
              borderRadius: 18,
              backgroundColor: C.white,
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: C.terraSoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Glyph name="delete" size={20} color={C.terra} />
            </View>
            <T style={sans(15, 600, C.terra, { flex: 1 })}>Delete recipe</T>
          </Press>
        </>
      ) : (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Press
              onPress={() =>
                bulkView
                  ? useNav.getState().closeMenu()
                  : useNav.getState().set({ menuV: 'main' })
              }
              accessibilityLabel="Back"
              scale={0.9}
              easing={CSS_EASE}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: C.line,
                backgroundColor: C.white,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Glyph name="arrow_back" size={22} color={C.ink} />
            </Press>
            <View style={{ flex: 1, minWidth: 0 }}>
              <T
                style={serif(24, 500, C.ink, { letterSpacing: em(24, -0.01) })}
              >
                Add to collection
              </T>
              <T style={sans(12, 400, C.ink2, { marginTop: 1 })}>
                {bulkView
                  ? selIds.length +
                    ' recipe' +
                    (selIds.length === 1 ? '' : 's') +
                    ' selected'
                  : inC
                    ? 'Saved in ' + inC + ' of ' + colls.length
                    : 'Pick one or more'}
              </T>
            </View>
          </View>
          <ScrollView
            style={{
              marginTop: 16,
              maxHeight: 330,
              backgroundColor: C.white,
              borderWidth: 1,
              borderColor: C.line,
              borderRadius: 18,
            }}
            contentContainerStyle={{ paddingHorizontal: 16 }}
            showsVerticalScrollIndicator={false}
          >
            <Press
              onPress={() =>
                useNav.getState().openNewCollection(bulkView ? selIds : id)
              }
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: C.line,
              }}
            >
              <View
                style={{
                  width: 43,
                  height: 43,
                  borderRadius: 12,
                  borderWidth: 1.5,
                  borderStyle: 'dashed',
                  borderColor: C.lineStrong,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Glyph name="add" size={22} color={C.green} />
              </View>
              <T style={sans(15, 700, C.green, { flex: 1 })}>New collection</T>
            </Press>
            {colls.map((c, i) => {
              const member = bulkView
                ? collectionMembership(c.recipeIds, selIds)
                : id && c.recipeIds.includes(id)
                  ? 'on'
                  : 'off';
              const on = member === 'on';
              const partial = member === 'partial';
              const { n, emo } = collName(c);
              const toggleColl = () => {
                if (bulkView) {
                  if (!selIds.length) return;
                  const remove = on
                    ? selIds.filter((rid) => c.recipeIds.includes(rid))
                    : [];
                  const add = on
                    ? []
                    : selIds.filter((rid) => !c.recipeIds.includes(rid));
                  if (!add.length && !remove.length) return;
                  setMembership.mutate(
                    { collectionId: c.id, add, remove },
                    {
                      onError: () =>
                        toast('Couldn’t update that collection. Try again.'),
                    },
                  );
                  return;
                }
                if (!id) return;
                (on ? removeFromColl : addToColl).mutate({
                  collectionId: c.id,
                  recipeId: id,
                });
              };
              return (
                <Press
                  key={c.id}
                  onPress={toggleColl}
                  accessibilityState={{ checked: partial ? 'mixed' : on }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 14,
                    paddingVertical: 12,
                    borderBottomWidth: 1,
                    borderBottomColor:
                      i < colls.length - 1 ? C.surface3 : 'transparent',
                  }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      backgroundColor: C.surface2,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <T style={{ fontSize: 20, textAlign: 'center' }}>
                      {emo || '📁'}
                    </T>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <T style={sans(15, 600)}>{n}</T>
                    <T style={sans(12, 400, C.ink2, { marginTop: 2 })}>
                      {plz(c.recipeIds.length, 'recipe')}
                    </T>
                  </View>
                  <CheckCircle
                    on={on || partial}
                    glyph={partial ? 'remove' : 'check'}
                  />
                </Press>
              );
            })}
          </ScrollView>
          <Press
            onPress={close}
            scale={0.97}
            easing={CSS_EASE}
            style={{
              height: 54,
              marginTop: 16,
              borderRadius: 99,
              backgroundColor: C.green,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <T style={sans(15, 700, C.bg)}>Done</T>
          </Press>
        </>
      )}
    </Sheet>
  );
}

/** 26px round check: fill/border 240ms, check scale 0 → 1 over 360ms SPRING. */
function CheckCircle({
  on,
  glyph = 'check',
}: {
  on: boolean;
  glyph?: 'check' | 'remove';
}) {
  const box = useAnimatedStyle(() => ({
    backgroundColor: tw(on ? C.green : 'rgba(50,83,60,0)', 240, CSS_EASE),
    borderColor: tw(on ? C.green : C.lineStrong, 240, CSS_EASE),
  }));
  const mark = useAnimatedStyle(() => ({
    transform: [{ scale: tw(on ? 1 : 0, 360, SPRING) }],
  }));
  return (
    <Animated.View
      style={[
        {
          width: 26,
          height: 26,
          borderRadius: 13,
          borderWidth: 2,
          alignItems: 'center',
          justifyContent: 'center',
        },
        box,
      ]}
    >
      <Animated.View style={mark}>
        <Glyph name={glyph} size={18} color={C.bg} />
      </Animated.View>
    </Animated.View>
  );
}
