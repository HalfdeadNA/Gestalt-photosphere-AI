import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as SQLite from 'expo-sqlite';

type TabKey = 'command' | 'tasks' | 'memory' | 'ops';
type TaskRow = {
  id: number;
  title: string;
  status: 'open' | 'done';
  created_at: string;
};
type MemoryRow = {
  id: number;
  note: string;
  category: string;
  created_at: string;
};
type LogRow = {
  id: number;
  entry: string;
  kind: string;
  created_at: string;
};

const dbName = 'evaone_ai.db';

const palette = {
  bg: '#050816',
  panel: '#0b1020',
  panelAlt: '#11182b',
  border: 'rgba(123, 146, 255, 0.18)',
  text: '#e9eeff',
  muted: '#98a7d4',
  cyan: '#5de4ff',
  violet: '#8e7dff',
  green: '#7dffb2',
  danger: '#ff8fa3',
};

function formatDate(iso: string) {
  const date = new Date(iso);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

export default function App() {
  const [db, setDb] = useState<SQLite.SQLiteDatabase | null>(null);
  const [booting, setBooting] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('command');

  const [commandText, setCommandText] = useState('');
  const [memoryText, setMemoryText] = useState('');
  const [opsText, setOpsText] = useState('');

  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [memories, setMemories] = useState<MemoryRow[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [webAllowed, setWebAllowed] = useState(false);
  const [focusMode, setFocusMode] = useState(true);

  const openTasks = useMemo(() => tasks.filter((task) => task.status === 'open'), [tasks]);
  const doneTasks = useMemo(() => tasks.filter((task) => task.status === 'done'), [tasks]);

  const bootstrap = useCallback(async () => {
    const database = await SQLite.openDatabaseAsync(dbName);
    await database.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS memories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        note TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'general',
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entry TEXT NOT NULL,
        kind TEXT NOT NULL DEFAULT 'system',
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS preferences (
        pref_key TEXT PRIMARY KEY NOT NULL,
        pref_value TEXT NOT NULL
      );
    `);
    setDb(database);
  }, []);

  const upsertPref = useCallback(async (key: string, value: string) => {
    if (!db) return;
    await db.runAsync(
      `INSERT INTO preferences (pref_key, pref_value)
       VALUES (?, ?)
       ON CONFLICT(pref_key) DO UPDATE SET pref_value = excluded.pref_value;`,
      key,
      value
    );
  }, [db]);

  const insertLog = useCallback(async (entry: string, kind = 'system') => {
    if (!db) return;
    await db.runAsync(
      'INSERT INTO logs (entry, kind, created_at) VALUES (?, ?, ?)',
      entry,
      kind,
      new Date().toISOString()
    );
  }, [db]);

  const refreshAll = useCallback(async () => {
    if (!db) return;

    const taskRows = await db.getAllAsync<TaskRow>(
      'SELECT id, title, status, created_at FROM tasks ORDER BY id DESC'
    );
    const memoryRows = await db.getAllAsync<MemoryRow>(
      'SELECT id, note, category, created_at FROM memories ORDER BY id DESC'
    );
    const logRows = await db.getAllAsync<LogRow>(
      'SELECT id, entry, kind, created_at FROM logs ORDER BY id DESC LIMIT 30'
    );
    const preferenceRows = await db.getAllAsync<{ pref_key: string; pref_value: string }>(
      'SELECT pref_key, pref_value FROM preferences'
    );

    setTasks(taskRows);
    setMemories(memoryRows);
    setLogs(logRows);

    const prefMap = new Map(preferenceRows.map((row) => [row.pref_key, row.pref_value]));
    setWebAllowed(prefMap.get('webAllowed') === 'true');
    setFocusMode(prefMap.get('focusMode') !== 'false');
  }, [db]);

  useEffect(() => {
    bootstrap().catch((error) => {
      Alert.alert('Database error', error.message);
    });
  }, [bootstrap]);

  useEffect(() => {
    if (!db) return;

    refreshAll()
      .catch((error) => {
        Alert.alert('Load error', error.message);
      })
      .finally(() => setBooting(false));
  }, [db, refreshAll]);

  const addTask = useCallback(async (title: string) => {
    if (!db || !title.trim()) return;
    await db.runAsync(
      'INSERT INTO tasks (title, status, created_at) VALUES (?, ?, ?)',
      title.trim(),
      'open',
      new Date().toISOString()
    );
    await insertLog(`Task captured: ${title.trim()}`, 'task');
    await refreshAll();
  }, [db, insertLog, refreshAll]);

  const addMemory = useCallback(async (note: string, category = 'general') => {
    if (!db || !note.trim()) return;
    await db.runAsync(
      'INSERT INTO memories (note, category, created_at) VALUES (?, ?, ?)',
      note.trim(),
      category,
      new Date().toISOString()
    );
    await insertLog(`Memory saved: ${note.trim()}`, 'memory');
    await refreshAll();
  }, [db, insertLog, refreshAll]);

  const addOpsEntry = useCallback(async (entry: string) => {
    if (!db || !entry.trim()) return;
    await insertLog(entry.trim(), 'ops');
    await refreshAll();
  }, [db, insertLog, refreshAll]);

  const updateTaskStatus = useCallback(async (taskId: number, nextStatus: 'open' | 'done') => {
    if (!db) return;
    await db.runAsync('UPDATE tasks SET status = ? WHERE id = ?', nextStatus, taskId);
    await insertLog(
      nextStatus === 'done' ? `Task completed: #${taskId}` : `Task reopened: #${taskId}`,
      'task'
    );
    await refreshAll();
  }, [db, insertLog, refreshAll]);

  const clearCompleted = useCallback(async () => {
    if (!db) return;
    await db.runAsync("DELETE FROM tasks WHERE status = 'done'");
    await insertLog('Completed tasks cleared.', 'task');
    await refreshAll();
  }, [db, insertLog, refreshAll]);

  const routeCommand = useCallback(async () => {
    const trimmed = commandText.trim();
    if (!trimmed) return;

    if (trimmed.toLowerCase().startsWith('remember ')) {
      await addMemory(trimmed.replace(/^remember\s+/i, ''), 'remembered');
      setCommandText('');
      setActiveTab('memory');
      return;
    }

    if (trimmed.toLowerCase().startsWith('log ')) {
      await addOpsEntry(trimmed.replace(/^log\s+/i, ''));
      setCommandText('');
      setActiveTab('ops');
      return;
    }

    await addTask(trimmed);
    setCommandText('');
    setActiveTab('tasks');
  }, [addMemory, addOpsEntry, addTask, commandText]);

  const handleToggleWeb = useCallback(async (value: boolean) => {
    setWebAllowed(value);
    await upsertPref('webAllowed', String(value));
    await insertLog(
      value
        ? 'Session web access flag enabled. External browsing still requires explicit implementation.'
        : 'Session web access flag disabled.',
      'pref'
    );
    await refreshAll();
  }, [insertLog, refreshAll, upsertPref]);

  const handleToggleFocus = useCallback(async (value: boolean) => {
    setFocusMode(value);
    await upsertPref('focusMode', String(value));
    await insertLog(value ? 'Focus mode enabled.' : 'Focus mode disabled.', 'pref');
    await refreshAll();
  }, [insertLog, refreshAll, upsertPref]);

  if (booting) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" />
        <View style={styles.loaderWrap}>
          <Text style={styles.loaderTitle}>EvaOne.AI</Text>
          <Text style={styles.loaderText}>Initializing local command systems...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.heroCard}>
          <Text style={styles.eyebrow}>LOCAL-FIRST EXECUTIVE SYSTEM</Text>
          <Text style={styles.title}>EvaOne.AI</Text>
          <Text style={styles.subtitle}>
            A real shell for capture, task routing, memory, and operations. No fake browser control.
          </Text>
          <View style={styles.statsRow}>
            <StatCard label="Open tasks" value={String(openTasks.length)} />
            <StatCard label="Memories" value={String(memories.length)} />
            <StatCard label="Logs" value={String(logs.length)} />
          </View>
        </View>

        <View style={styles.tabsRow}>
          {[
            ['command', 'Command'],
            ['tasks', 'Tasks'],
            ['memory', 'Memory'],
            ['ops', 'Ops'],
          ].map(([key, label]) => {
            const selected = activeTab === key;
            return (
              <Pressable
                key={key}
                onPress={() => setActiveTab(key as TabKey)}
                style={[styles.tabButton, selected && styles.tabButtonActive]}
              >
                <Text style={[styles.tabText, selected && styles.tabTextActive]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        {activeTab === 'command' && (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Command Center</Text>
            <Text style={styles.panelText}>
              Type a command. Plain text becomes a task. Start with “remember” to save memory. Start with
              “log” to create an ops entry.
            </Text>
            <TextInput
              value={commandText}
              onChangeText={setCommandText}
              placeholder="Example: remember client prefers concise pricing"
              placeholderTextColor={palette.muted}
              multiline
              style={styles.textArea}
            />
            <View style={styles.buttonRow}>
              <PrimaryButton label="Route command" onPress={routeCommand} />
              <SecondaryButton
                label="Save as memory"
                onPress={async () => {
                  await addMemory(commandText, 'manual');
                  setCommandText('');
                  setActiveTab('memory');
                }}
              />
            </View>
          </View>
        )}

        {activeTab === 'tasks' && (
          <View style={styles.panel}>
            <SectionHeader title="Task Board" subtitle="Capture what matters, then close the loop." />
            <TextInput
              value={memoryText}
              onChangeText={setMemoryText}
              placeholder="Add a new task..."
              placeholderTextColor={palette.muted}
              style={styles.input}
            />
            <View style={styles.buttonRow}>
              <PrimaryButton
                label="Add task"
                onPress={async () => {
                  await addTask(memoryText);
                  setMemoryText('');
                }}
              />
              <SecondaryButton label="Clear done" onPress={clearCompleted} />
            </View>

            <Text style={styles.listHeading}>Open</Text>
            {openTasks.length === 0 ? <EmptyState text="No open tasks yet." /> : null}
            {openTasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                actionLabel="Complete"
                onPress={() => updateTaskStatus(task.id, 'done')}
              />
            ))}

            <Text style={styles.listHeading}>Completed</Text>
            {doneTasks.length === 0 ? <EmptyState text="Nothing completed yet." /> : null}
            {doneTasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                actionLabel="Reopen"
                onPress={() => updateTaskStatus(task.id, 'open')}
              />
            ))}
          </View>
        )}

        {activeTab === 'memory' && (
          <View style={styles.panel}>
            <SectionHeader title="Memory Vault" subtitle="Persistent notes saved on device through SQLite." />
            <TextInput
              value={opsText}
              onChangeText={setOpsText}
              placeholder="Save a detail worth keeping..."
              placeholderTextColor={palette.muted}
              multiline
              style={styles.textArea}
            />
            <View style={styles.buttonRow}>
              <PrimaryButton
                label="Save memory"
                onPress={async () => {
                  await addMemory(opsText, 'vault');
                  setOpsText('');
                }}
              />
            </View>
            {memories.length === 0 ? <EmptyState text="No memories stored yet." /> : null}
            {memories.map((memory) => (
              <View key={memory.id} style={styles.listCard}>
                <Text style={styles.listCardTitle}>{memory.note}</Text>
                <Text style={styles.metaText}>
                  {memory.category.toUpperCase()} • {formatDate(memory.created_at)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'ops' && (
          <View style={styles.panel}>
            <SectionHeader title="Operations" subtitle="Session rules and internal activity trail." />
            <View style={styles.toggleCard}>
              <View style={styles.toggleCopy}>
                <Text style={styles.toggleTitle}>Allow web access flag</Text>
                <Text style={styles.panelText}>
                  This only stores session intent. It does not magically grant live browsing. Tragic, I know.
                </Text>
              </View>
              <Switch value={webAllowed} onValueChange={handleToggleWeb} />
            </View>
            <View style={styles.toggleCard}>
              <View style={styles.toggleCopy}>
                <Text style={styles.toggleTitle}>Focus mode</Text>
                <Text style={styles.panelText}>Keeps the app oriented around direct action and fewer distractions.</Text>
              </View>
              <Switch value={focusMode} onValueChange={handleToggleFocus} />
            </View>
            {logs.map((log) => (
              <View key={log.id} style={styles.logCard}>
                <Text style={styles.logKind}>{log.kind.toUpperCase()}</Text>
                <Text style={styles.listCardTitle}>{log.entry}</Text>
                <Text style={styles.metaText}>{formatDate(log.created_at)}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.panelTitle}>{title}</Text>
      <Text style={styles.panelText}>{subtitle}</Text>
    </View>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function TaskItem({
  task,
  actionLabel,
  onPress,
}: {
  task: TaskRow;
  actionLabel: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.listCard}>
      <Text style={styles.listCardTitle}>{task.title}</Text>
      <Text style={styles.metaText}>{formatDate(task.created_at)}</Text>
      <View style={styles.inlineButtonRow}>
        <SecondaryButton label={actionLabel} onPress={onPress} />
      </View>
    </View>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.panelText}>{text}</Text>
    </View>
  );
}

function PrimaryButton({ label, onPress }: { label: string; onPress: () => void | Promise<void> }) {
  return (
    <Pressable style={styles.primaryButton} onPress={() => void onPress()}>
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function SecondaryButton({ label, onPress }: { label: string; onPress: () => void | Promise<void> }) {
  return (
    <Pressable style={styles.secondaryButton} onPress={() => void onPress()}>
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  container: {
    padding: 16,
    paddingBottom: 32,
    gap: 16,
  },
  loaderWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: palette.bg,
  },
  loaderTitle: {
    color: palette.text,
    fontSize: 28,
    fontWeight: '800',
  },
  loaderText: {
    color: palette.muted,
    marginTop: 8,
    fontSize: 15,
  },
  heroCard: {
    backgroundColor: palette.panel,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 24,
    padding: 18,
    gap: 10,
  },
  eyebrow: {
    color: palette.cyan,
    fontSize: 11,
    letterSpacing: 1.4,
    fontWeight: '700',
  },
  title: {
    color: palette.text,
    fontSize: 32,
    fontWeight: '800',
  },
  subtitle: {
    color: palette.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  statCard: {
    flex: 1,
    backgroundColor: palette.panelAlt,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 18,
    padding: 14,
    gap: 6,
  },
  statValue: {
    color: palette.text,
    fontSize: 22,
    fontWeight: '800',
  },
  statLabel: {
    color: palette.muted,
    fontSize: 12,
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  tabButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: palette.panelAlt,
    borderWidth: 1,
    borderColor: palette.border,
  },
  tabButtonActive: {
    backgroundColor: 'rgba(93, 228, 255, 0.14)',
    borderColor: 'rgba(93, 228, 255, 0.35)',
  },
  tabText: {
    color: palette.muted,
    fontWeight: '700',
  },
  tabTextActive: {
    color: palette.text,
  },
  panel: {
    backgroundColor: palette.panel,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: palette.border,
    gap: 14,
  },
  sectionHeader: {
    gap: 6,
  },
  panelTitle: {
    color: palette.text,
    fontSize: 22,
    fontWeight: '800',
  },
  panelText: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  input: {
    backgroundColor: palette.panelAlt,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 16,
    color: palette.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: 'top',
    backgroundColor: palette.panelAlt,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 16,
    color: palette.text,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  inlineButtonRow: {
    marginTop: 10,
    alignItems: 'flex-start',
  },
  primaryButton: {
    backgroundColor: palette.cyan,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
  },
  primaryButtonText: {
    color: '#07101b',
    fontWeight: '800',
    fontSize: 14,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
  },
  secondaryButtonText: {
    color: palette.text,
    fontWeight: '700',
    fontSize: 14,
  },
  listHeading: {
    color: palette.violet,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginTop: 2,
  },
  listCard: {
    backgroundColor: palette.panelAlt,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 18,
    padding: 14,
    gap: 8,
  },
  listCardTitle: {
    color: palette.text,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '700',
  },
  metaText: {
    color: palette.muted,
    fontSize: 12,
  },
  emptyCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.panelAlt,
    padding: 14,
  },
  toggleCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
    backgroundColor: palette.panelAlt,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 18,
    padding: 14,
  },
  toggleCopy: {
    flex: 1,
    gap: 6,
  },
  toggleTitle: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '700',
  },
  logCard: {
    backgroundColor: palette.panelAlt,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 18,
    padding: 14,
    gap: 8,
  },
  logKind: {
    color: palette.green,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
});
