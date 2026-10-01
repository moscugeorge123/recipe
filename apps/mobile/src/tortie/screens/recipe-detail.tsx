import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BlurView } from 'expo-blur';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Children,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  ScrollView,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

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
import { daysOfWeek } from '@/features/meal-plan/week';
import {
  collectionKeys,
  mealPlanKeys,
  recipeKeys,
} from '@/features/query-keys';
import { deleteRecipe } from '@/features/recipes/api';
import type { RecipeView } from '@/features/recipes/types';
import { useShoppingList } from '@/features/shopping-list/hooks';
import { useCook } from '@/tortie/cook-store';
import { collName } from '@/tortie/data/cookbook';
import { presentGroceryPick } from '@/tortie/data/grocery-pick';
import {
  isoParts,
  mealSlot,
  mondayAt,
  todayIndex,
  toWeek,
  weekName,
  weekRange,
  type MealKey,
} from '@/tortie/data/plan';
import { collectionMembership } from '@/tortie/data/selection';
import { useMotion } from '@/tortie/motion';
import { useServings } from '@/tortie/data/recipe-ui';
import { ingQty, useTRecipe, useTRecipes } from '@/tortie/data/recipes';
import { useFrame } from '@/tortie/frame';
import { DAYNAMES, fmtT, plz } from '@/tortie/lib/fmt';
import { afterMotion, toast, useNav } from '@/tortie/nav-store';
import { C, CSS_EASE, EASE, F, SH, SPRING } from '@/tortie/theme';
import { tw } from '@/tortie/ui/anim';
import { Grabber, Segmented } from '@/tortie/ui/controls';
import { Glyph } from '@/tortie/ui/icon';
import { Photo } from '@/tortie/ui/photo';
import { Press } from '@/tortie/ui/press';
import { Sheet, SheetScroll } from '@/tortie/ui/sheet';
import { em, sans, serif, T } from '@/tortie/ui/text';

const FROST = 'rgba(248,250,245,.92)';

/**
 * Nutrition row from the extractor (per serving). Per-portion values don't change with the
 * servings stepper, which scales ingredients and portions together.
 */
function nutritionLine(v: RecipeView | undefined) {
  const kcal = v?.calories;
  const m = v?.macros;
  const g = (x: number | null | undefined) =>
    x != null ? String(Math.round(x)) : '—';
  return {
    label:
      v?.nutritionSource === 'estimated' ? 'Per portion · est.' : 'Per portion',
    kcal: kcal != null ? Math.round(kcal) + ' kcal' : '—',
    macros: m
      ? g(m.proteinGrams) +
        ' · ' +
        g(m.carbsGrams) +
        ' · ' +
        g(m.fatGrams) +
        ' g'
      : null,
  };
}

export function RecipeDetail() {
  const id = useNav((s) => s.detailId);
  const nonce = useNav((s) => s.detailNonce);
  const f = useFrame();
  const { width } = useWindowDimensions();
  const { r } = useTRecipe(id);
  const nutr = nutritionLine(r?.view);
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
                <T style={sans(11, 400, C.ink2)} numberOfLines={1}>
                  {nutr.label}
                </T>
                <T style={sans(16, 700)}>{nutr.kcal}</T>
              </View>
              {nutr.macros ? (
                <View
                  style={{
                    flex: 1,
                    gap: 2,
                    borderLeftWidth: 1,
                    borderLeftColor: C.line,
                    paddingLeft: 12,
                  }}
                >
                  <T style={sans(11, 400, C.ink2)} numberOfLines={1}>
                    Protein · Carbs · Fat
                  </T>
                  <T style={sans(16, 700)} numberOfLines={1}>
                    {nutr.macros}
                  </T>
                </View>
              ) : null}
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
                        {ingQty(x, scale)}
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
  const subView = menuV === 'plan' || menuV === 'coll' ? menuV : null;
  const [panel, setPanel] = useState<'plan' | 'coll'>('plan');
  if (subView && panel !== subView) setPanel(subView);
  const { r } = useTRecipe(id);
  const client = useQueryClient();

  const collections = useCollections();
  const shop = useShoppingList();
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
      sub: 'Choose a day',
      trail: 'chevron_right',
      ic: C.green,
      on: () => useNav.getState().set({ menuV: 'plan' }),
    },
    {
      icon: 'add_shopping_cart',
      l: 'Add ingredients to groceries',
      sub: missing.length
        ? missing.length + ' not on your list yet'
        : 'Everything’s already on your list',
      trail: 'chevron_right',
      ic: C.terra,
      on: () => {
        if (!id) return;
        close();
        void presentGroceryPick(client, [id]);
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
      {!bulkView && id ? (
        <MenuSlide page={subView ? 1 : 0} live={open}>
          <View>
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
            >
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
          </View>
          {panel === 'coll' ? (
            <CollectionMenu
              bulk={false}
              recipeId={id}
              selIds={selIds}
              onClose={close}
            />
          ) : (
            <PlanDayMenu
              recipeId={id}
              active={menuV === 'plan'}
              onClose={close}
            />
          )}
        </MenuSlide>
      ) : (
        <CollectionMenu
          bulk={bulkView}
          recipeId={id}
          selIds={selIds}
          onClose={close}
        />
      )}
    </Sheet>
  );
}

function CollectionMenu({
  bulk,
  recipeId,
  selIds,
  onClose,
}: {
  bulk: boolean;
  recipeId: string | null;
  selIds: string[];
  onClose: () => void;
}) {
  const collections = useCollections();
  const addToColl = useAddCollectionRecipe();
  const removeFromColl = useRemoveCollectionRecipe();
  const setMembership = useSetCollectionMembership();
  const colls = collections.data?.items ?? [];
  const inC = recipeId
    ? colls.filter((c) => c.recipeIds.includes(recipeId)).length
    : 0;
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Press
          onPress={() =>
            bulk
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
          <T style={serif(24, 500, C.ink, { letterSpacing: em(24, -0.01) })}>
            Add to collection
          </T>
          <T style={sans(12, 400, C.ink2, { marginTop: 1 })}>
            {bulk
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
      <SheetScroll
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
            useNav.getState().openNewCollection(bulk ? selIds : recipeId)
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
          const member = bulk
            ? collectionMembership(c.recipeIds, selIds)
            : recipeId && c.recipeIds.includes(recipeId)
              ? 'on'
              : 'off';
          const on = member === 'on';
          const partial = member === 'partial';
          const { n, emo } = collName(c);
          const toggleColl = () => {
            if (bulk) {
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
            if (!recipeId) return;
            (on ? removeFromColl : addToColl).mutate({
              collectionId: c.id,
              recipeId,
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
      </SheetScroll>
      <Press
        onPress={onClose}
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
    </View>
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

const weekStep = {
  width: 36,
  height: 36,
  borderRadius: 18,
  borderWidth: 1,
  borderColor: C.line,
  backgroundColor: C.white,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
};

const PLAN_MEALS: [MealKey, string, string][] = [
  ['b', 'Breakfast', 'wb_twilight'],
  ['l', 'Lunch', 'light_mode'],
  ['d', 'Dinner', 'dark_mode'],
];

/** Horizontal push between the recipe menu and a following page. */
function MenuSlide({
  page,
  live,
  children,
}: {
  page: number;
  /** Sheet is open — closed resets snap, so the next open doesn't replay. */
  live: boolean;
  children: ReactNode;
}) {
  const pages = Children.toArray(children);
  const count = pages.length;
  const { m } = useMotion();
  const ms = Math.round(460 * m);
  const [w, setW] = useState(0);
  const [heights, setHeights] = useState<number[]>([]);
  const heightSV = useSharedValue(0);
  const xSV = useSharedValue(0);
  const primed = useRef(false);
  const wasLive = useRef(live);
  const targetH = heights[page] ?? 0;

  const measureW = (value: number) => {
    const next = Math.round(value);
    setW((cur) => (cur === next ? cur : next));
  };
  const measureH = (i: number, value: number) => {
    const next = Math.round(value);
    setHeights((cur) => {
      if (cur[i] === next) return cur;
      const copy = cur.slice();
      copy[i] = next;
      return copy;
    });
  };

  useEffect(() => {
    const instant = !live || !wasLive.current || !primed.current;
    wasLive.current = live;
    if (w > 0) {
      const to = -page * w;
      xSV.value = instant ? to : withTiming(to, { duration: ms, easing: EASE });
    }
    if (targetH <= 0) return;
    primed.current = true;
    heightSV.value = instant
      ? targetH
      : withTiming(targetH, { duration: ms, easing: EASE });
  }, [page, w, targetH, live, ms, xSV, heightSV]);

  const track = useAnimatedStyle(() => ({
    height: heightSV.value > 0 ? heightSV.value : undefined,
    transform: [{ translateX: xSV.value }],
  }));

  return (
    <View
      style={{ overflow: 'hidden' }}
      onLayout={(e) => measureW(e.nativeEvent.layout.width)}
    >
      <Animated.View
        style={[
          {
            flexDirection: 'row',
            width: w > 0 ? w * count : '100%',
            alignItems: 'flex-start',
          },
          track,
        ]}
      >
        {pages.map((child, i) => (
          <View
            key={i}
            pointerEvents={page === i ? 'auto' : 'none'}
            style={{ width: w > 0 ? w : '100%' }}
            onLayout={(e) => measureH(i, e.nativeEvent.layout.height)}
          >
            {child}
          </View>
        ))}
      </Animated.View>
    </View>
  );
}

function TurnChevron({ open }: { open: boolean }) {
  const { m } = useMotion();
  const p = useSharedValue(open ? 1 : 0);
  useEffect(() => {
    p.value = withTiming(open ? 1 : 0, {
      duration: Math.round(320 * m),
      easing: EASE,
    });
  }, [open, m, p]);
  const a = useAnimatedStyle(() => ({
    transform: [{ rotate: `${p.value * 90}deg` }],
  }));
  return (
    <Animated.View style={a}>
      <Glyph name="chevron_right" size={20} color={C.ink3} />
    </Animated.View>
  );
}

/** Week days for “Add to meal plan”. A day expands to breakfast, lunch, dinner. */
function PlanDayMenu({
  recipeId,
  active,
  onClose,
}: {
  recipeId: string;
  active: boolean;
  onClose: () => void;
}) {
  const { m } = useMotion();
  const [wk, setWk] = useState(0);
  const [day, setDay] = useState<number | null>(null);
  const busy = useRef(false);
  const monday = mondayAt(wk);
  const plan = useMealPlan(monday);
  const createEntry = useCreateMealPlanEntry();
  const { list } = useTRecipes();
  const ready = plan.data?.from === monday;
  const week = useMemo(
    () => toWeek(monday, ready ? plan.data?.items : undefined),
    [monday, ready, plan.data?.items],
  );
  const titles = useMemo(() => {
    const map = new Map<string, string>();
    for (const recipe of list) map.set(recipe.id, recipe.title);
    return map;
  }, [list]);
  const dates = daysOfWeek(monday);
  const today = todayIndex();
  const listRef = useRef<ScrollView>(null);
  const rowY = useRef<number[]>([]);
  /** Day waiting to be scrolled into view once the previous expansion collapses. */
  const reveal = useRef<number | null>(null);
  const mealEnter = useMemo(() => FadeIn.duration(Math.round(220 * m)), [m]);

  const scrollToDay = (i: number) => {
    listRef.current?.scrollTo({
      y: Math.max(0, rowY.current[i] ?? 0),
      animated: true,
    });
  };

  const toggleDay = (i: number) => {
    const prev = day;
    const next = prev === i ? null : i;
    setDay(next);
    if (next == null) return;
    // A day above this one is collapsing, so this row's y isn't final yet.
    if (prev != null && prev < next) {
      reveal.current = next;
      return;
    }
    scrollToDay(next);
  };

  useEffect(() => {
    if (active) return;
    const t = setTimeout(() => setDay(null), Math.round(480 * m));
    return () => clearTimeout(t);
  }, [active, m]);

  const shiftWeek = (dir: -1 | 1) => {
    setDay(null);
    setWk((w) => w + dir);
  };

  const back = () => useNav.getState().set({ menuV: 'main' });

  const add = (dayIndex: number, meal: MealKey, label: string) => {
    if (busy.current || !ready) return;
    const existing = week[dayIndex]?.[meal];
    const when =
      DAYNAMES[dayIndex] +
      ' ' +
      label.toLowerCase() +
      (wk === 0 ? '' : ', ' + weekName(wk).toLowerCase());
    if (existing === recipeId) {
      toast('Already planned for ' + when);
      return;
    }
    if (existing) {
      toast(when + ' is already planned');
      return;
    }
    busy.current = true;
    createEntry.mutate(
      {
        date: dates[dayIndex]!,
        slot: mealSlot(meal),
        kind: 'RECIPE',
        recipeId,
      },
      {
        onError: () => toast('Couldn’t add it to your plan. Try again.'),
        onSettled: () => {
          busy.current = false;
        },
      },
    );
    onClose();
    toast('Planned for ' + when);
  };

  return (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Press
          onPress={back}
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
            numberOfLines={1}
            style={serif(24, 500, C.ink, { letterSpacing: em(24, -0.01) })}
          >
            Add to meal plan
          </T>
          <T numberOfLines={1} style={sans(12, 400, C.ink2, { marginTop: 1 })}>
            {weekName(wk) + ' · ' + weekRange(monday)}
          </T>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Press
            onPress={() => shiftWeek(-1)}
            accessibilityLabel="Previous week"
            scale={0.9}
            easing={CSS_EASE}
            style={weekStep}
          >
            <Glyph name="chevron_left" size={22} color={C.ink} />
          </Press>
          <Press
            onPress={() => shiftWeek(1)}
            accessibilityLabel="Next week"
            scale={0.9}
            easing={CSS_EASE}
            style={weekStep}
          >
            <Glyph name="chevron_right" size={22} color={C.ink} />
          </Press>
        </View>
      </View>
      <SheetScroll
        ref={listRef}
        style={{
          marginTop: 16,
          height: 380,
          backgroundColor: C.white,
          borderWidth: 1,
          borderColor: C.line,
          borderRadius: 18,
        }}
        contentContainerStyle={{ paddingHorizontal: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {dates.map((date, i) => {
          const pd = week[i] ?? { b: null, l: null, d: null };
          const free = PLAN_MEALS.filter(([k]) => !pd[k]).map(([, l]) => l);
          const body = !ready
            ? '…'
            : free.length === 3
              ? 'Nothing planned'
              : free.length === 0
                ? 'Day is full'
                : free.join(' · ') + ' open';
          const isToday = wk === 0 && i === today;
          const expanded = day === i;
          return (
            <View
              key={date}
              onLayout={(e) => {
                rowY.current[i] = e.nativeEvent.layout.y;
                if (reveal.current !== i) return;
                reveal.current = null;
                scrollToDay(i);
              }}
              style={{
                borderBottomWidth: 1,
                borderBottomColor:
                  i < dates.length - 1 ? C.surface3 : 'transparent',
              }}
            >
              <Press
                onPress={() => toggleDay(i)}
                accessibilityState={{ expanded }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 14,
                  paddingVertical: 12,
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    backgroundColor: isToday ? C.green : C.surface2,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <T style={sans(15, 700, isToday ? C.bg : C.ink)}>
                    {String(isoParts(date).d)}
                  </T>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T style={sans(15, 600)}>
                    {DAYNAMES[i] + (isToday ? ' · Today' : '')}
                  </T>
                  <T
                    numberOfLines={1}
                    style={sans(12, 400, C.ink2, { marginTop: 2 })}
                  >
                    {body}
                  </T>
                </View>
                <TurnChevron open={expanded} />
              </Press>
              {expanded ? (
                <Animated.View
                  entering={mealEnter}
                  style={{ paddingBottom: 8 }}
                >
                  {PLAN_MEALS.map(([meal, label, icon]) => {
                    const plannedId = ready ? pd[meal] : null;
                    const mine = plannedId === recipeId;
                    const slotSub = !ready
                      ? '…'
                      : plannedId
                        ? (titles.get(plannedId) ?? 'Planned')
                        : 'Open';
                    return (
                      <Press
                        key={meal}
                        onPress={() => add(i, meal, label)}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 12,
                          paddingVertical: 8,
                          paddingLeft: 54,
                        }}
                      >
                        <View
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 10,
                            backgroundColor: C.surface2,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Glyph name={icon} size={18} color={C.green} />
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <T style={sans(14, 600)}>{label}</T>
                          <T
                            numberOfLines={1}
                            style={sans(12, 400, C.ink2, { marginTop: 1 })}
                          >
                            {mine ? 'This recipe' : slotSub}
                          </T>
                        </View>
                        {plannedId ? (
                          <Glyph name="check" size={20} color={C.green} />
                        ) : (
                          <Glyph name="add" size={22} color={C.green} />
                        )}
                      </Press>
                    );
                  })}
                </Animated.View>
              ) : null}
            </View>
          );
        })}
      </SheetScroll>
    </>
  );
}
