import { ScrollView, View } from 'react-native';

import { importErrorCopy } from '@/features/extraction/error-groups';
import { importStageLabel } from '@/features/extraction/import-stages';
import {
  brandNameOf,
  historyJobs,
  runningJobs,
  type ImportJob,
} from '@/features/extraction/import-jobs';
import { hueOf } from '@/tortie/color';
import { cancelImport, retryImport } from '@/tortie/data/import-engine';
import { useFrame } from '@/tortie/frame';
import { useImports } from '@/tortie/import-store';
import { afterMotion, toast, useNav } from '@/tortie/nav-store';
import { BASE_D, C, CSS_EASE } from '@/tortie/theme';
import { Glyph } from '@/tortie/ui/icon';
import { ErrorTile } from '@/tortie/ui/import-error';
import { SourceGlyph } from '@/tortie/ui/import-progress';
import { Photo } from '@/tortie/ui/photo';
import { Press } from '@/tortie/ui/press';
import { em, sans, serif, T } from '@/tortie/ui/text';
import { useCountdown } from '@/tortie/ui/use-countdown';

/** Imports: what is importing now, and finished and failed links, newest first. */
export function ImportsScreen() {
  const f = useFrame();
  const jobs = useImports((s) => s.jobs);
  const clearHistory = useImports((s) => s.clearHistory);
  const running = runningJobs(jobs);
  const history = historyJobs(jobs);

  const back = () => useNav.getState().closeImports();
  const pasteLink = () => {
    useNav.getState().closeImports();
    afterMotion(Math.round(BASE_D * 0.6), () => useNav.getState().openAdd());
  };
  const clear = () => {
    clearHistory();
    toast('History cleared');
  };

  return (
    <View style={{ flex: 1 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 44,
          marginTop: f.pushTop,
          paddingHorizontal: 20,
        }}
      >
        <Press
          onPress={back}
          scale={0.9}
          accessibilityLabel="Back"
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
          <Glyph name="arrow_back" size={22} color={C.ink} />
        </Press>
        {history.length ? (
          <Press
            onPress={clear}
            scale={0.95}
            easing={CSS_EASE}
            style={{
              height: 36,
              paddingHorizontal: 8,
              justifyContent: 'center',
            }}
          >
            <T style={sans(14, 600, C.terra)}>Clear history</T>
          </Press>
        ) : null}
      </View>
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: 16,
          paddingHorizontal: 20,
          paddingBottom: 44 + f.bottom,
        }}
      >
        <T style={[serif(30, 500), { letterSpacing: em(30, -0.01) }]}>
          Imports
        </T>
        <T style={[sans(14, 400, C.ink2), { marginTop: 2 }]}>
          Links you’ve sent to Tortie, newest first.
        </T>

        <SectionLabel>In progress</SectionLabel>
        {running.length ? (
          <View style={{ gap: 10 }}>
            {running.map((j) => (
              <RunningRow key={j.id} job={j} />
            ))}
          </View>
        ) : (
          <View style={card({ alignItems: 'center', paddingVertical: 24 })}>
            <T style={sans(15, 600)}>Nothing importing right now</T>
            <Press
              onPress={pasteLink}
              scale={0.96}
              easing={CSS_EASE}
              style={{
                height: 40,
                marginTop: 12,
                paddingHorizontal: 18,
                borderRadius: 99,
                backgroundColor: C.green,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Glyph name="link" size={18} color={C.bg} />
              <T style={sans(14, 700, C.bg)}>Paste a link</T>
            </Press>
          </View>
        )}

        <SectionLabel>History</SectionLabel>
        {history.length ? (
          <View style={{ gap: 10 }}>
            {history.map((j) =>
              j.status === 'done' ? (
                <DoneRow key={j.id} job={j} />
              ) : (
                <FailedRow key={j.id} job={j} />
              ),
            )}
          </View>
        ) : (
          <View style={card({ alignItems: 'center', paddingVertical: 24 })}>
            <T
              style={[
                sans(14, 400, C.ink2),
                { textAlign: 'center', paddingHorizontal: 12 },
              ]}
            >
              Finished and failed imports will show up here.
            </T>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const card = (extra: object = {}) => ({
  backgroundColor: C.white,
  borderWidth: 1,
  borderColor: C.line,
  borderRadius: 16,
  padding: 12,
  ...extra,
});

function SectionLabel({ children }: { children: string }) {
  return (
    <T
      style={[
        sans(12, 700, C.ink2),
        { marginTop: 26, marginBottom: 10, letterSpacing: em(12, 0.06) },
      ]}
    >
      {children.toUpperCase()}
    </T>
  );
}

function SourceTile({ job }: { job: ImportJob }) {
  return (
    <View
      style={{
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: '#eef2ec',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <SourceGlyph src={job.src} size={18} />
    </View>
  );
}

function RunningRow({ job }: { job: ImportJob }) {
  return (
    <View style={card()}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <SourceTile job={job} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <T numberOfLines={1} style={sans(14, 700)}>
            {job.src.host}
          </T>
          <T
            numberOfLines={1}
            style={[sans(12, 400, C.ink2), { marginTop: 1 }]}
          >
            {importStageLabel(job.pct)} · {Math.round(job.pct)}%
          </T>
        </View>
        <Press
          onPress={() => cancelImport(job.id)}
          scale={0.9}
          accessibilityLabel={`Cancel import from ${job.src.host}`}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Glyph name="close" size={20} color={C.ink3} />
        </Press>
      </View>
      <View
        style={{
          height: 5,
          marginTop: 12,
          borderRadius: 3,
          backgroundColor: C.surface3,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: `${Math.min(100, job.pct)}%`,
            height: '100%',
            backgroundColor: C.terra,
          }}
        />
      </View>
    </View>
  );
}

function DoneRow({ job }: { job: ImportJob }) {
  const open = () => {
    const id = job.recipeId;
    if (!id) return;
    useNav.getState().closeImports();
    afterMotion(Math.round(BASE_D * 1.1), () =>
      useNav.getState().openRecipe(id),
    );
  };
  return (
    <Press
      onPress={open}
      scale={0.98}
      easing={CSS_EASE}
      accessibilityLabel={`Open ${job.title ?? 'recipe'}`}
      style={card({ flexDirection: 'row', alignItems: 'center', gap: 12 })}
    >
      <Photo
        hue={hueOf(job.recipeId ?? job.id)}
        uri={job.thumb}
        radius={12}
        style={{ width: 52, height: 52 }}
      />
      <View style={{ flex: 1, minWidth: 0 }}>
        <T numberOfLines={2} style={sans(14, 700)}>
          {job.title ?? 'Recipe added'}
        </T>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            marginTop: 3,
          }}
        >
          <SourceGlyph src={job.src} size={12} />
          <T
            numberOfLines={1}
            style={[sans(12, 400, C.ink2), { flexShrink: 1 }]}
          >
            {job.src.host}
          </T>
        </View>
      </View>
      <Glyph name="chevron_right" size={20} color={C.ink3} />
    </Press>
  );
}

function FailedRow({ job }: { job: ImportJob }) {
  const group = job.group ?? 'generic';
  const copy = importErrorCopy(group, brandNameOf(job.src));
  const left = useCountdown(group === 'rate_limited' ? job.retryAt : undefined);
  const locked = left > 0;
  return (
    <View style={card()}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <ErrorTile icon={copy.icon} warn={copy.warn} size={40} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <T numberOfLines={2} style={sans(14, 700)}>
            {copy.message}
          </T>
          <T
            numberOfLines={1}
            style={[sans(12, 400, C.ink2), { marginTop: 2 }]}
          >
            {job.src.host}
          </T>
        </View>
        <Press
          onPress={() => useImports.getState().remove(job.id)}
          scale={0.9}
          accessibilityLabel="Remove from history"
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Glyph name="close" size={20} color={C.ink3} />
        </Press>
      </View>
      <Press
        onPress={() => retryImport(job.id, { slow: true })}
        disabled={locked}
        scale={0.97}
        easing={CSS_EASE}
        accessibilityState={{ disabled: locked }}
        style={{
          alignSelf: 'flex-start',
          height: 36,
          marginTop: 10,
          paddingHorizontal: 16,
          borderRadius: 99,
          borderWidth: 1.5,
          borderColor: locked ? C.line : C.green,
          justifyContent: 'center',
        }}
      >
        <T style={sans(13, 700, locked ? C.ink3 : C.green)}>
          {locked ? `Retry in ${left}s` : 'Retry'}
        </T>
      </Press>
    </View>
  );
}
