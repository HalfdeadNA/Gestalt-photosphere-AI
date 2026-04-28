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

type TabKey = 'dashboard' | 'projects' | 'tasks' | 'prompts' | 'notes' | 'activity' | 'settings';
type Status = 'open' | 'done';

type ProjectRow = {
  id: number;
  name: string;
  summary: string;
  status: Status;
  created_at: string;
  updated_at: string;
};

type TaskRow = {
  id: number;
  title: string;
  detail: string;
  project_name: string;
  status: Status;
  created_at: string;
  updated_at: string;
};

type PromptRow = {
  id: number;
  title: string;
  category: string;
  body: string;
  created_at: string;
  updated_at: string;
};

type NoteRow = {
  id: number;
  title: string;
  body: string;
  created_at: string;
  updated_at: string;
};

type LogRow = {
  id: number;
  entry: string;
  kind: string;
  created_at: string;
};

const dbName = 'evaone_ai_layer1.db';

const palette = {
  bg: '#050816',
  panel: '#0B1020',
  panelAlt: '#111827',
  border: 'rgba(124, 58, 237, 0.28)',
  text: '#EAF2FF',
  muted: '#97A6C7',
  cyan: '#06B6D4',
  violet: '#7C3AED',
  green: '#22C55E',
  amber: '#F59E0B',
  danger: '#FB7185',
};

function now() {
  return new Date().toISOString();
}

function formatDate(iso: string) {
  const date = new Date(iso);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

function normalize(input: string) {
  return input.trim().replace(/\s+/g, ' ');
}

export default function App() {
  const [db, setDb] = useState<SQLite.SQLiteDatabase | null>(null);
  const [booting, setBooting] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');

  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [prompts, setPrompts] = useState<PromptRow[]>([]);
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);

  const [projectName, setProjectName] = useState('');
  const [projectSummary, setProjectSummary] = useState('');
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null);

  const [taskTitle, setTaskTitle] = useState('');
  const [taskDetail, setTaskDetail] = useState('');
  const [taskProject, setTaskProject] = useState('');
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);

  const [promptTitle, setPromptTitle] = useState('');
  const [promptCategory, setPromptCategory] = useState('General');
  const [promptBody, setPromptBody] = useState('');
  const [promptSearch, setPromptSearch] = useState('');
  const [editingPromptId, setEditingPromptId] = useState<number | null>(null);

  const [noteTitle, setNoteTitle] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);

  const [focusMode, setFocusMode] = useState(true);
  const [connectorReady, setConnectorReady] = useState(false);

  const openTasks = useMemo(() => tasks.filter((task) => task.status === 'open'), [tasks]);
  const doneTasks = useMemo(() => tasks.filter((task) => task.status === 'done'), [tasks]);
  const activeProjects = useMemo(() => projects.filter((project) => project.status === 'open'), [projects]);
  const filteredPrompts = useMemo(() => {
    const query = promptSearch.trim().toLowerCase();
    if (!query) return prompts;
    return prompts.filter((prompt) =>
      `${prompt.title} ${prompt.category} ${prompt.body}`.toLowerCase().includes(query)
    );
  }, [promptSearch, prompts]);

  const log = useCallback(async (entry: string, kind = 'system') => {
    if (!db) return;
    await db.runAsync('INSERT INTO activity_logs (entry, kind, created_at) VALUES (?, ?, ?)', entry, kind, now());
  }, [db]);

  const refreshAll = useCallback(async () => {
    if (!db) return;
    const projectRows = await db.getAllAsync<ProjectRow>('SELECT * FROM projects ORDER BY id DESC');
    const taskRows = await db.getAllAsync<TaskRow>('SELECT * FROM tasks ORDER BY id DESC');
    const promptRows = await db.getAllAsync<PromptRow>('SELECT * FROM prompts ORDER BY id DESC');
    const noteRows = await db.getAllAsync<NoteRow>('SELECT * FROM notes ORDER BY id DESC');
    const logRows = await db.getAllAsync<LogRow>('SELECT * FROM activity_logs ORDER BY id DESC LIMIT 60');
    const prefRows = await db.getAllAsync<{ pref_key: string; pref_value: string }>('SELECT * FROM preferences');

    const prefMap = new Map(prefRows.map((row) => [row.pref_key, row.pref_value]));
    setProjects(projectRows);
    setTasks(taskRows);
    setPrompts(promptRows);
    setNotes(noteRows);
    setLogs(logRows);
    setFocusMode(prefMap.get('focusMode') !== 'false');
    setConnectorReady(prefMap.get('connectorReady') === 'true');
  }, [db]);

  const bootstrap = useCallback(async () => {
    const database = await SQLite.openDatabaseAsync(dbName);
    await database.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        summary TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'open',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        detail TEXT NOT NULL DEFAULT '',
        project_name TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'open',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS prompts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'General',
        body TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS activity_logs (
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

  useEffect(() => {
    bootstrap().catch((error) => Alert.alert('Startup error', error.message));
  }, [bootstrap]);

  useEffect(() => {
    if (!db) return;
    refreshAll()
      .catch((error) => Alert.alert('Load error', error.message))
      .finally(() => setBooting(false));
  }, [db, refreshAll]);

  const upsertPref = useCallback(async (key: string, value: string) => {
    if (!db) return;
    await db.runAsync(
      `INSERT INTO preferences (pref_key, pref_value) VALUES (?, ?)
       ON CONFLICT(pref_key) DO UPDATE SET pref_value = excluded.pref_value`,
      key,
      value
    );
  }, [db]);

  const saveProject = useCallback(async () => {
    if (!db) return;
    const name = normalize(projectName);
    if (!name) return;
    const stamp = now();
    if (editingProjectId) {
      await db.runAsync('UPDATE projects SET name = ?, summary = ?, updated_at = ? WHERE id = ?', name, projectSummary.trim(), stamp, editingProjectId);
      await log(`Project updated: ${name}`, 'project');
    } else {
      await db.runAsync('INSERT INTO projects (name, summary, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', name, projectSummary.trim(), 'open', stamp, stamp);
      await log(`Project created: ${name}`, 'project');
    }
    setProjectName('');
    setProjectSummary('');
    setEditingProjectId(null);
    await refreshAll();
  }, [db, editingProjectId, log, projectName, projectSummary, refreshAll]);

  const editProject = (project: ProjectRow) => {
    setProjectName(project.name);
    setProjectSummary(project.summary);
    setEditingProjectId(project.id);
  };

  const deleteProject = useCallback(async (project: ProjectRow) => {
    if (!db) return;
    await db.runAsync('DELETE FROM projects WHERE id = ?', project.id);
    await log(`Project deleted: ${project.name}`, 'project');
    await refreshAll();
  }, [db, log, refreshAll]);

  const toggleProject = useCallback(async (project: ProjectRow) => {
    if (!db) return;
    const nextStatus: Status = project.status === 'open' ? 'done' : 'open';
    await db.runAsync('UPDATE projects SET status = ?, updated_at = ? WHERE id = ?', nextStatus, now(), project.id);
    await log(`${nextStatus === 'done' ? 'Project completed' : 'Project reopened'}: ${project.name}`, 'project');
    await refreshAll();
  }, [db, log, refreshAll]);

  const saveTask = useCallback(async () => {
    if (!db) return;
    const title = normalize(taskTitle);
    if (!title) return;
    const stamp = now();
    if (editingTaskId) {
      await db.runAsync('UPDATE tasks SET title = ?, detail = ?, project_name = ?, updated_at = ? WHERE id = ?', title, taskDetail.trim(), taskProject.trim(), stamp, editingTaskId);
      await log(`Task updated: ${title}`, 'task');
    } else {
      await db.runAsync('INSERT INTO tasks (title, detail, project_name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', title, taskDetail.trim(), taskProject.trim(), 'open', stamp, stamp);
      await log(`Task created: ${title}`, 'task');
    }
    setTaskTitle('');
    setTaskDetail('');
    setTaskProject('');
    setEditingTaskId(null);
    await refreshAll();
  }, [db, editingTaskId, log, refreshAll, taskDetail, taskProject, taskTitle]);

  const editTask = (task: TaskRow) => {
    setTaskTitle(task.title);
    setTaskDetail(task.detail);
    setTaskProject(task.project_name);
    setEditingTaskId(task.id);
  };

  const toggleTask = useCallback(async (task: TaskRow) => {
    if (!db) return;
    const nextStatus: Status = task.status === 'open' ? 'done' : 'open';
    await db.runAsync('UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?', nextStatus, now(), task.id);
    await log(`${nextStatus === 'done' ? 'Task completed' : 'Task reopened'}: ${task.title}`, 'task');
    await refreshAll();
  }, [db, log, refreshAll]);

  const deleteTask = useCallback(async (task: TaskRow) => {
    if (!db) return;
    await db.runAsync('DELETE FROM tasks WHERE id = ?', task.id);
    await log(`Task deleted: ${task.title}`, 'task');
    await refreshAll();
  }, [db, log, refreshAll]);

  const savePrompt = useCallback(async () => {
    if (!db) return;
    const title = normalize(promptTitle);
    const body = promptBody.trim();
    if (!title || !body) return;
    const category = normalize(promptCategory) || 'General';
    const stamp = now();
    if (editingPromptId) {
      await db.runAsync('UPDATE prompts SET title = ?, category = ?, body = ?, updated_at = ? WHERE id = ?', title, category, body, stamp, editingPromptId);
      await log(`Prompt updated: ${title}`, 'prompt');
    } else {
      await db.runAsync('INSERT INTO prompts (title, category, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', title, category, body, stamp, stamp);
      await log(`Prompt saved: ${title}`, 'prompt');
    }
    setPromptTitle('');
    setPromptCategory('General');
    setPromptBody('');
    setEditingPromptId(null);
    await refreshAll();
  }, [db, editingPromptId, log, promptBody, promptCategory, promptTitle, refreshAll]);

  const editPrompt = (prompt: PromptRow) => {
    setPromptTitle(prompt.title);
    setPromptCategory(prompt.category);
    setPromptBody(prompt.body);
    setEditingPromptId(prompt.id);
  };

  const deletePrompt = useCallback(async (prompt: PromptRow) => {
    if (!db) return;
    await db.runAsync('DELETE FROM prompts WHERE id = ?', prompt.id);
    await log(`Prompt deleted: ${prompt.title}`, 'prompt');
    await refreshAll();
  }, [db, log, refreshAll]);

  const saveNote = useCallback(async () => {
    if (!db) return;
    const title = normalize(noteTitle);
    const body = noteBody.trim();
    if (!title || !body) return;
    const stamp = now();
    if (editingNoteId) {
      await db.runAsync('UPDATE notes SET title = ?, body = ?, updated_at = ? WHERE id = ?', title, body, stamp, editingNoteId);
      await log(`Note updated: ${title}`, 'note');
    } else {
      await db.runAsync('INSERT INTO notes (title, body, created_at, updated_at) VALUES (?, ?, ?, ?)', title, body, stamp, stamp);
      await log(`Note saved: ${title}`, 'note');
    }
    setNoteTitle('');
    setNoteBody('');
    setEditingNoteId(null);
    await refreshAll();
  }, [db, editingNoteId, log, noteBody, noteTitle, refreshAll]);

  const editNote = (note: NoteRow) => {
    setNoteTitle(note.title);
    setNoteBody(note.body);
    setEditingNoteId(note.id);
  };

  const deleteNote = useCallback(async (note: NoteRow) => {
    if (!db) return;
    await db.runAsync('DELETE FROM notes WHERE id = ?', note.id);
    await log(`Note deleted: ${note.title}`, 'note');
    await refreshAll();
  }, [db, log, refreshAll]);

  const togglePreference = useCallback(async (key: 'focusMode' | 'connectorReady', value: boolean) => {
    if (key === 'focusMode') setFocusMode(value);
    if (key === 'connectorReady') setConnectorReady(value);
    await upsertPref(key, String(value));
    await log(`${key} set to ${value ? 'on' : 'off'}`, 'setting');
    await refreshAll();
  }, [log, refreshAll, upsertPref]);

  if (booting) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" />
        <View style={styles.loaderWrap}>
          <Text style={styles.loaderTitle}>EvaOneAI</Text>
          <Text style={styles.loaderText}>Loading Layer 1 workspace...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.heroCard}>
          <Text style={styles.eyebrow}>LAYER 1 / LOCAL WORKSPACE</Text>
          <Text style={styles.title}>EvaOneAI</Text>
          <Text style={styles.subtitle}>
            A real mobile and web Expo foundation for projects, tasks, prompts, notes, activity, and settings. Advanced agents can be wired in after the core shell behaves.
          </Text>
        </View>

        <View style={styles.tabsRow}>
          {[
            ['dashboard', 'Dashboard'],
            ['projects', 'Projects'],
            ['tasks', 'Tasks'],
            ['prompts', 'Prompts'],
            ['notes', 'Notes'],
            ['activity', 'Activity'],
            ['settings', 'Settings'],
          ].map(([key, label]) => (
            <Pressable key={key} onPress={() => setActiveTab(key as TabKey)} style={[styles.tabButton, activeTab === key && styles.tabButtonActive]}>
              <Text style={[styles.tabText, activeTab === key && styles.tabTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {activeTab === 'dashboard' && (
          <View style={styles.panel}>
            <SectionHeader title="Command Dashboard" subtitle="Live counts from local data. No fake traction theater." />
            <View style={styles.statsGrid}>
              <StatCard label="Projects" value={String(projects.length)} />
              <StatCard label="Open Tasks" value={String(openTasks.length)} />
              <StatCard label="Prompts" value={String(prompts.length)} />
              <StatCard label="Notes" value={String(notes.length)} />
            </View>
            <View style={styles.callout}>
              <Text style={styles.calloutTitle}>Next layer path</Text>
              <Text style={styles.panelText}>Layer 2 connects Supabase sync. Layer 3 adds AI gateway. Layer 4 adds real app integrations with approval logs.</Text>
            </View>
            <View style={styles.buttonRow}>
              <PrimaryButton label="Add project" onPress={() => setActiveTab('projects')} />
              <SecondaryButton label="Save prompt" onPress={() => setActiveTab('prompts')} />
              <SecondaryButton label="Open tasks" onPress={() => setActiveTab('tasks')} />
            </View>
          </View>
        )}

        {activeTab === 'projects' && (
          <View style={styles.panel}>
            <SectionHeader title="Projects" subtitle="Create the work containers EvaOneAI will eventually orchestrate." />
            <TextInput value={projectName} onChangeText={setProjectName} placeholder="Project name" placeholderTextColor={palette.muted} style={styles.input} />
            <TextInput value={projectSummary} onChangeText={setProjectSummary} placeholder="Project summary" placeholderTextColor={palette.muted} multiline style={styles.textAreaSmall} />
            <View style={styles.buttonRow}>
              <PrimaryButton label={editingProjectId ? 'Update project' : 'Create project'} onPress={saveProject} />
              {editingProjectId ? <SecondaryButton label="Cancel edit" onPress={() => { setEditingProjectId(null); setProjectName(''); setProjectSummary(''); }} /> : null}
            </View>
            {projects.length === 0 ? <EmptyState text="No projects yet. Create one and stop letting ideas wander unsupervised." /> : null}
            {projects.map((project) => (
              <View key={project.id} style={styles.listCard}>
                <Text style={styles.listCardTitle}>{project.name}</Text>
                {project.summary ? <Text style={styles.panelText}>{project.summary}</Text> : null}
                <Text style={styles.metaText}>{project.status.toUpperCase()} • Updated {formatDate(project.updated_at)}</Text>
                <View style={styles.buttonRowCompact}>
                  <SecondaryButton label="Edit" onPress={() => editProject(project)} />
                  <SecondaryButton label={project.status === 'open' ? 'Complete' : 'Reopen'} onPress={() => toggleProject(project)} />
                  <DangerButton label="Delete" onPress={() => deleteProject(project)} />
                </View>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'tasks' && (
          <View style={styles.panel}>
            <SectionHeader title="Tasks" subtitle="Capture actions, connect them to projects, and close loops." />
            <TextInput value={taskTitle} onChangeText={setTaskTitle} placeholder="Task title" placeholderTextColor={palette.muted} style={styles.input} />
            <TextInput value={taskProject} onChangeText={setTaskProject} placeholder="Related project name" placeholderTextColor={palette.muted} style={styles.input} />
            <TextInput value={taskDetail} onChangeText={setTaskDetail} placeholder="Task details" placeholderTextColor={palette.muted} multiline style={styles.textAreaSmall} />
            <View style={styles.buttonRow}>
              <PrimaryButton label={editingTaskId ? 'Update task' : 'Create task'} onPress={saveTask} />
              {editingTaskId ? <SecondaryButton label="Cancel edit" onPress={() => { setEditingTaskId(null); setTaskTitle(''); setTaskProject(''); setTaskDetail(''); }} /> : null}
            </View>
            <Text style={styles.listHeading}>Open</Text>
            {openTasks.length === 0 ? <EmptyState text="No open tasks." /> : null}
            {openTasks.map((task) => <TaskCard key={task.id} task={task} onEdit={() => editTask(task)} onToggle={() => toggleTask(task)} onDelete={() => deleteTask(task)} />)}
            <Text style={styles.listHeading}>Completed</Text>
            {doneTasks.length === 0 ? <EmptyState text="No completed tasks yet." /> : null}
            {doneTasks.map((task) => <TaskCard key={task.id} task={task} onEdit={() => editTask(task)} onToggle={() => toggleTask(task)} onDelete={() => deleteTask(task)} />)}
          </View>
        )}

        {activeTab === 'prompts' && (
          <View style={styles.panel}>
            <SectionHeader title="Prompt Library" subtitle="Save reusable prompts so the workflow does not depend on archaeological memory." />
            <TextInput value={promptSearch} onChangeText={setPromptSearch} placeholder="Search prompts" placeholderTextColor={palette.muted} style={styles.input} />
            <TextInput value={promptTitle} onChangeText={setPromptTitle} placeholder="Prompt title" placeholderTextColor={palette.muted} style={styles.input} />
            <TextInput value={promptCategory} onChangeText={setPromptCategory} placeholder="Category" placeholderTextColor={palette.muted} style={styles.input} />
            <TextInput value={promptBody} onChangeText={setPromptBody} placeholder="Prompt body" placeholderTextColor={palette.muted} multiline style={styles.textArea} />
            <View style={styles.buttonRow}>
              <PrimaryButton label={editingPromptId ? 'Update prompt' : 'Save prompt'} onPress={savePrompt} />
              {editingPromptId ? <SecondaryButton label="Cancel edit" onPress={() => { setEditingPromptId(null); setPromptTitle(''); setPromptCategory('General'); setPromptBody(''); }} /> : null}
            </View>
            {filteredPrompts.length === 0 ? <EmptyState text="No prompts match yet." /> : null}
            {filteredPrompts.map((prompt) => (
              <View key={prompt.id} style={styles.listCard}>
                <Text style={styles.listCardTitle}>{prompt.title}</Text>
                <Text style={styles.metaText}>{prompt.category.toUpperCase()} • Updated {formatDate(prompt.updated_at)}</Text>
                <Text style={styles.panelText}>{prompt.body}</Text>
                <View style={styles.buttonRowCompact}>
                  <SecondaryButton label="Edit" onPress={() => editPrompt(prompt)} />
                  <DangerButton label="Delete" onPress={() => deletePrompt(prompt)} />
                </View>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'notes' && (
          <View style={styles.panel}>
            <SectionHeader title="Notes" subtitle="Store working context, client decisions, and build details locally." />
            <TextInput value={noteTitle} onChangeText={setNoteTitle} placeholder="Note title" placeholderTextColor={palette.muted} style={styles.input} />
            <TextInput value={noteBody} onChangeText={setNoteBody} placeholder="Note body" placeholderTextColor={palette.muted} multiline style={styles.textArea} />
            <View style={styles.buttonRow}>
              <PrimaryButton label={editingNoteId ? 'Update note' : 'Save note'} onPress={saveNote} />
              {editingNoteId ? <SecondaryButton label="Cancel edit" onPress={() => { setEditingNoteId(null); setNoteTitle(''); setNoteBody(''); }} /> : null}
            </View>
            {notes.length === 0 ? <EmptyState text="No notes saved yet." /> : null}
            {notes.map((note) => (
              <View key={note.id} style={styles.listCard}>
                <Text style={styles.listCardTitle}>{note.title}</Text>
                <Text style={styles.metaText}>Updated {formatDate(note.updated_at)}</Text>
                <Text style={styles.panelText}>{note.body}</Text>
                <View style={styles.buttonRowCompact}>
                  <SecondaryButton label="Edit" onPress={() => editNote(note)} />
                  <DangerButton label="Delete" onPress={() => deleteNote(note)} />
                </View>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'activity' && (
          <View style={styles.panel}>
            <SectionHeader title="Activity Log" subtitle="A visible trail of what changed. Revolutionary, apparently." />
            {logs.length === 0 ? <EmptyState text="No activity yet." /> : null}
            {logs.map((entry) => (
              <View key={entry.id} style={styles.logCard}>
                <Text style={styles.logKind}>{entry.kind.toUpperCase()}</Text>
                <Text style={styles.listCardTitle}>{entry.entry}</Text>
                <Text style={styles.metaText}>{formatDate(entry.created_at)}</Text>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'settings' && (
          <View style={styles.panel}>
            <SectionHeader title="Settings" subtitle="Layer controls for the local MVP shell." />
            <ToggleCard title="Focus mode" body="Keeps the app aimed at projects, tasks, and stored context." value={focusMode} onValueChange={(value) => togglePreference('focusMode', value)} />
            <ToggleCard title="Connector-ready mode" body="Marks this workspace as prepared for future Supabase, AI gateway, and app integrations. It does not fake access." value={connectorReady} onValueChange={(value) => togglePreference('connectorReady', value)} />
            <View style={styles.callout}>
              <Text style={styles.calloutTitle}>Current build layer</Text>
              <Text style={styles.panelText}>Layer 1 is local-first. It stores data on device/browser runtime through Expo SQLite. Next layers should add auth, sync, AI routing, and integration permissions.</Text>
            </View>
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

function EmptyState({ text }: { text: string }) {
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.panelText}>{text}</Text>
    </View>
  );
}

function TaskCard({ task, onEdit, onToggle, onDelete }: { task: TaskRow; onEdit: () => void; onToggle: () => void; onDelete: () => void }) {
  return (
    <View style={styles.listCard}>
      <Text style={styles.listCardTitle}>{task.title}</Text>
      {task.project_name ? <Text style={styles.metaText}>PROJECT • {task.project_name}</Text> : null}
      {task.detail ? <Text style={styles.panelText}>{task.detail}</Text> : null}
      <Text style={styles.metaText}>{task.status.toUpperCase()} • Updated {formatDate(task.updated_at)}</Text>
      <View style={styles.buttonRowCompact}>
        <SecondaryButton label="Edit" onPress={onEdit} />
        <SecondaryButton label={task.status === 'open' ? 'Complete' : 'Reopen'} onPress={onToggle} />
        <DangerButton label="Delete" onPress={onDelete} />
      </View>
    </View>
  );
}

function ToggleCard({ title, body, value, onValueChange }: { title: string; body: string; value: boolean; onValueChange: (value: boolean) => void | Promise<void> }) {
  return (
    <View style={styles.toggleCard}>
      <View style={styles.toggleCopy}>
        <Text style={styles.toggleTitle}>{title}</Text>
        <Text style={styles.panelText}>{body}</Text>
      </View>
      <Switch value={value} onValueChange={(next) => void onValueChange(next)} />
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

function DangerButton({ label, onPress }: { label: string; onPress: () => void | Promise<void> }) {
  return (
    <Pressable style={styles.dangerButton} onPress={() => void onPress()}>
      <Text style={styles.dangerButtonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.bg },
  container: { padding: 16, paddingBottom: 36, gap: 16 },
  loaderWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: palette.bg },
  loaderTitle: { color: palette.text, fontSize: 30, fontWeight: '900' },
  loaderText: { color: palette.muted, marginTop: 8, fontSize: 15 },
  heroCard: { backgroundColor: palette.panel, borderWidth: 1, borderColor: palette.border, borderRadius: 26, padding: 18, gap: 10 },
  eyebrow: { color: palette.cyan, fontSize: 11, letterSpacing: 1.4, fontWeight: '800' },
  title: { color: palette.text, fontSize: 34, fontWeight: '900' },
  subtitle: { color: palette.muted, fontSize: 15, lineHeight: 22 },
  tabsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tabButton: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, backgroundColor: palette.panelAlt, borderWidth: 1, borderColor: palette.border },
  tabButtonActive: { backgroundColor: 'rgba(6, 182, 212, 0.16)', borderColor: 'rgba(6, 182, 212, 0.42)' },
  tabText: { color: palette.muted, fontWeight: '800', fontSize: 13 },
  tabTextActive: { color: palette.text },
  panel: { backgroundColor: palette.panel, borderRadius: 24, padding: 18, borderWidth: 1, borderColor: palette.border, gap: 14 },
  sectionHeader: { gap: 6 },
  panelTitle: { color: palette.text, fontSize: 22, fontWeight: '900' },
  panelText: { color: palette.muted, fontSize: 14, lineHeight: 20 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: { minWidth: '46%', flex: 1, backgroundColor: palette.panelAlt, borderWidth: 1, borderColor: palette.border, borderRadius: 18, padding: 14, gap: 6 },
  statValue: { color: palette.text, fontSize: 24, fontWeight: '900' },
  statLabel: { color: palette.muted, fontSize: 12, fontWeight: '700' },
  callout: { backgroundColor: 'rgba(124, 58, 237, 0.13)', borderWidth: 1, borderColor: palette.border, borderRadius: 18, padding: 14, gap: 6 },
  calloutTitle: { color: palette.text, fontSize: 15, fontWeight: '900' },
  input: { backgroundColor: palette.panelAlt, borderWidth: 1, borderColor: palette.border, borderRadius: 16, color: palette.text, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  textArea: { minHeight: 150, textAlignVertical: 'top', backgroundColor: palette.panelAlt, borderWidth: 1, borderColor: palette.border, borderRadius: 16, color: palette.text, paddingHorizontal: 14, paddingVertical: 14, fontSize: 15 },
  textAreaSmall: { minHeight: 90, textAlignVertical: 'top', backgroundColor: palette.panelAlt, borderWidth: 1, borderColor: palette.border, borderRadius: 16, color: palette.text, paddingHorizontal: 14, paddingVertical: 14, fontSize: 15 },
  buttonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  buttonRowCompact: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  primaryButton: { backgroundColor: palette.cyan, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14 },
  primaryButtonText: { color: '#031018', fontWeight: '900', fontSize: 14 },
  secondaryButton: { borderWidth: 1, borderColor: palette.border, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, backgroundColor: 'rgba(234, 242, 255, 0.03)' },
  secondaryButtonText: { color: palette.text, fontWeight: '800', fontSize: 13 },
  dangerButton: { borderWidth: 1, borderColor: 'rgba(251, 113, 133, 0.45)', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, backgroundColor: 'rgba(251, 113, 133, 0.08)' },
  dangerButtonText: { color: palette.danger, fontWeight: '900', fontSize: 13 },
  listHeading: { color: palette.violet, fontSize: 13, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.2, marginTop: 2 },
  listCard: { backgroundColor: palette.panelAlt, borderWidth: 1, borderColor: palette.border, borderRadius: 18, padding: 14, gap: 8 },
  listCardTitle: { color: palette.text, fontSize: 16, lineHeight: 22, fontWeight: '900' },
  metaText: { color: palette.muted, fontSize: 12, fontWeight: '700' },
  emptyCard: { borderRadius: 18, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.panelAlt, padding: 14 },
  logCard: { backgroundColor: palette.panelAlt, borderWidth: 1, borderColor: palette.border, borderRadius: 18, padding: 14, gap: 8 },
  logKind: { color: palette.green, fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  toggleCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 16, backgroundColor: palette.panelAlt, borderWidth: 1, borderColor: palette.border, borderRadius: 18, padding: 14 },
  toggleCopy: { flex: 1, gap: 6 },
  toggleTitle: { color: palette.text, fontSize: 15, fontWeight: '900' },
});
