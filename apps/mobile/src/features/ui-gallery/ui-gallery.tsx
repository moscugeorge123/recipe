import {
  Newsreader_500Medium,
  Newsreader_600SemiBold,
} from '@expo-google-fonts/newsreader';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { router } from 'expo-router';
import { useFonts } from 'expo-font';
import { useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChevronLeft } from '@/components/icons/chevron-left';
import {
  AppHeader,
  CalloutCard,
  CheckRow,
  Chip,
  colors,
  CompactRecipeCard,
  CookDock,
  DayPill,
  DropSlot,
  GroupCard,
  IconButton,
  InfoRow,
  MealSlotCard,
  MediaFrame,
  NutritionCard,
  PillButton,
  ProcessCard,
  ProgressTrack,
  RecipeRow,
  SearchField,
  SegmentedControl,
  SourceCard,
  StatTile,
  StatusBanner,
  StepCard,
  Surface,
  Text,
  TimerCard,
  TipCard,
  type SurfaceTone,
} from '@recipe/ui';

const tones: SurfaceTone[] = [
  'canvas',
  'lowest',
  'low',
  'container',
  'high',
  'primary',
  'accent',
  'inverse',
];

const days = [
  { weekday: 'Mon', date: '19' },
  { weekday: 'Tue', date: '20' },
  { weekday: 'Wed', date: '21' },
  { weekday: 'Thu', date: '22' },
  { weekday: 'Fri', date: '23' },
  { weekday: 'Sat', date: '24' },
  { weekday: 'Sun', date: '25' },
];

const chips = ['All recipes', 'Poultry', 'Breads'];

const ingredients = [
  { id: 'garlic', title: '1 garlic bulb', meta: 'cloves separated' },
  { id: 'oil', title: '60ml olive oil', meta: 'cold pressed' },
  { id: 'tomatoes', title: '400g cherry tomatoes', meta: 'ripe' },
];

export function UiGallery() {
  useFonts({
    Newsreader_500Medium,
    Newsreader_600SemiBold,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  const [query, setQuery] = useState('');
  const [source, setSource] = useState<'url' | 'social' | 'scan'>('url');
  const [chip, setChip] = useState(chips[0] ?? 'All recipes');
  const [day, setDay] = useState('Wed');
  const [checked, setChecked] = useState<Record<string, boolean>>({
    garlic: true,
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }}>
      <AppHeader
        wordmark="Thyme & Terracotta"
        title="Component gallery"
        subtitle="Culinary Sage"
        leading={
          <IconButton accessibilityLabel="Back" onPress={() => router.back()}>
            <ChevronLeft color={colors.ink} />
          </IconButton>
        }
      />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: 40,
          gap: 28,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Section title="Type">
          <Text variant="display">Display</Text>
          <Text variant="headline">Headline</Text>
          <Text variant="title">Title</Text>
          <Text variant="body">Body copy for a recipe step.</Text>
          <Text variant="label">Label</Text>
          <Text variant="caption">Caption</Text>
          <Text variant="mono">12:40</Text>
        </Section>

        <Section title="Surfaces">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {tones.map((tone) => (
              <Surface
                key={tone}
                tone={tone}
                padding="sm"
                style={{ width: '47%' }}
              >
                <Text variant="label">{tone}</Text>
              </Surface>
            ))}
          </View>
        </Section>

        <Section title="Stat tiles">
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <StatTile style={{ flex: 1 }} value="142" caption="Saved recipes" />
            <StatTile style={{ flex: 1 }} value="5" caption="Meals" />
            <StatTile style={{ flex: 1 }} value="18" caption="Grocery items" />
          </View>
        </Section>

        <Section title="Recipe row">
          <RecipeRow
            title="Wild Sage & Sea Salt Boule"
            meta="45 mins · Artisan bread · Intermediate"
            image={<Swatch color={colors.primaryFixed} />}
          />
        </Section>

        <Section title="Compact cards">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
          >
            <CompactRecipeCard
              time="22 min"
              title="Crispy Salmon Risotto"
              image={<Swatch color={colors.accentFixed} height={96} />}
            />
            <CompactRecipeCard
              time="45 min"
              title="Herbed Ratatouille Bake"
              image={<Swatch color={colors.primaryFixed} height={96} />}
            />
          </ScrollView>
        </Section>

        <Section title="Meal slot">
          <MealSlotCard
            meal="Breakfast"
            time="8:30 AM"
            kcal="390 kcal"
            title="Avocado Toast with Poached Egg"
            subtitle="Sourdough, farm egg, chili crunch"
          />
        </Section>

        <Section title="Drop slot">
          <DropSlot
            title="Add an afternoon treat"
            hint="Drag a recipe here or tap to pick"
          />
        </Section>

        <Section title="Callouts">
          <CalloutCard
            tone="primary"
            title="Plan to pantry sync"
            body="Consolidates 7 days and checks the current pantry."
            action={<PillButton label="28 items" size="md" />}
          />
          <CalloutCard
            tone="accent"
            title="Clipboard detected"
            body="nytcooking.com/creamy-tuscan-salmon"
            action={<PillButton label="Magic paste" variant="accent" />}
          />
        </Section>

        <Section title="Group">
          <GroupCard title="Produce" meta="1 of 3 checked">
            {ingredients.map((item) => (
              <CheckRow
                key={item.id}
                checked={checked[item.id] ?? false}
                title={item.title}
                meta={item.meta}
                onPress={() =>
                  setChecked((current) => ({
                    ...current,
                    [item.id]: !current[item.id],
                  }))
                }
              />
            ))}
          </GroupCard>
        </Section>

        <Section title="Info row">
          <InfoRow label="Deep cast-iron skillet" value="1" />
          <InfoRow label="Large pasta pot" value="1" />
        </Section>

        <Section title="Tip">
          <TipCard
            eyebrow="Chef's tip"
            body="Keep a heatproof cup next to the stove for the starchy pasta water."
          />
        </Section>

        <Section title="Steps">
          <StepCard
            index={1}
            title="Confit garlic and blister tomatoes"
            duration="10 min"
            body="Garlic cloves soften in olive oil with rosemary."
            active
          />
          <StepCard
            index={2}
            title="Boil tagliatelle"
            duration="8 min"
            body="Salt the water and save a cup before draining."
          />
        </Section>

        <Section title="Media">
          <MediaFrame accessibilityLabel="Cook step photo">
            <Swatch color={colors.high} height={176} />
          </MediaFrame>
        </Section>

        <Section title="Timer">
          <TimerCard
            eyebrow="Mantecatura timer"
            status="In progress"
            actions={
              <>
                <PillButton label="Pause" variant="tonal" />
                <PillButton label="+ 30 sec" variant="ghost" />
              </>
            }
          >
            <Text variant="display">02:00</Text>
          </TimerCard>
        </Section>

        <Section title="Process">
          <ProcessCard
            status="done"
            title="Download and extract"
            detail="Transcript and frames are in."
          />
          <ProcessCard
            status="active"
            title="Detect ingredients"
            detail="8 ingredients, metric units."
            progress={<ProgressTrack value={0.68} />}
          />
          <ProcessCard
            status="waiting"
            title="Nutrition and pantry"
            detail="Waiting on the step list."
          />
        </Section>

        <Section title="Source">
          <SourceCard
            title="Creamy Garlic Confit Pasta"
            subtitle="Instagram reel · @chefmarina"
            thumbnail={<Swatch color={colors.accentFixed} />}
          />
        </Section>

        <Section title="Status banner">
          <StatusBanner
            label="Cook mode active"
            action={<PillButton label="Next" variant="accent" />}
          />
        </Section>

        <Section title="Nutrition">
          <NutritionCard title="Daily energy" value="1,840" goal="2,100 kcal">
            <ProgressTrack value={1840 / 2100} />
          </NutritionCard>
        </Section>

        <Section title="Buttons">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <PillButton label="Primary" />
            <PillButton label="Accent" variant="accent" />
            <PillButton label="Tonal" variant="tonal" />
            <PillButton label="Ghost" variant="ghost" />
            <IconButton accessibilityLabel="Add">
              <Text variant="title">+</Text>
            </IconButton>
          </View>
        </Section>

        <Section title="Chips">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {chips.map((label) => (
              <Chip
                key={label}
                label={label}
                selected={chip === label}
                onPress={() => setChip(label)}
              />
            ))}
          </View>
        </Section>

        <Section title="Days">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
          >
            {days.map((item) => (
              <DayPill
                key={item.weekday}
                weekday={item.weekday}
                date={item.date}
                selected={day === item.weekday}
                onPress={() => setDay(item.weekday)}
              />
            ))}
          </ScrollView>
        </Section>

        <Section title="Segmented control">
          <SegmentedControl
            options={[
              { value: 'url', label: 'URL' },
              { value: 'social', label: 'Social' },
              { value: 'scan', label: 'Scan' },
            ]}
            value={source}
            onChange={setSource}
          />
        </Section>

        <Section title="Search">
          <SearchField
            value={query}
            onChangeText={setQuery}
            placeholder="Search pasta, tomatoes, baking..."
          />
        </Section>

        <Section title="Progress">
          <ProgressTrack value={0.4} accessibilityLabel="Sage progress" />
          <ProgressTrack
            value={0.8}
            tone="terracotta"
            accessibilityLabel="Terracotta progress"
          />
        </Section>

        <Section title="Check row">
          <CheckRow
            checked={checked.spinach ?? false}
            title="Baby spinach"
            meta="1 unit · manual addition"
            onPress={() =>
              setChecked((current) => ({
                ...current,
                spinach: !current.spinach,
              }))
            }
          />
        </Section>

        <Section title="Cook dock">
          <CookDock
            progress={0.8}
            leading={<PillButton label="Previous" variant="tonal" />}
            trailing={<PillButton label="Next" />}
          >
            <Text variant="label">Step 4 of 5</Text>
          </CookDock>
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: 12 }}>
      <Text variant="headline">{title}</Text>
      {children}
    </View>
  );
}

function Swatch({ color, height = 72 }: { color: string; height?: number }) {
  return <View style={{ flex: 1, height, backgroundColor: color }} />;
}
