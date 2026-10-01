import { LinearGradient } from 'expo-linear-gradient';
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type RefObject,
} from 'react';
import {
  Keyboard,
  Platform,
  ScrollView,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type TextInput,
  type TextStyle,
} from 'react-native';
import {
  Gesture,
  GestureDetector,
  type NativeGesture,
} from 'react-native-gesture-handler';
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { useRecipe } from '@/features/recipes/hooks/use-recipe';
import {
  useCategories,
  useSaveRecipe,
} from '@/features/recipes/hooks/use-recipe-editor';
import { ApiError } from '@/services/api-client';
import { tint } from '@/tortie/color';
import {
  AI_CHIPS,
  LEVELS,
  SUGG,
  blankDraft,
  diffCount,
  isBlank,
  makeDraft,
  registerEditorClose,
  toRecipePatch,
  uid,
  type Draft,
  type EdIng,
  type EdStep,
} from '@/tortie/data/editor-draft';
import { useRecipeUi } from '@/tortie/data/recipe-ui';
import { useTRecipe } from '@/tortie/data/recipes';
import { useFrame } from '@/tortie/frame';
import {
  AHUE,
  detectMin,
  fmtT,
  hasKey,
  ingKeys,
  lexOf,
  parseIng,
  qTxt,
} from '@/tortie/lib/fmt';
import { useMotion } from '@/tortie/motion';
import { toast, useNav } from '@/tortie/nav-store';
import { C, CSS_EASE, EASE, F, SH } from '@/tortie/theme';
import { tw, useOpenProgress, useSlideUp } from '@/tortie/ui/anim';
import { Glyph } from '@/tortie/ui/icon';
import { Input, KeyboardScroll } from '@/tortie/ui/input';
import { useKeyboard, useKeyboardLift } from '@/tortie/ui/keyboard';
import { Orb, ShimmerText } from '@/tortie/ui/keyframes';
import { Photo } from '@/tortie/ui/photo';
import { Press } from '@/tortie/ui/press';
import { em, sans, serif, T } from '@/tortie/ui/text';

const PH = '#a9a9a9';
const HANDLE = '#a9afa8';
const NO_OUTLINE: TextStyle = Platform.OS === 'web' ? { outlineWidth: 0 } : {};
const AInput = Animated.createAnimatedComponent(Input);

type St = {
  ed: Draft;
  ed0: Draft;
  hist: Draft[];
  confirm: boolean;
  aiQ: string;
  aiBusy: boolean;
  aiFocus: boolean;
  fresh: Record<string, true>;
  starterOff: boolean;
};

const initSt = (ed: Draft): St => ({
  ed,
  ed0: ed,
  hist: [],
  confirm: false,
  aiQ: '',
  aiBusy: false,
  aiFocus: false,
  fresh: {},
  starterOff: false,
});

type ListKey = 'ings' | 'steps';
type DragSV = {
  list: SharedValue<number>;
  from: SharedValue<number>;
  to: SharedValue<number>;
  dy: SharedValue<number>;
  h: SharedValue<number>;
  snap: SharedValue<number>;
};
type DragApi = {
  start: (l: ListKey, i: number, y: number) => void;
  move: (y: number) => void;
  end: () => void;
};
const LIST_ID: Record<ListKey, number> = { ings: 1, steps: 2 };

const wait = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));

export function RecipeEditor() {
  const open = useNav((s) => s.edit);
  const mode = useNav((s) => s.editMode);
  const editId = useNav((s) => s.editId);
  const nonce = useNav((s) => s.editNonce);
  const { r, view } = useTRecipe(mode === 'edit' ? editId : null);
  const q = useRecipe(mode === 'edit' ? (editId ?? undefined) : undefined);
  // Never draft from the list preview (no ingredients/steps) or a previous recipe's placeholder.
  const detailOk =
    !!editId &&
    r?.id === editId &&
    (editId.startsWith('seed:')
      ? !!q.data
      : q.isSuccess && !q.isPlaceholderData);
  const { m, reduced } = useMotion();
  const f = useFrame();
  const saveM = useSaveRecipe(editId ?? '');
  const cats = useCategories({ enabled: open && mode === 'edit' });

  const [s, setS] = useState<St>(() => initSt(blankDraft()));
  const [seen, setSeen] = useState(nonce);
  const [ready, setReady] = useState(true);
  if (nonce !== seen) {
    setSeen(nonce);
    const d =
      mode === 'new'
        ? blankDraft()
        : r && detailOk
          ? makeDraft(r)
          : { ...blankDraft(), isNew: false, id: editId, ings: [], steps: [] };
    setS(initSt(d));
    setReady(mode === 'new' || detailOk);
  } else if (!ready && r && mode === 'edit' && detailOk) {
    setReady(true);
    setS(initSt(makeDraft(r)));
  }

  const { ed, ed0 } = s;
  const n = diffCount(ed, ed0);
  const isN = ed.isNew;
  const bl = isN && isBlank(ed);

  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(0);
  const viewH = useRef(0);
  const contentH = useRef(0);
  const inputs = useRef(new Map<string, TextInput | null>());
  const runId = useRef(0);
  const freshTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    runId.current++;
    scrollY.current = 0;
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [nonce]);
  useEffect(() => () => freshTimers.current.forEach(clearTimeout), []);

  const upEd = (fn: (d: Draft) => Draft, snap?: boolean) =>
    setS((st) => {
      const next = fn(st.ed);
      return snap
        ? { ...st, ed: next, hist: [...st.hist.slice(-40), st.ed] }
        : { ...st, ed: next };
    });
  const snap = () =>
    setS((st) =>
      st.hist[st.hist.length - 1] === st.ed
        ? st
        : { ...st, hist: [...st.hist.slice(-40), st.ed] },
    );
  const undo = () =>
    setS((st) => {
      const h = [...st.hist];
      let next = st.ed;
      while (h.length) {
        const p = h.pop()!;
        if (p !== st.ed) {
          next = p;
          break;
        }
      }
      return { ...st, ed: next, hist: h };
    });
  const fresh = (keys: string[]) => {
    if (!keys.length) return;
    setS((st) => {
      const fr = { ...st.fresh };
      keys.forEach((k) => (fr[k] = true));
      return { ...st, fresh: fr };
    });
    freshTimers.current.push(
      setTimeout(
        () =>
          setS((st) => {
            const fr = { ...st.fresh };
            keys.forEach((k) => delete fr[k]);
            return { ...st, fresh: fr };
          }),
        1700,
      ),
    );
  };
  const focusKey = (k: string) =>
    requestAnimationFrame(() => {
      inputs.current.get(k)?.focus();
    });

  const close = () => {
    setS((st) => ({ ...st, confirm: false }));
    useNav.getState().closeEditor();
  };
  const cancel = () => {
    if (n && !s.confirm) {
      setS((st) => ({ ...st, confirm: true }));
      return;
    }
    close();
  };
  const cancelRef = useRef(cancel);
  useEffect(() => {
    if (!open) return;
    registerEditorClose(() => cancelRef.current());
    return () => registerEditorClose(null);
  }, [open]);

  const save = () => {
    if (!n) {
      close();
      return;
    }
    if (ed.isNew) {
      toast('Saving new recipes isn’t available yet');
      return;
    }
    if (!view || !editId || !ready) {
      toast('Still loading this recipe — try again in a moment');
      return;
    }
    if (saveM.isPending) return;
    const cat =
      cats.data?.find((c) => c.isDefault)?.id ?? cats.data?.[0]?.id ?? null;
    const res = toRecipePatch(ed, ed0, view, cat);
    if ('error' in res) {
      toast(res.error);
      return;
    }
    saveM.mutate(res.body, {
      onSuccess: () => {
        useRecipeUi.setState((u) => {
          const serv = { ...u.serv };
          delete serv[editId];
          return { serv };
        });
        close();
        toast('Saved · ' + n + ' change' + (n > 1 ? 's' : ''));
      },
      onError: (e) => {
        if (e instanceof ApiError && e.status === 409)
          toast('This recipe changed elsewhere — reopen it to edit');
        else toast('Couldn’t save your changes. Try again.');
      },
    });
  };

  // Ingredients
  const setIngTxt = (i: number, v: string) => {
    const cur = ed.ings[i];
    if (!cur) return;
    if (v.includes('\n')) {
      const old = cur.txt;
      const kept = !!old && v.startsWith(old);
      const pasted = kept ? v.slice(old.length) : v;
      const lines = pasted
        .split(/\r?\n/)
        .map((l) => l.replace(/^[\s•*·-]*\d+[.)]\s+|^[\s•*·-]+/, '').trim())
        .filter(Boolean);
      if (lines.length >= 2) {
        const rows = lines.map((l) => ({ k: 'n' + uid(), txt: l }));
        upEd((d) => {
          const c = d.ings[i];
          const keep = kept && c && c.txt.trim() ? [c] : [];
          return {
            ...d,
            ings: [
              ...d.ings.slice(0, i),
              ...keep,
              ...rows,
              ...d.ings.slice(i + 1),
            ],
          };
        }, true);
        fresh(rows.map((x) => x.k));
        toast('Added ' + rows.length + ' ingredients');
        return;
      }
      v = v.replace(/\r?\n/g, ' ');
    }
    upEd((d) => ({
      ...d,
      ings: d.ings.map((y, j) => (j === i ? { ...y, txt: v } : y)),
    }));
  };
  const ingEnter = (i: number) => {
    const k = 'n' + uid();
    upEd(
      (d) => ({
        ...d,
        ings: [
          ...d.ings.slice(0, i + 1),
          { k, txt: '' },
          ...d.ings.slice(i + 1),
        ],
      }),
      true,
    );
    focusKey('i:' + k);
  };
  const ingBackspace = (i: number) => {
    if (ed.ings[i]?.txt || ed.ings.length <= 1) return;
    const prevK = (i === 0 ? ed.ings[1] : ed.ings[i - 1])?.k;
    upEd((d) => ({ ...d, ings: d.ings.filter((_, j) => j !== i) }));
    if (prevK) focusKey('i:' + prevK);
  };
  const rmIng = (i: number) =>
    upEd((d) => {
      const ings = d.ings.filter((_, j) => j !== i);
      return { ...d, ings: ings.length ? ings : [{ k: 'n' + uid(), txt: '' }] };
    }, true);
  const addIng = () => {
    const k = 'n' + uid();
    upEd((d) => ({ ...d, ings: [...d.ings, { k, txt: '' }] }), true);
    focusKey('i:' + k);
  };
  const addSugg = (nm: string) => {
    const k = 'n' + uid();
    upEd(
      (d) => ({
        ...d,
        ings: [...d.ings.filter((x) => x.txt.trim()), { k, txt: nm }],
      }),
      true,
    );
    fresh([k]);
    toast('Added ' + nm + ' to ingredients');
  };

  // Steps
  const stepText = (i: number, fld: 't' | 'd', v: string) =>
    upEd((d) => ({
      ...d,
      steps: d.steps.map((y, j) => {
        if (j !== i) return y;
        const z: EdStep = { ...y, [fld]: v };
        const det = detectMin(z.t + ' ' + z.d);
        if (det !== y.det) {
          z.det = det;
          if (det != null) {
            z.m = det;
            z.auto = true;
          }
        }
        return z;
      }),
    }));
  const rmStep = (i: number) => {
    upEd((d) => ({ ...d, steps: d.steps.filter((_, j) => j !== i) }), true);
    toast('Step removed — undo to bring it back');
  };
  const stepTimer = (i: number, dir: -1 | 0 | 1) =>
    upEd(
      (d) => ({
        ...d,
        steps: d.steps.map((y, j) => {
          if (j !== i) return y;
          const mm = y.m || 0;
          const nm =
            dir === 0
              ? 5
              : Math.max(
                  0,
                  mm + dir * (mm > 10 || (mm === 10 && dir > 0) ? 5 : 1),
                );
          return { ...y, m: nm, auto: false };
        }),
      }),
      true,
    );
  const addStep = () => {
    const k = 'n' + uid();
    upEd(
      (d) => ({
        ...d,
        steps: [...d.steps, { k, t: '', d: '', m: 0, auto: false, det: null }],
      }),
      true,
    );
    focusKey('s:' + k);
  };

  // Drag to reorder
  const [drag, setDrag] = useState<{ list: ListKey; from: number } | null>(
    null,
  );
  const [dropTick, setDropTick] = useState(0);
  const rafs = useRef<number[]>([]);
  const dList = useSharedValue(0);
  const dFrom = useSharedValue(-1);
  const dTo = useSharedValue(-1);
  const dDy = useSharedValue(0);
  const dH = useSharedValue(0);
  const dSnap = useSharedValue(0);
  const sv = useMemo<DragSV>(
    () => ({ list: dList, from: dFrom, to: dTo, dy: dDy, h: dH, snap: dSnap }),
    [dList, dFrom, dTo, dDy, dH, dSnap],
  );
  const lay = useRef<Record<ListKey, Record<string, { y: number; h: number }>>>(
    { ings: {}, steps: {} },
  );
  const dref = useRef<{
    list: ListKey;
    from: number;
    y0: number;
    s0: number;
    cy: number;
    mids: number[];
    top: number;
    bottom: number;
    raf: number | null;
  } | null>(null);
  const edRef = useRef(ed);
  const dragApi = useRef<DragApi>({
    start: () => undefined,
    move: () => undefined,
    end: () => undefined,
  });

  const updDrag = () => {
    const d = dref.current;
    if (!d) return;
    const dy = d.cy - d.y0 + (scrollY.current - d.s0);
    const c = (d.mids[d.from] ?? 0) + dy;
    let t = 0;
    d.mids.forEach((mid, j) => {
      if (j !== d.from && mid < c) t++;
    });
    sv.dy.set(dy);
    sv.to.set(t);
  };

  useLayoutEffect(() => {
    edRef.current = ed;
    cancelRef.current = cancel;
    dragApi.current = {
      start: (list, i, y) => {
        const rows = edRef.current[list];
        if (rows.length < 2 || dref.current) return;
        const ls = rows.map((x) => lay.current[list][x.k] ?? { y: 0, h: 0 });
        const first = ls[0]!;
        const second = ls[1]!;
        const gap = Math.max(0, second.y - first.y - first.h);
        Keyboard.dismiss();
        dref.current = {
          list,
          from: i,
          y0: y,
          s0: scrollY.current,
          cy: y,
          mids: ls.map((l) => l.y + l.h / 2),
          top: 0,
          bottom: 0,
          raf: null,
        };
        (scrollRef.current as unknown as View | null)?.measureInWindow(
          (_x, top, _w, h) => {
            if (dref.current) {
              dref.current.top = top;
              dref.current.bottom = top + h;
            }
          },
        );
        sv.snap.set(0);
        sv.h.set((ls[i]?.h ?? 0) + gap);
        sv.from.set(i);
        sv.to.set(i);
        sv.dy.set(0);
        sv.list.set(LIST_ID[list]);
        setDrag({ list, from: i });
        const loop = () => {
          const d = dref.current;
          if (!d) return;
          const v =
            d.bottom && d.cy > d.bottom - 150
              ? Math.min(14, (d.cy - (d.bottom - 150)) / 5)
              : d.bottom && d.cy < d.top + 50
                ? -Math.min(14, (d.top + 50 - d.cy) / 5)
                : 0;
          if (v) {
            const max = Math.max(0, contentH.current - viewH.current);
            const ny = Math.max(0, Math.min(max, scrollY.current + v));
            if (ny !== scrollY.current) {
              scrollY.current = ny;
              scrollRef.current?.scrollTo({ y: ny, animated: false });
              updDrag();
            }
          }
          d.raf = requestAnimationFrame(loop);
        };
        dref.current.raf = requestAnimationFrame(loop);
      },
      move: (y) => {
        if (!dref.current) return;
        dref.current.cy = y;
        updDrag();
      },
      end: () => {
        const d = dref.current;
        if (!d) return;
        if (d.raf != null) cancelAnimationFrame(d.raf);
        dref.current = null;
        const from = d.from;
        const to = sv.to.get();
        const key = edRef.current[d.list][from]?.k;
        if (from !== to) {
          upEd((dd) => {
            const a = [...dd[d.list]] as (EdIng | EdStep)[];
            const [x] = a.splice(from, 1);
            if (x) a.splice(to, 0, x);
            return { ...dd, [d.list]: a };
          }, true);
        }
        setDrag(null);
        setDropTick((t) => t + 1);
        if (from !== to && key) fresh([key]);
      },
    };
  });
  useLayoutEffect(() => {
    if (!dropTick) return;
    sv.snap.set(1);
    sv.list.set(0);
    sv.dy.set(0);
    sv.from.set(-1);
    const a = requestAnimationFrame(() => {
      const b = requestAnimationFrame(() => sv.snap.set(0));
      rafs.current.push(b);
    });
    rafs.current.push(a);
  }, [dropTick, sv]);
  useEffect(() => {
    const list = rafs.current;
    return () => list.forEach(cancelAnimationFrame);
  }, []);
  const native = useMemo(() => Gesture.Native(), []);

  // Ask Tortie (no AI endpoint: deterministic scaling only)
  const runAI = async (q0?: string) => {
    const q = String(q0 ?? s.aiQ).trim();
    if (!q || s.aiBusy) return;
    const my = runId.current;
    const base = ed;
    setS((st) => ({ ...st, aiBusy: true, aiQ: q }));
    const fct = /\b(halve|half)\b/i.test(q)
      ? 0.5
      : /\b(double|twice)\b/i.test(q)
        ? 2
        : /\btriple\b/i.test(q)
          ? 3
          : 0;
    const draft = base.isNew && isBlank(base);
    let next: Draft | null = null;
    if (draft) await wait(1400);
    else if (fct) {
      await wait(reduced ? 200 : 1100);
      next = {
        ...base,
        base: Math.max(1, Math.round(base.base * fct)),
        ings: base.ings.map((x) => {
          const p = parseIng(x.txt);
          return p.q
            ? {
                ...x,
                txt: [qTxt(Math.round(p.q * fct * 100) / 100), p.u, p.n]
                  .filter(Boolean)
                  .join(' '),
              }
            : x;
        }),
      };
    }
    if (my !== runId.current) return;
    if (!next) {
      setS((st) => ({ ...st, aiBusy: false, aiFocus: false }));
      toast('Tortie couldn’t make that change');
      return;
    }
    const nx = next;
    const ch = [
      ...nx.ings
        .filter((x) => base.ings.find((y) => y.k === x.k)?.txt !== x.txt)
        .map((x) => x.k),
      ...nx.steps
        .filter((x) => {
          const o = base.steps.find((y) => y.k === x.k);
          return !o || o.t !== x.t || o.d !== x.d;
        })
        .map((x) => x.k),
    ];
    setS((st) => ({
      ...st,
      ed: nx,
      hist: [...st.hist.slice(-40), st.ed],
      aiBusy: false,
      aiFocus: false,
      aiQ: '',
    }));
    fresh(ch);
    toast(
      ch.length
        ? 'Tortie changed ' +
            ch.length +
            ' line' +
            (ch.length > 1 ? 's' : '') +
            ' · undo anytime'
        : 'Nothing needed changing',
    );
  };

  // Derived rows
  const ip = ed.ings.map((x) => ({ ...x, p: parseIng(x.txt) }));
  const stx = ed.steps.map((x) => (x.t + ' ' + x.d).toLowerCase());
  const sum = ed.steps.reduce((a, x) => a + (x.m || 0), 0);
  const ni = ed.ings.filter((x) => x.txt.trim()).length;
  const ns = ed.steps.length;
  const hue = r?.hue ?? 95;
  const photoWord = r?.photo ?? 'your dish';
  const status = isN
    ? n
      ? 'Draft · not saved yet'
      : 'Blank recipe'
    : n
      ? n + ' unsaved change' + (n > 1 ? 's' : '')
      : 'No changes yet';
  const barTop = f.pushTop + 58;
  const bottomPad = Math.max(28, f.bottom);

  const p = useOpenProgress(open, Math.round(520 * m));
  const slide = useSlideUp(p);
  const stCol = useAnimatedStyle(() => ({
    color: tw(n ? C.terra : C.ink3, 200, CSS_EASE),
  }));
  const undoA = useAnimatedStyle(() => ({
    opacity: tw(s.hist.length ? 1 : 0.35, 200, CSS_EASE),
  }));
  const saveA = useAnimatedStyle(() => ({
    backgroundColor: tw(n ? C.green : C.line, 250, CSS_EASE),
  }));
  const saveT = useAnimatedStyle(() => ({
    color: tw(n ? C.bg : C.ink3, 250, CSS_EASE),
  }));
  const confirmA = useAnimatedStyle(() => ({
    opacity: tw(s.confirm ? 1 : 0, 200, CSS_EASE),
    transform: [{ translateY: tw(s.confirm ? 0 : -8, 320, EASE) }],
  }));
  const kb = useKeyboard();
  const lift = useKeyboardLift();
  const [askH, setAskH] = useState(0);

  return (
    <Animated.View
      pointerEvents={open ? 'auto' : 'none'}
      onLayout={slide.onLayout}
      style={[
        {
          position: 'absolute',
          left: 0,
          top: 0,
          right: 0,
          bottom: 0,
          zIndex: 45,
          backgroundColor: C.bg,
        },
        slide.style,
      ]}
    >
      <View
        style={{
          zIndex: 3,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingTop: f.pushTop,
          paddingHorizontal: 16,
          paddingBottom: 12,
          backgroundColor: C.bg,
          boxShadow: '0 10px 18px -14px rgba(46,49,46,.25)',
        }}
      >
        <RoundBtn icon="close" label="Close editor" onPress={cancel} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <T style={sans(16, 700)}>{isN ? 'New recipe' : 'Edit recipe'}</T>
          <Animated.Text
            allowFontScaling={false}
            style={[sans(12, 600), { marginTop: 1 }, stCol]}
          >
            {status}
          </Animated.Text>
        </View>
        <RoundBtn
          icon="undo"
          label="Undo"
          onPress={undo}
          animatedStyle={undoA}
        />
        <Press
          onPress={save}
          scale={0.95}
          easing={CSS_EASE}
          animatedStyle={saveA}
          style={{
            height: 42,
            paddingHorizontal: 20,
            borderRadius: 99,
            justifyContent: 'center',
          }}
        >
          <Animated.Text
            allowFontScaling={false}
            style={[sans(14, 700), saveT]}
          >
            Save
          </Animated.Text>
        </Press>
      </View>

      <Animated.View
        pointerEvents={s.confirm ? 'auto' : 'none'}
        style={[
          {
            position: 'absolute',
            top: barTop,
            left: 16,
            right: 16,
            zIndex: 4,
            backgroundColor: C.ink,
            borderRadius: 20,
            paddingVertical: 14,
            paddingRight: 14,
            paddingLeft: 18,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            boxShadow: '0 18px 36px -14px rgba(25,28,25,.5)',
          },
          confirmA,
        ]}
      >
        <T style={sans(14, 600, C.bg, { flex: 1, minWidth: 0 })}>
          {'Discard ' + n + ' change' + (n > 1 ? 's' : '') + '?'}
        </T>
        <Press
          onPress={() => setS((st) => ({ ...st, confirm: false }))}
          style={{
            height: 38,
            paddingHorizontal: 14,
            borderRadius: 99,
            backgroundColor: 'rgba(248,250,245,.14)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <T style={sans(13, 700, C.bg)}>Keep editing</T>
        </Press>
        <Press
          onPress={close}
          style={{
            height: 38,
            paddingHorizontal: 14,
            borderRadius: 99,
            backgroundColor: C.terraBright,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <T style={sans(13, 700, C.terraInk3)}>Discard</T>
        </Press>
      </Animated.View>

      <GestureDetector gesture={native}>
        <KeyboardScroll
          ref={scrollRef}
          bottomObscured={kb.h > 0 ? askH : 0}
          style={{ flex: 1, minHeight: 0 }}
          contentContainerStyle={{
            paddingTop: 16,
            paddingHorizontal: 20,
            paddingBottom: 170,
          }}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!drag}
          onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
            scrollY.current = e.nativeEvent.contentOffset.y;
            if (dref.current) {
              updDrag();
            }
          }}
          onLayout={(e) => (viewH.current = e.nativeEvent.layout.height)}
          onContentSizeChange={(_w, h) => (contentH.current = h)}
        >
          {bl && !s.aiBusy && !s.starterOff ? (
            <Starter
              onClose={() => setS((st) => ({ ...st, starterOff: true }))}
            />
          ) : null}

          <Photo
            hue={hue}
            uri={isN ? null : r?.uri}
            caption={'photo · ' + photoWord}
            captionSize={11}
            captionStyle={{ left: 16, bottom: 16 }}
            radius={24}
            style={{ height: 176 }}
          >
            <Press
              onPress={() => toast('Choose a photo from your library')}
              style={{
                position: 'absolute',
                right: 12,
                bottom: 12,
                height: 36,
                paddingHorizontal: 14,
                borderRadius: 99,
                backgroundColor: 'rgba(248,250,245,.94)',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Glyph name="photo_camera" size={18} color={C.ink} />
              <T style={sans(13, 700)}>{isN ? 'Add photo' : 'Replace'}</T>
            </Press>
          </Photo>

          <UnderlineInput
            value={ed.title}
            onChangeText={(v) => {
              const t = v.replace(/\n/g, '');
              upEd((d) => ({ ...d, title: t }));
            }}
            onFocus={snap}
            placeholder="Recipe name"
            submitBehavior="blurAndSubmit"
            returnKeyType="done"
            style={[
              serif(29, 500, C.ink, {
                lineHeight: 33.35,
                letterSpacing: em(29, -0.02),
              }),
              { marginTop: 14, paddingVertical: 6 },
            ]}
          />
          <UnderlineInput
            value={ed.desc}
            onChangeText={(v) => upEd((d) => ({ ...d, desc: v }))}
            onFocus={snap}
            placeholder="A line about why it’s good"
            style={{
              fontFamily: F.serif400i,
              fontSize: 17,
              lineHeight: 25.5,
              color: C.ink2,
              marginTop: 4,
              paddingVertical: 4,
            }}
          />

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
            <StepperCell
              label="Serves"
              value={String(ed.base)}
              size={16}
              onDown={() =>
                upEd((d) => ({ ...d, base: Math.max(1, d.base - 1) }), true)
              }
              onUp={() =>
                upEd((d) => ({ ...d, base: Math.min(24, d.base + 1) }), true)
              }
              downLabel="Fewer servings"
              upLabel="More servings"
            />
            <StepperCell
              label="Total time"
              value={fmtT(ed.time)}
              size={14}
              onDown={() =>
                upEd(
                  (d) => ({
                    ...d,
                    time: Math.max(5, d.time - (d.time > 60 ? 15 : 5)),
                  }),
                  true,
                )
              }
              onUp={() =>
                upEd(
                  (d) => ({ ...d, time: d.time + (d.time >= 60 ? 15 : 5) }),
                  true,
                )
              }
              downLabel="Less time"
              upLabel="More time"
            />
            <Press
              onPress={() =>
                upEd(
                  (d) => ({
                    ...d,
                    level:
                      LEVELS[(LEVELS.indexOf(d.level) + 1) % LEVELS.length]!,
                  }),
                  true,
                )
              }
              style={{
                flex: 1,
                minWidth: 0,
                backgroundColor: C.surface2,
                borderRadius: 16,
                paddingVertical: 8,
                paddingHorizontal: 6,
                alignItems: 'center',
              }}
            >
              <T style={sans(11, 400, C.ink2)}>Level</T>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 2,
                  height: 30,
                  marginTop: 2,
                }}
              >
                <T style={sans(15, 700)}>{ed.level}</T>
                <Glyph name="unfold_more" size={18} color={C.ink3} />
              </View>
            </Press>
          </View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              marginTop: 10,
            }}
          >
            <Glyph name="timer" size={16} color={C.terra} fill />
            <T style={sans(12, 400, C.ink2, { flex: 1 })}>
              {sum
                ? 'Step timers add up to ' +
                  fmtT(sum) +
                  (sum > ed.time ? ' — more than the total' : '')
                : 'No step timers yet'}
            </T>
            {sum > ed.time ? (
              <Press
                onPress={() => upEd((d) => ({ ...d, time: sum }), true)}
                style={{
                  height: 30,
                  paddingHorizontal: 12,
                  borderWidth: 1.5,
                  borderColor: C.terraSoft,
                  borderRadius: 99,
                  backgroundColor: C.white,
                  justifyContent: 'center',
                }}
              >
                <T style={sans(12, 700, C.terra)}>{'Use ' + fmtT(sum)}</T>
              </Press>
            ) : null}
          </View>

          <SectionHead
            title="Ingredients"
            count={ni + ' item' + (ni === 1 ? '' : 's')}
            mt={28}
          />
          <T style={sans(12, 400, C.ink3, { lineHeight: 18, marginTop: 2 })}>
            Type it how you’d say it — “2 tbsp olive oil”. Return adds a line;
            paste a whole list at once.
          </T>
          <View
            style={{
              marginTop: 12,
              backgroundColor: C.white,
              borderWidth: 1,
              borderColor: C.line,
              borderRadius: 18,
            }}
          >
            {ip.map((x, i) => {
              const nm = x.p.n || x.txt;
              const empty = !x.txt.trim();
              const ks = ingKeys(nm);
              const used = stx
                .map((t, j) => (ks.some((k) => hasKey(t, k)) ? j + 1 : 0))
                .filter(Boolean);
              const L = lexOf(nm);
              return (
                <IngRow
                  key={x.k}
                  k={x.k}
                  j={i}
                  txt={x.txt}
                  emo={empty ? '' : L ? L[1] : '🍽️'}
                  tile={empty ? C.surface2 : tint(AHUE[L ? L[2] : 5]!)}
                  qty={
                    empty
                      ? 'New ingredient'
                      : x.p.q
                        ? qTxt(x.p.q) +
                          (x.p.u ? ' ' + x.p.u : '') +
                          ' · scales with servings'
                        : 'No amount · won’t scale'
                  }
                  use={
                    empty
                      ? ''
                      : used.length
                        ? 'Step ' + used.join(', ')
                        : 'Not in any step'
                  }
                  useCol={used.length ? C.green : C.terra}
                  isFresh={!!s.fresh[x.k]}
                  lifted={drag?.list === 'ings' && drag.from === i}
                  sv={sv}
                  api={dragApi}
                  native={native}
                  inputs={inputs}
                  onLayoutRow={(y, h) => (lay.current.ings[x.k] = { y, h })}
                  onChange={(v) => setIngTxt(i, v)}
                  onEnter={() => ingEnter(i)}
                  onBackspace={() => ingBackspace(i)}
                  onFocus={snap}
                  onRemove={() => rmIng(i)}
                />
              );
            })}
          </View>
          <DashedAdd label="Add ingredient" onPress={addIng} mt={8} />

          <SectionHead
            title="Method"
            count={ns + ' step' + (ns === 1 ? '' : 's')}
            mt={30}
          />
          <T style={sans(12, 400, C.ink3, { lineHeight: 18, marginTop: 2 })}>
            Write “simmer for 10 minutes” and the timer sets itself. Ingredients
            you mention are linked for cook mode.
          </T>
          {ed.steps.map((x, i) => {
            const tx = stx[i] ?? '';
            const links = ip
              .filter(
                (g) =>
                  g.txt.trim() &&
                  ingKeys(g.p.n || g.txt).some((k) => hasKey(tx, k)),
              )
              .map((g) => (g.p.n || g.txt).split(',')[0]!);
            const sugg = SUGG.filter(
              ([, re]) =>
                re.test(tx) && !ip.some((g) => re.test(g.txt.toLowerCase())),
            ).map(([nm]) => nm);
            return (
              <StepRow
                key={x.k}
                st={x}
                j={i}
                links={links}
                sugg={sugg}
                isFresh={!!s.fresh[x.k]}
                lifted={drag?.list === 'steps' && drag.from === i}
                sv={sv}
                api={dragApi}
                native={native}
                inputs={inputs}
                onLayoutRow={(y, h) => (lay.current.steps[x.k] = { y, h })}
                onT={(v) => stepText(i, 't', v)}
                onD={(v) => stepText(i, 'd', v)}
                onFocus={snap}
                onRemove={() => rmStep(i)}
                onTimer={(dir) => stepTimer(i, dir)}
                onSugg={addSugg}
              />
            );
          })}
          <DashedAdd label="Add step" onPress={addStep} mt={10} />
        </KeyboardScroll>
      </GestureDetector>

      <Animated.View
        onLayout={(e) => setAskH(e.nativeEvent.layout.height)}
        style={[
          { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 3 },
          lift,
        ]}
      >
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(248,250,245,0)', C.bg, C.bg]}
          locations={[0, 0.4, 1]}
          style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}
        />
        <View
          style={{
            paddingTop: 28,
            paddingHorizontal: 16,
            paddingBottom: bottomPad + (s.aiFocus ? 24 : 0),
          }}
        >
          <AskBar
            q={s.aiQ}
            busy={s.aiBusy}
            focus={s.aiFocus}
            blank={bl}
            onQ={(v) => setS((st) => ({ ...st, aiQ: v }))}
            onFocus={(v) => setS((st) => ({ ...st, aiFocus: v }))}
            onRun={(q) => {
              runAI(q).catch(() => undefined);
            }}
          />
        </View>
      </Animated.View>
    </Animated.View>
  );
}

function RoundBtn({
  icon,
  label,
  onPress,
  animatedStyle,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  animatedStyle?: ComponentProps<typeof Press>['animatedStyle'];
}) {
  return (
    <Press
      onPress={onPress}
      accessibilityLabel={label}
      scale={0.9}
      easing={CSS_EASE}
      animatedStyle={animatedStyle}
      style={{
        width: 42,
        height: 42,
        borderRadius: 21,
        borderWidth: 1,
        borderColor: C.line,
        backgroundColor: C.white,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Glyph name={icon} size={22} color={C.ink} />
    </Press>
  );
}

function Starter({ onClose }: { onClose: () => void }) {
  return (
    <View
      style={{
        marginBottom: 16,
        padding: 16,
        backgroundColor: C.terraWash,
        borderWidth: 1,
        borderColor: C.terraSoft,
        borderRadius: 24,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            backgroundColor: C.terraSoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Glyph name="auto_awesome" size={20} color={C.terra} fill />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <T style={serif(21, 500, C.ink, { lineHeight: 25.2 })}>
            Start with Tortie
          </T>
          <T style={sans(13, 400, C.ink2, { lineHeight: 19.5, marginTop: 3 })}>
            Describe a dish or paste rough notes below. Tortie drafts the
            ingredients, steps and timers — you edit from there.
          </T>
        </View>
        <Press
          onPress={onClose}
          accessibilityLabel="Dismiss"
          style={{
            width: 32,
            height: 32,
            marginTop: -4,
            marginRight: -4,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Glyph name="close" size={19} color={C.terra} />
        </Press>
      </View>
    </View>
  );
}

function UnderlineInput({
  style,
  onFocus,
  ...rest
}: Omit<ComponentProps<typeof Input>, 'style'> & {
  style: ComponentProps<typeof Input>['style'];
}) {
  const [focused, setFocused] = useState(false);
  return (
    <Input
      {...rest}
      multiline
      scrollEnabled={false}
      allowFontScaling={false}
      placeholderTextColor={PH}
      textAlignVertical="top"
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={() => setFocused(false)}
      style={[
        {
          paddingHorizontal: 0,
          borderBottomWidth: 1.5,
          borderBottomColor: focused ? C.green : 'transparent',
        },
        NO_OUTLINE,
        style,
      ]}
    />
  );
}

function StepperCell({
  label,
  value,
  size,
  onDown,
  onUp,
  downLabel,
  upLabel,
}: {
  label: string;
  value: string;
  size: number;
  onDown: () => void;
  onUp: () => void;
  downLabel: string;
  upLabel: string;
}) {
  const btn = {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: C.white,
    alignItems: 'center',
    justifyContent: 'center',
  } as const;
  return (
    <View
      style={{
        flex: 1,
        minWidth: 0,
        backgroundColor: C.surface2,
        borderRadius: 16,
        paddingVertical: 8,
        paddingHorizontal: 6,
        alignItems: 'center',
      }}
    >
      <T style={sans(11, 400, C.ink2)}>{label}</T>
      <View
        style={{
          alignSelf: 'stretch',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 2,
        }}
      >
        <Press onPress={onDown} accessibilityLabel={downLabel} style={btn}>
          <Glyph name="remove" size={18} color={C.ink} />
        </Press>
        <T numberOfLines={1} style={sans(size, 700)}>
          {value}
        </T>
        <Press onPress={onUp} accessibilityLabel={upLabel} style={btn}>
          <Glyph name="add" size={18} color={C.ink} />
        </Press>
      </View>
    </View>
  );
}

function SectionHead({
  title,
  count,
  mt,
}: {
  title: string;
  count: string;
  mt: number;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        marginTop: mt,
      }}
    >
      <T style={serif(23, 500)}>{title}</T>
      <T style={sans(13, 600, C.ink2)}>{count}</T>
    </View>
  );
}

function DashedAdd({
  label,
  onPress,
  mt,
}: {
  label: string;
  onPress: () => void;
  mt: number;
}) {
  return (
    <Press
      onPress={onPress}
      style={{
        height: 48,
        marginTop: mt,
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: C.lineStrong,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
      }}
    >
      <Glyph name="add" size={20} color={C.green} />
      <T style={sans(14, 700, C.green)}>{label}</T>
    </Press>
  );
}

/** Row offset while another row is dragged: ±(row height + gap) over 240ms EASE; snaps without a transition on drop. */
function useDragRow(listId: number, j: number, sv: DragSV) {
  const off = useSharedValue(0);
  useAnimatedReaction(
    () => {
      if (sv.list.value !== listId) return 0;
      const from = sv.from.value;
      const to = sv.to.value;
      if (j === from) return 0;
      return from < to && j > from && j <= to
        ? -sv.h.value
        : from > to && j >= to && j < from
          ? sv.h.value
          : 0;
    },
    (t, prev) => {
      if (t === prev) return;
      off.value = sv.snap.value
        ? t
        : withTiming(t, { duration: 240, easing: EASE });
    },
    [listId, j],
  );
  return useAnimatedStyle(() => {
    const lifted = sv.list.value === listId && sv.from.value === j;
    return {
      zIndex: lifted ? 5 : 0,
      transform: [
        { translateY: lifted ? sv.dy.value : sv.snap.value ? 0 : off.value },
        { scale: lifted ? 1.02 : 1 },
      ],
    };
  });
}

function useHandle(
  list: ListKey,
  j: number,
  api: RefObject<DragApi>,
  native: NativeGesture,
) {
  return useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .minDistance(0)
        .shouldCancelWhenOutside(false)
        .blocksExternalGesture(native)
        .onBegin((e) => api.current.start(list, j, e.absoluteY))
        .onUpdate((e) => api.current.move(e.absoluteY))
        .onFinalize(() => api.current.end()),
    [list, j, api, native],
  );
}

type RowCommon = {
  j: number;
  isFresh: boolean;
  lifted: boolean;
  sv: DragSV;
  api: RefObject<DragApi>;
  native: NativeGesture;
  inputs: RefObject<Map<string, TextInput | null>>;
  onLayoutRow: (y: number, h: number) => void;
  onFocus: () => void;
  onRemove: () => void;
};

function IngRow({
  k,
  j,
  txt,
  emo,
  tile,
  qty,
  use,
  useCol,
  isFresh,
  lifted,
  sv,
  api,
  native,
  inputs,
  onLayoutRow,
  onChange,
  onEnter,
  onBackspace,
  onFocus,
  onRemove,
}: RowCommon & {
  k: string;
  txt: string;
  emo: string;
  tile: string;
  qty: string;
  use: string;
  useCol: string;
  onChange: (v: string) => void;
  onEnter: () => void;
  onBackspace: () => void;
}) {
  const move = useDragRow(1, j, sv);
  const bg = useAnimatedStyle(() => ({
    backgroundColor: tw(
      lifted ? C.white : isFresh ? C.greenWash : 'rgba(255,255,255,0)',
      600,
      CSS_EASE,
    ),
  }));
  const pan = useHandle('ings', j, api, native);
  const row = useRef<View>(null);
  return (
    <Animated.View
      ref={row}
      onLayout={(e) =>
        onLayoutRow(e.nativeEvent.layout.y, e.nativeEvent.layout.height)
      }
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingVertical: 9,
          paddingHorizontal: 6,
          borderTopWidth: j ? 1 : 0,
          borderTopColor: lifted ? 'transparent' : C.surface3,
          borderRadius: lifted ? 14 : 0,
          boxShadow: lifted ? SH.dragged : undefined,
        },
        bg,
        move,
      ]}
    >
      <GestureDetector gesture={pan}>
        <View
          accessibilityLabel="Drag to reorder"
          style={{
            width: 22,
            height: 40,
            marginRight: -8,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Glyph name="drag_indicator" size={20} color={HANDLE} />
        </View>
      </GestureDetector>
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 11,
          backgroundColor: tile,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <T style={{ fontSize: 18, lineHeight: 22, textAlign: 'center' }}>
          {emo}
        </T>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Input
          ref={(el) => {
            inputs.current.set('i:' + k, el);
          }}
          revealRef={row}
          value={txt}
          onChangeText={onChange}
          onSubmitEditing={onEnter}
          submitBehavior="submit"
          returnKeyType="next"
          onKeyPress={(e) => {
            if (e.nativeEvent.key === 'Backspace' && !txt) onBackspace();
          }}
          onFocus={onFocus}
          multiline
          scrollEnabled={false}
          allowFontScaling={false}
          placeholder="e.g. 2 tbsp olive oil"
          placeholderTextColor={PH}
          style={[
            sans(15, 500),
            { paddingVertical: 2, paddingHorizontal: 0 },
            NO_OUTLINE,
          ]}
        />
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            rowGap: 4,
            columnGap: 8,
            marginTop: 2,
          }}
        >
          <T style={sans(11.5, 600, C.ink3)}>{qty}</T>
          {use ? <T style={sans(11.5, 600, useCol)}>{use}</T> : null}
        </View>
      </View>
      <Press
        onPress={onRemove}
        accessibilityLabel="Remove ingredient"
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Glyph name="close" size={19} color={C.ink3} />
      </Press>
    </Animated.View>
  );
}

function StepRow({
  st,
  j,
  links,
  sugg,
  isFresh,
  lifted,
  sv,
  api,
  native,
  inputs,
  onLayoutRow,
  onT,
  onD,
  onFocus,
  onRemove,
  onTimer,
  onSugg,
}: RowCommon & {
  st: EdStep;
  links: string[];
  sugg: string[];
  onT: (v: string) => void;
  onD: (v: string) => void;
  onTimer: (dir: -1 | 0 | 1) => void;
  onSugg: (nm: string) => void;
}) {
  const move = useDragRow(2, j, sv);
  const box = useAnimatedStyle(() => ({
    backgroundColor: tw(isFresh ? C.greenWash2 : C.white, 600, CSS_EASE),
    borderColor: tw(isFresh ? C.greenSoft2 : C.line, 600, CSS_EASE),
  }));
  const pan = useHandle('steps', j, api, native);
  const card = useRef<View>(null);
  const chip = {
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
  } as const;
  return (
    <Animated.View
      ref={card}
      onLayout={(e) =>
        onLayoutRow(e.nativeEvent.layout.y, e.nativeEvent.layout.height)
      }
      style={[
        {
          flexDirection: 'row',
          gap: 12,
          marginTop: 10,
          padding: 14,
          paddingHorizontal: 12,
          borderWidth: 1,
          borderRadius: 18,
          boxShadow: lifted ? SH.dragged : undefined,
        },
        box,
        move,
      ]}
    >
      <View style={{ alignItems: 'center', gap: 4 }}>
        <View
          style={{
            width: 28,
            height: 28,
            marginTop: 4,
            borderRadius: 14,
            backgroundColor: C.surface2,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <T style={sans(13, 700)}>{String(j + 1)}</T>
        </View>
        <GestureDetector gesture={pan}>
          <View
            accessibilityLabel="Drag to reorder"
            style={{
              width: 32,
              height: 40,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Glyph name="drag_indicator" size={20} color={HANDLE} />
          </View>
        </GestureDetector>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View
          style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 2 }}
        >
          <Input
            ref={(el) => {
              inputs.current.set('s:' + st.k, el);
            }}
            revealRef={card}
            value={st.t}
            onChangeText={onT}
            onFocus={onFocus}
            multiline
            scrollEnabled={false}
            allowFontScaling={false}
            textAlignVertical="top"
            placeholder="Step title"
            placeholderTextColor={PH}
            style={[
              sans(15, 700, C.ink, { lineHeight: 20.25 }),
              {
                flex: 1,
                minWidth: 0,
                paddingVertical: 6,
                paddingHorizontal: 0,
              },
              NO_OUTLINE,
            ]}
          />
          <Press
            onPress={onRemove}
            accessibilityLabel="Delete step"
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Glyph name="delete" size={19} color={C.terra} />
          </Press>
        </View>
        <Input
          value={st.d}
          revealRef={card}
          onChangeText={onD}
          onFocus={onFocus}
          multiline
          scrollEnabled={false}
          allowFontScaling={false}
          textAlignVertical="top"
          placeholder="What to do — mention times and ingredients"
          placeholderTextColor={PH}
          style={[
            sans(14, 400, C.ink2, { lineHeight: 21.7 }),
            { minHeight: 44, paddingVertical: 2, paddingHorizontal: 0 },
            NO_OUTLINE,
          ]}
        />
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 6,
            marginTop: 10,
          }}
        >
          {st.m > 0 ? (
            <View
              style={[
                chip,
                {
                  borderRadius: 99,
                  backgroundColor: C.terraSoft,
                  paddingHorizontal: 2,
                },
              ]}
            >
              <Press
                onPress={() => onTimer(-1)}
                accessibilityLabel="Shorter timer"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Glyph name="remove" size={16} color={C.terra} />
              </Press>
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
              >
                <Glyph name="timer" size={15} color={C.terra} />
                <T style={sans(12, 700, C.terra)}>{fmtT(st.m)}</T>
              </View>
              <Press
                onPress={() => onTimer(1)}
                accessibilityLabel="Longer timer"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Glyph name="add" size={16} color={C.terra} />
              </Press>
            </View>
          ) : null}
          {st.auto && st.m > 0 ? (
            <View style={[chip, { gap: 3 }]}>
              <Glyph name="auto_awesome" size={14} color={C.terra} fill />
              <T style={sans(11, 700, C.terra)}>from your text</T>
            </View>
          ) : null}
          {!(st.m > 0) ? (
            <Press
              onPress={() => onTimer(0)}
              style={[
                chip,
                {
                  paddingHorizontal: 12,
                  borderWidth: 1.5,
                  borderStyle: 'dashed',
                  borderColor: C.lineStrong,
                  borderRadius: 99,
                  gap: 4,
                },
              ]}
            >
              <Glyph name="timer" size={15} color={C.ink2} />
              <T style={sans(12, 700, C.ink2)}>Add timer</T>
            </Press>
          ) : null}
          {links.map((l, i) => (
            <View
              key={'l' + i}
              style={[
                chip,
                {
                  gap: 4,
                  paddingHorizontal: 11,
                  borderRadius: 99,
                  backgroundColor: C.greenWash,
                },
              ]}
            >
              <Glyph name="link" size={14} color={C.green} />
              <T style={sans(12, 600, C.green)}>{l}</T>
            </View>
          ))}
          {sugg.map((nm) => (
            <Press
              key={nm}
              onPress={() => onSugg(nm)}
              style={[
                chip,
                {
                  gap: 4,
                  paddingHorizontal: 11,
                  borderWidth: 1.5,
                  borderStyle: 'dashed',
                  borderColor: C.terraBright,
                  borderRadius: 99,
                  backgroundColor: C.terraWash,
                },
              ]}
            >
              <Glyph name="add" size={15} color={C.terra} />
              <T style={sans(12, 700, C.terra)}>{nm}</T>
            </Press>
          ))}
        </View>
      </View>
    </Animated.View>
  );
}

function AskBar({
  q,
  busy,
  focus,
  blank,
  onQ,
  onFocus,
  onRun,
}: {
  q: string;
  busy: boolean;
  focus: boolean;
  blank: boolean;
  onQ: (v: string) => void;
  onFocus: (v: boolean) => void;
  onRun: (q?: string) => void;
}) {
  const bar = useAnimatedStyle(() => ({
    borderColor: tw(focus || busy ? C.terraBright : C.line, 200, CSS_EASE),
    borderRadius: tw(focus ? 24 : 28, 200, CSS_EASE),
    paddingTop: tw(focus ? 8 : 0, 200, CSS_EASE),
    paddingRight: tw(7, 200, CSS_EASE),
    paddingBottom: tw(focus ? 7 : 0, 200, CSS_EASE),
    paddingLeft: tw(8, 200, CSS_EASE),
  }));
  const field = useAnimatedStyle(() => ({
    minHeight: tw(focus ? 128 : 53, 220, EASE),
  }));
  const send = useAnimatedStyle(() => ({
    opacity: tw(q.trim() ? 1 : 0.4, 200, CSS_EASE),
  }));
  const showChips = focus && !busy && !blank;
  return (
    <>
      {showChips ? (
        <ScrollView
          horizontal
          keyboardShouldPersistTaps="always"
          showsHorizontalScrollIndicator={false}
          style={{ marginHorizontal: -16, marginBottom: 10 }}
          contentContainerStyle={{ gap: 6, paddingHorizontal: 16 }}
        >
          {AI_CHIPS.map((l) => (
            <Press
              key={l}
              onPress={() => onRun(l)}
              style={{
                height: 36,
                paddingHorizontal: 14,
                borderWidth: 1,
                borderColor: C.line,
                borderRadius: 99,
                backgroundColor: C.white,
                justifyContent: 'center',
              }}
            >
              <T numberOfLines={1} style={sans(13, 600)}>
                {l}
              </T>
            </Press>
          ))}
        </ScrollView>
      ) : null}
      <Animated.View
        style={[
          {
            flexDirection: 'row',
            alignItems: focus ? 'flex-end' : 'center',
            gap: 10,
            minHeight: 56,
            backgroundColor: C.white,
            borderWidth: 1.5,
            boxShadow: '0 14px 30px -14px rgba(46,49,46,.35)',
          },
          bar,
        ]}
      >
        {busy ? (
          <>
            <Orb />
            <View style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
              <ShimmerText style={sans(15, 600)}>{q}</ShimmerText>
            </View>
          </>
        ) : (
          <>
            <View
              style={[
                {
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: C.terraWash2,
                  alignItems: 'center',
                  justifyContent: 'center',
                },
                focus ? { position: 'absolute', top: 8, right: 8 } : null,
              ]}
            >
              <Glyph name="auto_awesome" size={20} color={C.terra} fill />
            </View>
            <AInput
              value={q}
              onChangeText={onQ}
              submitBehavior="newline"
              onFocus={() => onFocus(true)}
              onBlur={() => onFocus(false)}
              multiline
              allowFontScaling={false}
              textAlignVertical="top"
              placeholder={
                blank
                  ? 'Describe a dish or paste notes…'
                  : 'Ask Tortie to change something…'
              }
              placeholderTextColor={PH}
              style={[
                sans(15, 400, C.ink, {
                  lineHeight: 21.75,
                  textAlignVertical: 'top',
                }),
                {
                  flex: 1,
                  minWidth: 0,
                  alignSelf: 'stretch',
                  maxHeight: 200,
                  paddingTop: focus ? 8 : 15,
                  paddingBottom: focus ? 8 : 15,
                  paddingLeft: focus ? 10 : 0,
                  paddingRight: 0,
                },
                NO_OUTLINE,
                field,
              ]}
            />
            <Press
              onPress={() => onRun()}
              accessibilityLabel="Apply"
              animatedStyle={send}
              style={{
                width: 42,
                height: 42,
                borderRadius: 21,
                backgroundColor: C.green,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Glyph name="arrow_upward" size={22} color={C.bg} />
            </Press>
          </>
        )}
      </Animated.View>
    </>
  );
}
