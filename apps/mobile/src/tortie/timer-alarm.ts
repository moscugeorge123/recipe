import Constants, { ExecutionEnvironment } from 'expo-constants';
import { AppState, Platform, type AppStateStatus } from 'react-native';

import { startAlarm, stopAlarm } from '@/tortie/alarm-player';
import { useCook } from '@/tortie/cook-store';
import { toast, useNav } from '@/tortie/nav-store';
import { useTortiePrefs } from '@/tortie/prefs-store';
import {
  ALARM_SOUND,
  armSignature,
  alarmId,
  diffAlarms,
  isAlerting,
  scheduledAlarmFrom,
  splitTimerKey,
  type AlarmCommand,
} from '@/tortie/timer-clock';

type NotificationsModule = typeof import('expo-notifications');
type NotificationResponse = import('expo-notifications').NotificationResponse;

/**
 * Cooking timers finish on the wall clock (`endsAt`). The OS fires this
 * alarm at that time, including after Tortie has been closed.
 *
 * Expo Go on Android throws while evaluating `expo-notifications` (SDK 53
 * removed remote push, and the package registers a push listener on import).
 * Alarms stay off there so the app can still open. A development build loads
 * the module and rings.
 */
const KIND = 'cook-timer';
/** Notification buttons: Stop silences without opening Tortie, Go to step opens the step. */
const CATEGORY = 'cook-timer-alarm';
const ACTION_STOP = 'stop';
const ACTION_GO = 'go-to-step';
/** Keeps the expanded notification readable on long steps. */
const MAX_BODY = 400;
const OPEN_RECENT_MS = 60_000;
const VIBRATE = [0, 500, 200, 500, 200, 800];
const inExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
const alarmsSupported =
  Platform.OS !== 'web' && !(Platform.OS === 'android' && inExpoGo);

const opened = new Set<string>();
/** Notification id → deadline armed in this process. iOS won't echo it back. */
const trusted = new Map<string, number>();
let askedPermission = false;
let channelReady: Promise<void> | null = null;
let categoryReady: Promise<void> | null = null;
let chain: Promise<void> = Promise.resolve();
let notificationsModule: Promise<NotificationsModule> | null = null;
let warnedExpoGo = false;
let toldDenied = false;

function loadNotifications(): Promise<NotificationsModule | null> {
  if (!alarmsSupported) return Promise.resolve(null);
  notificationsModule ??= import('expo-notifications').then((mod) => {
    mod.setNotificationHandler({
      // Open app: the in-app alarm rings and the alert screen shows, so the
      // notification only lands in the list.
      handleNotification: async () => ({
        shouldShowBanner: AppState.currentState !== 'active',
        shouldShowList: true,
        shouldPlaySound: AppState.currentState !== 'active',
        shouldSetBadge: false,
        priority: mod.AndroidNotificationPriority.MAX,
      }),
    });
    return mod;
  });
  return notificationsModule;
}

function warnExpoGoOnce() {
  if (warnedExpoGo || !__DEV__ || alarmsSupported) return;
  if (Platform.OS !== 'android' || !inExpoGo) return;
  warnedExpoGo = true;
  console.warn(
    'Cooking timer alarms are off in Expo Go on Android. Use a development build to hear them.',
  );
}

export function startTimerAlarms(): () => void {
  const onActive = (state: AppStateStatus) => {
    if (state !== 'active') {
      // The notification takes over once the app leaves the foreground.
      stopAlarm();
      return;
    }
    useCook.getState().tick();
    requestSync();
  };
  const appSub = AppState.addEventListener('change', onActive);
  const boot = () => {
    useCook.getState().tick();
    requestSync();
  };
  const unsubCook = useCook.subscribe((state, prev) => {
    if (state.timers === prev.timers) return;
    const alerts = useTortiePrefs.getState().timerAlerts;
    if (
      armSignature(state.timers, alerts) !== armSignature(prev.timers, alerts)
    ) {
      requestSync();
    }
  });
  const unsubPrefs = useTortiePrefs.subscribe((state, prev) => {
    if (state.timerAlerts !== prev.timerAlerts) requestSync();
  });
  const unsubHydrate = useCook.persist.onFinishHydration(boot);
  if (useCook.persist.hasHydrated()) boot();

  let stopped = false;
  let responseSub: { remove: () => void } | null = null;
  if (alarmsSupported) {
    void loadNotifications()
      .then((mod) => {
        if (!mod || stopped) return;
        responseSub = mod.addNotificationResponseReceivedListener((response) =>
          openFrom(response, false),
        );
        return mod.getLastNotificationResponseAsync().then((response) => {
          if (response && !stopped) openFrom(response, true);
        });
      })
      .catch(() => undefined);
  } else {
    warnExpoGoOnce();
  }

  return () => {
    stopped = true;
    appSub.remove();
    unsubHydrate();
    unsubCook();
    unsubPrefs();
    responseSub?.remove();
  };
}

function requestSync() {
  if (!alarmsSupported) return;
  chain = chain.then(reconcile).catch(() => undefined);
}

async function reconcile() {
  const notifications = await loadNotifications();
  if (!notifications) return;
  await prepare(notifications);
  const stamp = () =>
    armSignature(
      useCook.getState().timers,
      useTortiePrefs.getState().timerAlerts,
    );
  const before = stamp();
  const existing = await loadExisting(notifications);
  if (stamp() !== before) return;

  let timers = useCook.getState().timers;
  let alerts = useTortiePrefs.getState().timerAlerts;
  let commands = diffAlarms(timers, alerts, existing, Date.now(), trusted);
  if (commands.some((command) => command.type === 'schedule')) {
    const allowed = await ensurePermission(notifications);
    if (stamp() !== before) return;
    if (!allowed) {
      if (!toldDenied) {
        toldDenied = true;
        toast('Allow notifications so timers can ring when Tortie is closed');
      }
      for (const alarm of existing) {
        const timer = alarm.key ? timers[alarm.key] : undefined;
        if (timer?.run) {
          trusted.delete(alarm.id);
          await notifications
            .cancelScheduledNotificationAsync(alarm.id)
            .catch(() => undefined);
        }
      }
      return;
    }
    timers = useCook.getState().timers;
    alerts = useTortiePrefs.getState().timerAlerts;
    commands = diffAlarms(timers, alerts, existing, Date.now(), trusted);
  }

  for (const command of commands) {
    if (command.type === 'cancel') {
      trusted.delete(command.id);
      await notifications
        .cancelScheduledNotificationAsync(command.id)
        .catch(() => undefined);
    } else {
      await schedule(notifications, command)
        .then(() => {
          trusted.set(alarmId(command.key), command.endsAt);
        })
        .catch(() => undefined);
    }
  }
}

function prepare(notifications: NotificationsModule): Promise<void> {
  return Promise.all([
    prepareCategory(notifications),
    prepareChannel(notifications),
  ]).then(() => undefined);
}

function prepareCategory(notifications: NotificationsModule): Promise<void> {
  categoryReady ??= notifications
    .setNotificationCategoryAsync(CATEGORY, [
      {
        identifier: ACTION_STOP,
        buttonTitle: 'Stop',
        options: { opensAppToForeground: false },
      },
      {
        identifier: ACTION_GO,
        buttonTitle: 'Go to step',
        options: { opensAppToForeground: true },
      },
    ])
    .then(() => undefined)
    .catch((error: unknown) => {
      categoryReady = null;
      throw error;
    });
  return categoryReady;
}

function prepareChannel(notifications: NotificationsModule): Promise<void> {
  if (Platform.OS !== 'android') return Promise.resolve();
  channelReady ??= notifications
    .setNotificationChannelAsync(channelId(), {
      name: 'Cooking timers',
      importance: notifications.AndroidImportance.MAX,
      bypassDnd: true,
      description: 'Alarms when a cooking timer finishes',
      lockscreenVisibility: notifications.AndroidNotificationVisibility.PUBLIC,
      sound: channelSound(),
      audioAttributes: {
        usage: notifications.AndroidAudioUsage.ALARM,
        contentType: notifications.AndroidAudioContentType.SONIFICATION,
        flags: {
          enforceAudibility: true,
          requestHardwareAudioVideoSynchronization: false,
        },
      },
      vibrationPattern: VIBRATE,
      enableLights: true,
      lightColor: '#a23e18',
      enableVibrate: true,
      showBadge: false,
    })
    .then(() => undefined)
    .catch((error: unknown) => {
      channelReady = null;
      throw error;
    });
  return channelReady;
}

async function loadExisting(notifications: NotificationsModule) {
  const scheduled = await notifications.getAllScheduledNotificationsAsync();
  return scheduled.flatMap((request) => {
    const alarm = scheduledAlarmFrom(
      request.identifier,
      request.content.data,
      request.trigger,
    );
    return alarm ? [alarm] : [];
  });
}

async function ensurePermission(
  notifications: NotificationsModule,
): Promise<boolean> {
  const current = await notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (askedPermission && !current.canAskAgain) return false;
  askedPermission = true;
  const next = await notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true, allowBadge: false },
  });
  return next.granted;
}

async function schedule(
  notifications: NotificationsModule,
  command: Extract<AlarmCommand, { type: 'schedule' }>,
) {
  const parts = splitTimerKey(command.key);
  await notifications.scheduleNotificationAsync({
    identifier: alarmId(command.key),
    content: {
      title: "Time's up" + (parts ? ' · Step ' + (parts.step + 1) : ''),
      ...(command.recipeTitle ? { subtitle: command.recipeTitle } : {}),
      body: alarmBody(command),
      categoryIdentifier: CATEGORY,
      sound: contentSound(),
      interruptionLevel: 'timeSensitive',
      priority: notifications.AndroidNotificationPriority.MAX,
      color: '#a23e18',
      vibrate: VIBRATE,
      data: {
        kind: KIND,
        key: command.key,
        recipeId: parts?.recipeId ?? '',
        step: String(parts?.step ?? 0),
        endsAt: String(command.endsAt),
      },
    },
    trigger: {
      type: notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(command.endsAt),
      channelId: channelId(),
    },
  });
}

/** Step title, then its instructions, for the expanded notification. */
function alarmBody(
  command: Extract<AlarmCommand, { type: 'schedule' }>,
): string {
  const head = command.title || command.recipeTitle || 'Cooking timer';
  const detail = command.detail?.trim();
  if (!detail) return head;
  const text = head + '\n' + detail;
  return text.length > MAX_BODY ? text.slice(0, MAX_BODY - 1) + '…' : text;
}

function openFrom(response: NotificationResponse, recentOnly: boolean) {
  const notification = response.notification;
  const token = `${notification.request.identifier}:${notification.date}:${response.actionIdentifier}`;
  if (opened.has(token)) return;
  const data = notification.request.content.data;
  if (!data || data.kind !== KIND) return;
  if (response.actionIdentifier === ACTION_STOP) {
    // Can arrive late (Tortie was closed when it was pressed): only stop the
    // run this notification was for, never a later one.
    opened.add(token);
    stopFrom(data);
    void loadNotifications().then((mod) =>
      mod
        ?.dismissNotificationAsync(notification.request.identifier)
        .catch(() => undefined),
    );
    return;
  }
  const at =
    notification.date < 1e12 ? notification.date * 1000 : notification.date;
  if (recentOnly && Date.now() - at > OPEN_RECENT_MS) return;
  const recipeId = data.recipeId;
  const step = Number(data.step);
  if (
    typeof recipeId !== 'string' ||
    !recipeId ||
    !Number.isInteger(step) ||
    step < 0
  ) {
    return;
  }
  opened.add(token);
  // A plain tap on a timer still waiting for Stop / Snooze: the alert screen
  // (or cook mode's card and dock) shows it with the step, so stay put.
  // "Go to step" always opens the step, where the card shows Snooze / Stop.
  if (response.actionIdentifier !== ACTION_GO) {
    useCook.getState().tick();
    const key = typeof data.key === 'string' ? data.key : null;
    const timer = key ? useCook.getState().timers[key] : undefined;
    if (timer && isAlerting(timer)) return;
  }
  useNav.getState().set({ timerHeld: null });
  const cook = useCook.getState();
  cook.begin(recipeId);
  cook.setStep(step);
  useNav.getState().openCook(recipeId);
}

function stopFrom(data: Record<string, unknown>) {
  const key = typeof data.key === 'string' ? data.key : null;
  if (!key) return;
  const cook = useCook.getState();
  cook.tick();
  const timer = cook.timers[key];
  if (!timer || !isAlerting(timer)) return;
  const endsAt = Number(data.endsAt);
  if (Number.isFinite(endsAt) && timer.doneAt !== endsAt) return;
  cook.stop(key);
}

function usesBundledAlarm(): boolean {
  return Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
}

function channelId(): string {
  return usesBundledAlarm() ? 'cook-alarms-v2' : 'cook-alarms-default';
}

function channelSound(): string | null {
  return usesBundledAlarm() ? ALARM_SOUND : null;
}

function contentSound(): 'default' | 'defaultRingtone' | typeof ALARM_SOUND {
  if (usesBundledAlarm()) return ALARM_SOUND;
  return Platform.OS === 'ios' ? 'defaultRingtone' : 'default';
}

/**
 * Diagnostics for the Profile "Test alarm" row: rings the in-app alarm now and
 * schedules a real notification in 5 s (needs notification permission).
 */
export async function testAlarm(): Promise<void> {
  startAlarm();
  const notifications = await loadNotifications();
  if (!notifications) return;
  await prepare(notifications);
  if (!(await ensurePermission(notifications))) {
    toast('Allow notifications so timers can ring when Tortie is closed');
    return;
  }
  await notifications.scheduleNotificationAsync({
    content: {
      title: "Time's up",
      body: 'Test alarm',
      sound: contentSound(),
      priority: notifications.AndroidNotificationPriority.MAX,
      vibrate: VIBRATE,
    },
    trigger: {
      type: notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 5,
      channelId: channelId(),
    },
  });
}
