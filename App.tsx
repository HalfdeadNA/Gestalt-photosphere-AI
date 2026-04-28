import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as SQLite from 'expo-sqlite';

type MainTab = 'home' | 'studio' | 'museum' | 'market' | 'academy' | 'more';
type MoreScreen =
  | 'projects'
  | 'galleryBuilder'
  | 'competitions'
  | 'creatorDashboard'
  | 'creationLog'
  | 'creativeMemory'
  | 'controlCenter'
  | 'assistant';

type ProjectStatus = 'Idea' | 'Draft' | 'In Progress' | 'Ready to Publish' | 'Listed' | 'Archived';
type ListingStatus = 'Draft Mode' | 'Ready for Review';

type CreativeProject = {
  id: string;
  title: string;
  type: string;
  status: ProjectStatus;
  description: string;
  prompt: string;
  enhancedPrompt: string;
  style: string;
  dimensionMode: string;
  notes: string;
  assets: string;
  marketplaceStatus: string;
  galleryStatus: string;
  createdAt: string;
  updatedAt: string;
};

type MuseumRoom = {
  id: string;
  name: string;
  theme: string;
  wallSurface: string;
  ceilingSurface: string;
  floorSurface: string;
  doorwaySurface: string;
  artworkIds: string;
  curatorNote: string;
  createdAt: string;
};

type Gallery = {
  id: string;
  title: string;
  description: string;
  theme: string;
  projectIds: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type MarketplaceListing = {
  id: string;
  projectId: string;
  title: string;
  description: string;
  price: number;
  licenseType: string;
  royaltyPercent: number;
  category: string;
  tags: string;
  status: ListingStatus;
  createdAt: string;
};

type AcademyCourse = {
  id: string;
  title: string;
  description: string;
  category: string;
  lessons: string;
  progress: number;
};

type CompetitionEntry = {
  id: string;
  competitionType: string;
  projectId: string;
  title: string;
  status: string;
  prizeField: string;
  judgingCriteria: string;
  submittedAt: string;
};

type CreationLog = {
  id: string;
  type: string;
  message: string;
  relatedId: string;
  createdAt: string;
};

type CreativeMemory = {
  id: string;
  memKey: string;
  value: string;
  category: string;
  createdAt: string;
  updatedAt: string;
};

type CreativeBrief = {
  title: string;
  enhancedPrompt: string;
  styleDirection: string;
  dimensionMode: string;
  museumPlacement: string;
  listingDescription: string;
  tags: string[];
  nextSteps: string[];
};

const dbName = 'gestalt_visions.db';

const palette = {
  bg: '#060915',
  panel: 'rgba(18, 25, 44, 0.82)',
  panelSolid: '#0e1528',
  border: 'rgba(83, 202, 255, 0.28)',
  text: '#EBF7FF',
  muted: '#9FB1D6',
  cyan: '#3BE7FF',
  violet: '#9B5CFF',
  aurora: '#F774FF',
  green: '#3EE58C',
  amber: '#F6C45F',
  danger: '#FF6D7E',
};

const roomThemes = ['Liquid Canvas', 'Neon Museum', 'Aurora Glass', 'Synthwave Reality', 'Dark Luxury'];
const surfaces = [
  'obsidian wall',
  'neon grid ceiling',
  'deep ocean floor',
  'crystal doorway',
  'white cube',
  'aurora glass',
  'liquid canvas',
  'chrome void',
  'cosmic archive',
  'gothic synthwave',
];
const galleryThemes = [
  'Liquid Canvas',
  'Neon Museum',
  'Dark Luxury',
  'White Cube',
  'Corpse Bride Gothic',
  'Synthwave Reality',
  'Aurora Glass',
  'Cyber Ritual',
  'Minimal Founder Deck',
  'Experimental Spatial CMS',
];
const licenseTypes = [
  'Personal Use',
  'Commercial Use',
  'Exclusive Sale',
  'Lease with Royalties',
  'Gallery Display License',
  'Educational Use',
];
const competitionTypes = ['Daily Spark', 'Weekly Battle', 'Monthly Gauntlet', 'Yearly Gala'];

const aiProvider = {
  name: 'LocalCreativeProvider',
  isConnected: false,
  generateCreativeBrief(prompt: string, style = 'Cinematic Neon'): CreativeBrief {
    const p = prompt.trim() || 'Immersive creative concept';
    const lc = p.toLowerCase();
    const gothic = lc.includes('gothic');
    const museumPlacement = lc.includes('museum') ? 'Neon Atrium' : 'The Liquid Canvas Hall';
    const mode = lc.includes('3d') || lc.includes('room') ? '3D/XVR' : '2D/Concept';
    return {
      title: gothic ? 'Gothic Neon Reliquary' : `Gestalt ${p.split(' ').slice(0, 3).join(' ')}`,
      enhancedPrompt:
        gothic
          ? 'A dark immersive museum chamber with gothic arches, neon cyan and violet rim lighting, reflective obsidian floor, floating digital canvases, soft fog, and cinematic depth.'
          : `Create a premium immersive scene for: ${p}. Use layered lighting, reflective materials, narrative composition, and museum-grade atmosphere.`,
      styleDirection: gothic ? 'Corpse Bride Gothic + Synthwave Reality' : `${style} + Aurora Glass`,
      dimensionMode: mode,
      museumPlacement,
      listingDescription: `Creative brief prepared for “${p}”. This concept is structured for gallery deployment and marketplace-ready storytelling copy.`,
      tags: gothic ? ['gothic', 'neon', 'immersive', 'digital museum', 'synthwave'] : ['creative', 'immersive', 'gallery', 'ai-assisted', 'gestalt'],
      nextSteps: ['Save as project', 'Add to museum room', 'Create gallery draft', 'Prepare marketplace listing'],
    };
  },
};

const now = () => new Date().toISOString();
const id = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const parseIds = (value: string) => value.split(',').map((part) => part.trim()).filter(Boolean);

export default function App() {
  const [db, setDb] = useState<SQLite.SQLiteDatabase | null>(null);
  const [booting, setBooting] = useState(true);
  const [activeTab, setActiveTab] = useState<MainTab>('home');
  const [moreScreen, setMoreScreen] = useState<MoreScreen>('projects');

  const [projects, setProjects] = useState<CreativeProject[]>([]);
  const [rooms, setRooms] = useState<MuseumRoom[]>([]);
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [courses, setCourses] = useState<AcademyCourse[]>([]);
  const [entries, setEntries] = useState<CompetitionEntry[]>([]);
  const [logs, setLogs] = useState<CreationLog[]>([]);
  const [memory, setMemory] = useState<CreativeMemory[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});

  const [projectTitle, setProjectTitle] = useState('');
  const [projectPrompt, setProjectPrompt] = useState('');
  const [projectStyle, setProjectStyle] = useState('Cinematic Neon');
  const [projectType, setProjectType] = useState('2D image concept');
  const [projectDim, setProjectDim] = useState('2D');
  const [brief, setBrief] = useState<CreativeBrief | null>(null);

  const [roomName, setRoomName] = useState('');
  const [roomTheme, setRoomTheme] = useState(roomThemes[0]);
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [roomArtworkId, setRoomArtworkId] = useState('');

  const [galleryTitle, setGalleryTitle] = useState('');
  const [galleryDescription, setGalleryDescription] = useState('');
  const [galleryTheme, setGalleryTheme] = useState(galleryThemes[0]);
  const [galleryProjectId, setGalleryProjectId] = useState('');

  const [listingProjectId, setListingProjectId] = useState('');
  const [listingTitle, setListingTitle] = useState('');
  const [listingDescription, setListingDescription] = useState('');
  const [listingPrice, setListingPrice] = useState('120');
  const [listingLicense, setListingLicense] = useState(licenseTypes[1]);

  const [memoryKey, setMemoryKey] = useState('');
  const [memoryValue, setMemoryValue] = useState('');
  const [memoryCategory, setMemoryCategory] = useState('style');

  const [assistantInput, setAssistantInput] = useState('');
  const [assistantOutput, setAssistantOutput] = useState('');

  const [jsonBuffer, setJsonBuffer] = useState('');

  const activeProjects = useMemo(() => projects.filter((p) => p.status !== 'Archived').length, [projects]);

  const logEvent = useCallback(async (type: string, message: string, relatedId = '') => {
    if (!db) return;
    await db.runAsync('INSERT INTO creation_logs (id, type, message, relatedId, createdAt) VALUES (?, ?, ?, ?, ?)', id(), type, message, relatedId, now());
  }, [db]);

  const refresh = useCallback(async () => {
    if (!db) return;
    setProjects(await db.getAllAsync<CreativeProject>('SELECT * FROM creative_projects ORDER BY updatedAt DESC'));
    setRooms(await db.getAllAsync<MuseumRoom>('SELECT * FROM museum_rooms ORDER BY createdAt DESC'));
    setGalleries(await db.getAllAsync<Gallery>('SELECT * FROM galleries ORDER BY updatedAt DESC'));
    setListings(await db.getAllAsync<MarketplaceListing>('SELECT * FROM marketplace_listings ORDER BY createdAt DESC'));
    setCourses(await db.getAllAsync<AcademyCourse>('SELECT * FROM academy_courses ORDER BY title ASC'));
    setEntries(await db.getAllAsync<CompetitionEntry>('SELECT * FROM competition_entries ORDER BY submittedAt DESC'));
    setLogs(await db.getAllAsync<CreationLog>('SELECT * FROM creation_logs ORDER BY createdAt DESC LIMIT 80'));
    setMemory(await db.getAllAsync<CreativeMemory>('SELECT * FROM creative_memory ORDER BY updatedAt DESC'));
    const prefRows = await db.getAllAsync<{ prefKey: string; prefValue: string }>('SELECT * FROM control_center');
    setSettings(Object.fromEntries(prefRows.map((row) => [row.prefKey, row.prefValue])));
  }, [db]);

  const seedDefaults = useCallback(async (database: SQLite.SQLiteDatabase) => {
    const count = await database.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM creative_projects');
    if ((count?.count ?? 0) > 0) return;

    const seedProjects: Omit<CreativeProject, 'updatedAt'>[] = [
      { id: id(), title: 'Liquid Canvas Artifact', type: '3D artifact concept', status: 'Draft', description: 'Reflective sculptural relic for immersive hall.', prompt: 'Liquid canvas artifact with cinematic rim light', enhancedPrompt: 'Cinematic relic floating in liquid-canvas chamber.', style: 'Liquid Canvas', dimensionMode: '3D/XVR', notes: 'Use obsidian floor reflections.', assets: 'none', marketplaceStatus: 'Not listed', galleryStatus: 'Not added', createdAt: now() },
      { id: id(), title: 'Neon Museum Entrance', type: 'museum installation', status: 'In Progress', description: 'Hero entrance with neon arches.', prompt: 'Futuristic neon museum entry portal', enhancedPrompt: 'Grand neon atrium gateway with cyan-violet lines.', style: 'Neon Museum', dimensionMode: '3D/XVR', notes: 'Add fog pass.', assets: 'none', marketplaceStatus: 'Not listed', galleryStatus: 'In room', createdAt: now() },
      { id: id(), title: 'Aurora Glass Gallery', type: 'immersive gallery room', status: 'Draft', description: 'Glass-prism ambient room with aurora highlights.', prompt: 'Aurora glass immersive room', enhancedPrompt: 'Prismatic gallery room with aurora reflections.', style: 'Aurora Glass', dimensionMode: '3D/XVR', notes: 'Great for abstract sets.', assets: 'none', marketplaceStatus: 'Draft', galleryStatus: 'In gallery', createdAt: now() },
      { id: id(), title: 'Gothic Synthwave Portrait', type: '2D image concept', status: 'Ready to Publish', description: 'Dark portrait with synthwave palette.', prompt: 'Gothic neon portrait with dramatic lighting', enhancedPrompt: 'Portrait with gothic silhouettes and synthwave color contrast.', style: 'Corpse Bride Gothic + Synthwave Reality', dimensionMode: '2D', notes: 'Ready for listing.', assets: 'none', marketplaceStatus: 'Draft', galleryStatus: 'In room', createdAt: now() },
      { id: id(), title: 'Spatial CMS Demo Room', type: 'photosphere scene', status: 'Idea', description: 'Demo environment for modular layout.', prompt: 'Spatial CMS inspired modular creative room', enhancedPrompt: 'Modular nodes and floating UI in a cinematic room.', style: 'Experimental Spatial CMS', dimensionMode: '3D/XVR', notes: 'Use for pitch.', assets: 'none', marketplaceStatus: 'Not listed', galleryStatus: 'Not added', createdAt: now() },
    ];

    for (const project of seedProjects) {
      await database.runAsync(
        `INSERT INTO creative_projects (id, title, type, status, description, prompt, enhancedPrompt, style, dimensionMode, notes, assets, marketplaceStatus, galleryStatus, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        project.id,
        project.title,
        project.type,
        project.status,
        project.description,
        project.prompt,
        project.enhancedPrompt,
        project.style,
        project.dimensionMode,
        project.notes,
        project.assets,
        project.marketplaceStatus,
        project.galleryStatus,
        project.createdAt,
        project.createdAt
      );
    }

    const roomSeeds: MuseumRoom[] = [
      { id: id(), name: 'The Liquid Canvas Hall', theme: 'Liquid Canvas', wallSurface: 'liquid canvas', ceilingSurface: 'neon grid ceiling', floorSurface: 'obsidian wall', doorwaySurface: 'crystal doorway', artworkIds: '', curatorNote: 'Flow-state textures and reflective stories.', createdAt: now() },
      { id: id(), name: 'The Neon Atrium', theme: 'Neon Museum', wallSurface: 'obsidian wall', ceilingSurface: 'neon grid ceiling', floorSurface: 'chrome void', doorwaySurface: 'aurora glass', artworkIds: '', curatorNote: 'Best for cyber-futurist narratives.', createdAt: now() },
      { id: id(), name: 'The Aurora Archive', theme: 'Aurora Glass', wallSurface: 'aurora glass', ceilingSurface: 'cosmic archive', floorSurface: 'deep ocean floor', doorwaySurface: 'white cube', artworkIds: '', curatorNote: 'Showcases premium prismatic collections.', createdAt: now() },
    ];
    for (const room of roomSeeds) {
      await database.runAsync(
        'INSERT INTO museum_rooms (id, name, theme, wallSurface, ceilingSurface, floorSurface, doorwaySurface, artworkIds, curatorNote, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        room.id,
        room.name,
        room.theme,
        room.wallSurface,
        room.ceilingSurface,
        room.floorSurface,
        room.doorwaySurface,
        room.artworkIds,
        room.curatorNote,
        room.createdAt
      );
    }

    const courseSeeds: AcademyCourse[] = [
      { id: id(), title: 'AI Art Basics', description: 'Foundations for modern creator workflows.', category: 'AI Art Basics', lessons: 'Prompt inputs, style control, outputs', progress: 15 },
      { id: id(), title: 'Prompt Craft for Visual Creators', description: 'Structure prompts for premium results.', category: 'Prompt Craft', lessons: 'Intent, constraints, mood, detail', progress: 0 },
      { id: id(), title: 'Building Your First Immersive Gallery', description: 'From project to gallery publishing flow.', category: 'Building Immersive Galleries', lessons: 'Room design, curation, sequencing', progress: 30 },
      { id: id(), title: 'Marketplace Listing Strategy', description: 'Positioning, copy, licensing and royalties.', category: 'Marketplace Selling', lessons: 'Pricing, tags, trust signals', progress: 40 },
      { id: id(), title: 'Creative Business Foundations', description: 'Monetization and repeatable creator systems.', category: 'Creative Business', lessons: 'Offers, packages, client value', progress: 5 },
    ];

    for (const c of courseSeeds) {
      await database.runAsync(
        'INSERT INTO academy_courses (id, title, description, category, lessons, progress) VALUES (?, ?, ?, ?, ?, ?)',
        c.id,
        c.title,
        c.description,
        c.category,
        c.lessons,
        c.progress
      );
    }

    for (const c of competitionTypes) {
      await database.runAsync(
        'INSERT INTO competition_entries (id, competitionType, projectId, title, status, prizeField, judgingCriteria, submittedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        id(),
        c,
        '',
        `${c} Example`,
        'Open',
        c === 'Yearly Gala' ? '1500 Credits' : '100 Credits',
        'Originality, narrative, craft quality',
        now()
      );
    }

    await database.runAsync('INSERT INTO control_center (prefKey, prefValue) VALUES (?, ?)', 'aiAccess', 'enabled');
    await database.runAsync('INSERT INTO control_center (prefKey, prefValue) VALUES (?, ?)', 'memoryMode', 'editable');
    await database.runAsync('INSERT INTO control_center (prefKey, prefValue) VALUES (?, ?)', 'marketplacePermissions', 'draft-only');
    await database.runAsync('INSERT INTO creation_logs (id, type, message, relatedId, createdAt) VALUES (?, ?, ?, ?, ?)', id(), 'system', 'Gestalt Visions initialized with starter content.', '', now());
  }, []);

  useEffect(() => {
    const boot = async () => {
      const database = await SQLite.openDatabaseAsync(dbName);
      await database.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS creative_projects (
          id TEXT PRIMARY KEY NOT NULL,
          title TEXT NOT NULL,
          type TEXT NOT NULL,
          status TEXT NOT NULL,
          description TEXT NOT NULL,
          prompt TEXT NOT NULL,
          enhancedPrompt TEXT NOT NULL,
          style TEXT NOT NULL,
          dimensionMode TEXT NOT NULL,
          notes TEXT NOT NULL,
          assets TEXT NOT NULL,
          marketplaceStatus TEXT NOT NULL,
          galleryStatus TEXT NOT NULL,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS museum_rooms (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          theme TEXT NOT NULL,
          wallSurface TEXT NOT NULL,
          ceilingSurface TEXT NOT NULL,
          floorSurface TEXT NOT NULL,
          doorwaySurface TEXT NOT NULL,
          artworkIds TEXT NOT NULL,
          curatorNote TEXT NOT NULL,
          createdAt TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS galleries (
          id TEXT PRIMARY KEY NOT NULL,
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          theme TEXT NOT NULL,
          projectIds TEXT NOT NULL,
          status TEXT NOT NULL,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS marketplace_listings (
          id TEXT PRIMARY KEY NOT NULL,
          projectId TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          price REAL NOT NULL,
          licenseType TEXT NOT NULL,
          royaltyPercent INTEGER NOT NULL,
          category TEXT NOT NULL,
          tags TEXT NOT NULL,
          status TEXT NOT NULL,
          createdAt TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS academy_courses (
          id TEXT PRIMARY KEY NOT NULL,
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          category TEXT NOT NULL,
          lessons TEXT NOT NULL,
          progress INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS competition_entries (
          id TEXT PRIMARY KEY NOT NULL,
          competitionType TEXT NOT NULL,
          projectId TEXT NOT NULL,
          title TEXT NOT NULL,
          status TEXT NOT NULL,
          prizeField TEXT NOT NULL,
          judgingCriteria TEXT NOT NULL,
          submittedAt TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS creation_logs (
          id TEXT PRIMARY KEY NOT NULL,
          type TEXT NOT NULL,
          message TEXT NOT NULL,
          relatedId TEXT NOT NULL,
          createdAt TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS creative_memory (
          id TEXT PRIMARY KEY NOT NULL,
          memKey TEXT NOT NULL,
          value TEXT NOT NULL,
          category TEXT NOT NULL,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS control_center (
          prefKey TEXT PRIMARY KEY NOT NULL,
          prefValue TEXT NOT NULL
        );
      `);
      await seedDefaults(database);
      setDb(database);
    };
    boot().catch((e) => Alert.alert('Startup Error', e.message));
  }, [seedDefaults]);

  useEffect(() => {
    if (!db) return;
    refresh()
      .catch((e) => Alert.alert('Load Error', e.message))
      .finally(() => setBooting(false));
  }, [db, refresh]);

  const createProjectFromBrief = useCallback(async () => {
    if (!db || !brief) return;
    const stamp = now();
    const row: CreativeProject = {
      id: id(),
      title: projectTitle.trim() || brief.title,
      type: projectType,
      status: 'Draft',
      description: brief.listingDescription,
      prompt: projectPrompt,
      enhancedPrompt: brief.enhancedPrompt,
      style: brief.styleDirection,
      dimensionMode: brief.dimensionMode,
      notes: brief.nextSteps.join(' | '),
      assets: 'local-brief-only',
      marketplaceStatus: 'Draft',
      galleryStatus: 'Not added',
      createdAt: stamp,
      updatedAt: stamp,
    };
    await db.runAsync(
      'INSERT INTO creative_projects (id, title, type, status, description, prompt, enhancedPrompt, style, dimensionMode, notes, assets, marketplaceStatus, galleryStatus, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      row.id,
      row.title,
      row.type,
      row.status,
      row.description,
      row.prompt,
      row.enhancedPrompt,
      row.style,
      row.dimensionMode,
      row.notes,
      row.assets,
      row.marketplaceStatus,
      row.galleryStatus,
      row.createdAt,
      row.updatedAt
    );
    await logEvent('project', `Project created from AI Studio: ${row.title}`, row.id);
    await refresh();
    Alert.alert('Saved', 'Creative brief prepared and saved as project.');
  }, [db, brief, projectTitle, projectType, projectPrompt, logEvent, refresh]);

  const deleteProject = useCallback(async (row: CreativeProject) => {
    if (!db) return;
    await db.runAsync('DELETE FROM creative_projects WHERE id = ?', row.id);
    await logEvent('project', `Project deleted: ${row.title}`, row.id);
    await refresh();
  }, [db, logEvent, refresh]);

  const saveRoom = useCallback(async () => {
    if (!db) return;
    const name = roomName.trim();
    if (!name) return;
    await db.runAsync(
      'INSERT INTO museum_rooms (id, name, theme, wallSurface, ceilingSurface, floorSurface, doorwaySurface, artworkIds, curatorNote, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      id(),
      name,
      roomTheme,
      'obsidian wall',
      'neon grid ceiling',
      'deep ocean floor',
      'crystal doorway',
      '',
      'Curator note prepared locally by Gestalt Intelligence Core.',
      now()
    );
    setRoomName('');
    await logEvent('museum', `Museum room created: ${name}`);
    await refresh();
  }, [db, roomName, roomTheme, logEvent, refresh]);

  const addArtworkToRoom = useCallback(async () => {
    if (!db || !selectedRoomId || !roomArtworkId.trim()) return;
    const room = rooms.find((r) => r.id === selectedRoomId);
    if (!room) return;
    const ids = new Set(parseIds(room.artworkIds));
    ids.add(roomArtworkId.trim());
    await db.runAsync('UPDATE museum_rooms SET artworkIds = ? WHERE id = ?', [...ids].join(', '), room.id);
    await logEvent('museum', `Artwork linked to room ${room.name}`, room.id);
    setRoomArtworkId('');
    await refresh();
  }, [db, selectedRoomId, roomArtworkId, rooms, logEvent, refresh]);

  const createGallery = useCallback(async () => {
    if (!db || !galleryTitle.trim()) return;
    const stamp = now();
    await db.runAsync(
      'INSERT INTO galleries (id, title, description, theme, projectIds, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      id(),
      galleryTitle.trim(),
      galleryDescription.trim(),
      galleryTheme,
      galleryProjectId.trim(),
      'Draft',
      stamp,
      stamp
    );
    await logEvent('gallery', `Gallery draft created: ${galleryTitle.trim()}`);
    setGalleryTitle('');
    setGalleryDescription('');
    setGalleryProjectId('');
    await refresh();
  }, [db, galleryTitle, galleryDescription, galleryTheme, galleryProjectId, logEvent, refresh]);

  const createListing = useCallback(async () => {
    if (!db || !listingTitle.trim()) return;
    await db.runAsync(
      'INSERT INTO marketplace_listings (id, projectId, title, description, price, licenseType, royaltyPercent, category, tags, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      id(),
      listingProjectId.trim(),
      listingTitle.trim(),
      listingDescription.trim(),
      Number(listingPrice) || 0,
      listingLicense,
      12,
      'Digital Art',
      'immersive,ai,gestalt',
      'Draft Mode',
      now()
    );
    await logEvent('marketplace', `Listing saved in Draft Mode: ${listingTitle.trim()}`);
    setListingTitle('');
    setListingDescription('');
    await refresh();
  }, [db, listingTitle, listingDescription, listingPrice, listingLicense, listingProjectId, logEvent, refresh]);

  const submitCompetition = useCallback(async (competitionType: string) => {
    if (!db) return;
    const match = projects[0];
    await db.runAsync(
      'INSERT INTO competition_entries (id, competitionType, projectId, title, status, prizeField, judgingCriteria, submittedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      id(),
      competitionType,
      match?.id ?? '',
      `${competitionType} Submission`,
      'Submitted',
      competitionType === 'Yearly Gala' ? '1500 Credits' : '250 Credits',
      'Originality, execution, cohesion',
      now()
    );
    await logEvent('competition', `Competition entry submitted for ${competitionType}`);
    await refresh();
  }, [db, projects, logEvent, refresh]);

  const updateCourseProgress = useCallback(async (course: AcademyCourse, delta: number) => {
    if (!db) return;
    const progress = Math.max(0, Math.min(100, course.progress + delta));
    await db.runAsync('UPDATE academy_courses SET progress = ? WHERE id = ?', progress, course.id);
    await logEvent('academy', `${course.title} progress updated to ${progress}%`, course.id);
    await refresh();
  }, [db, logEvent, refresh]);

  const saveMemory = useCallback(async () => {
    if (!db || !memoryKey.trim() || !memoryValue.trim()) return;
    const stamp = now();
    await db.runAsync(
      'INSERT INTO creative_memory (id, memKey, value, category, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
      id(),
      memoryKey.trim(),
      memoryValue.trim(),
      memoryCategory,
      stamp,
      stamp
    );
    await logEvent('memory', `Memory saved: ${memoryKey.trim()}`);
    setMemoryKey('');
    setMemoryValue('');
    await refresh();
  }, [db, memoryKey, memoryValue, memoryCategory, logEvent, refresh]);

  const deleteMemory = useCallback(async (row: CreativeMemory) => {
    if (!db) return;
    await db.runAsync('DELETE FROM creative_memory WHERE id = ?', row.id);
    await logEvent('memory', `Memory deleted: ${row.memKey}`);
    await refresh();
  }, [db, logEvent, refresh]);

  const upsertSetting = useCallback(async (key: string, value: string) => {
    if (!db) return;
    await db.runAsync(
      'INSERT INTO control_center (prefKey, prefValue) VALUES (?, ?) ON CONFLICT(prefKey) DO UPDATE SET prefValue = excluded.prefValue',
      key,
      value
    );
    await logEvent('control', `Control Center updated: ${key}=${value}`);
    await refresh();
  }, [db, logEvent, refresh]);

  const handleExport = useCallback(() => {
    const payload = { projects, rooms, galleries, listings, courses, entries, memory, logs: logs.slice(0, 30), exportedAt: now() };
    setJsonBuffer(JSON.stringify(payload, null, 2));
  }, [projects, rooms, galleries, listings, courses, entries, memory, logs]);

  const handleImport = useCallback(async () => {
    if (!db || !jsonBuffer.trim()) return;
    try {
      const parsed = JSON.parse(jsonBuffer);
      if (!Array.isArray(parsed.projects)) throw new Error('Invalid JSON format: missing projects array');
      for (const row of parsed.projects as CreativeProject[]) {
        await db.runAsync(
          'INSERT OR REPLACE INTO creative_projects (id, title, type, status, description, prompt, enhancedPrompt, style, dimensionMode, notes, assets, marketplaceStatus, galleryStatus, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          row.id,
          row.title,
          row.type,
          row.status,
          row.description,
          row.prompt,
          row.enhancedPrompt,
          row.style,
          row.dimensionMode,
          row.notes,
          row.assets,
          row.marketplaceStatus,
          row.galleryStatus,
          row.createdAt,
          row.updatedAt
        );
      }
      await logEvent('import', `Imported ${parsed.projects.length} projects from JSON`);
      await refresh();
      Alert.alert('Import complete', 'Project JSON imported locally.');
    } catch (error) {
      Alert.alert('Import error', error instanceof Error ? error.message : 'Unable to import JSON');
    }
  }, [db, jsonBuffer, logEvent, refresh]);

  const runAssistant = useCallback(() => {
    const briefResult = aiProvider.generateCreativeBrief(assistantInput || 'Creative planning request');
    setAssistantOutput(
      [
        `Role: Gestalt AI Creative Director`,
        `Title: ${briefResult.title}`,
        `Prompt Upgrade: ${briefResult.enhancedPrompt}`,
        `Gallery Suggestion: ${briefResult.museumPlacement}`,
        `Marketplace Angle: ${briefResult.listingDescription}`,
        `Next: ${briefResult.nextSteps.join(' -> ')}`,
      ].join('\n')
    );
  }, [assistantInput]);

  const renderHome = () => (
    <View>
      <Panel title="Welcome to Gestalt Visions">
        <Text style={styles.copy}>Gestalt Intelligence Core is active. Local provider: {aiProvider.name} ({aiProvider.isConnected ? 'Connected' : 'Local Mode'}).</Text>
      </Panel>
      <View style={styles.grid}>
        <Stat label="Active Projects" value={String(activeProjects)} />
        <Stat label="Galleries" value={String(galleries.length)} />
        <Stat label="Market Drafts" value={String(listings.filter((l) => l.status === 'Draft Mode').length)} />
        <Stat label="Academy Avg" value={`${Math.round(courses.reduce((sum, c) => sum + c.progress, 0) / (courses.length || 1))}%`} />
      </View>
      <Panel title="Daily Creative Challenge">
        <Text style={styles.copy}>Design a "Cosmic Archive" room with one hero artifact and write curator narration for a buyer walkthrough.</Text>
      </Panel>
      <Panel title="Recent Creation Log">
        {logs.slice(0, 6).map((l) => (
          <Text key={l.id} style={styles.listText}>• {l.message}</Text>
        ))}
      </Panel>
      <View style={styles.actionRow}>
        <ActionButton title="Start New Creation" onPress={() => setActiveTab('studio')} />
        <ActionButton title="Build Gallery" onPress={() => { setActiveTab('more'); setMoreScreen('galleryBuilder'); }} />
      </View>
    </View>
  );

  const renderStudio = () => (
    <View>
      <Panel title="AI Studio">
        <Field label="Prompt" value={projectPrompt} onChangeText={setProjectPrompt} multiline />
        <Field label="Project Title" value={projectTitle} onChangeText={setProjectTitle} />
        <Field label="Project Type" value={projectType} onChangeText={setProjectType} />
        <Field label="Style Selector" value={projectStyle} onChangeText={setProjectStyle} />
        <Field label="Dimension Selector" value={projectDim} onChangeText={setProjectDim} />
        <ActionButton
          title="Prepare Creative Brief"
          onPress={async () => {
            const b = aiProvider.generateCreativeBrief(projectPrompt, projectStyle);
            setBrief(b);
            await logEvent('studio', `Creative brief prepared for prompt: ${projectPrompt.slice(0, 48)}`);
            await refresh();
          }}
        />
      </Panel>
      {brief && (
        <Panel title="Structured Creative Brief (Local)">
          <Text style={styles.listText}>Title: {brief.title}</Text>
          <Text style={styles.listText}>Enhanced Prompt: {brief.enhancedPrompt}</Text>
          <Text style={styles.listText}>Suggested Style: {brief.styleDirection}</Text>
          <Text style={styles.listText}>Museum Placement: {brief.museumPlacement}</Text>
          <Text style={styles.listText}>Tags: {brief.tags.join(', ')}</Text>
          <Text style={styles.listText}>Next Steps: {brief.nextSteps.join(' | ')}</Text>
          <ActionButton title="Save to Project" onPress={createProjectFromBrief} />
        </Panel>
      )}
    </View>
  );

  const renderMuseum = () => {
    const selectedRoom = rooms.find((r) => r.id === selectedRoomId) ?? rooms[0];
    return (
      <View>
        <Panel title="Create Museum Room">
          <Field label="Room Name" value={roomName} onChangeText={setRoomName} />
          <Field label="Room Theme" value={roomTheme} onChangeText={setRoomTheme} />
          <ActionButton title="Create Room" onPress={saveRoom} />
        </Panel>
        <Panel title="Room Controls">
          <Field label="Selected Room ID" value={selectedRoomId} onChangeText={setSelectedRoomId} />
          <Field label="Add Artwork Project ID" value={roomArtworkId} onChangeText={setRoomArtworkId} />
          <ActionButton title="Add Artwork to Room" onPress={addArtworkToRoom} />
          {selectedRoom && (
            <View style={styles.roomInfo}>
              <Text style={styles.listText}>Room: {selectedRoom.name}</Text>
              <Text style={styles.listText}>Theme: {selectedRoom.theme}</Text>
              <Text style={styles.listText}>Surfaces: {selectedRoom.wallSurface} / {selectedRoom.ceilingSurface} / {selectedRoom.floorSurface}</Text>
              <Text style={styles.listText}>Curator Note: {selectedRoom.curatorNote}</Text>
              <Text style={styles.listText}>Artwork IDs: {selectedRoom.artworkIds || 'none'}</Text>
            </View>
          )}
        </Panel>
        <Panel title="Museum Rooms">
          {rooms.map((r) => (
            <Pressable key={r.id} style={styles.itemRow} onPress={() => setSelectedRoomId(r.id)}>
              <Text style={styles.listText}>{r.name} • {r.theme}</Text>
              <Text style={styles.muted}>{r.id}</Text>
            </Pressable>
          ))}
        </Panel>
      </View>
    );
  };

  const renderMarket = () => (
    <View>
      <Panel title="Create Marketplace Listing">
        <Text style={styles.warning}>Stripe not connected. Listings are stored locally in Draft Mode.</Text>
        <Field label="Project ID" value={listingProjectId} onChangeText={setListingProjectId} />
        <Field label="Title" value={listingTitle} onChangeText={setListingTitle} />
        <Field label="Description" value={listingDescription} onChangeText={setListingDescription} multiline />
        <Field label="Price" value={listingPrice} onChangeText={setListingPrice} />
        <Field label="License Type" value={listingLicense} onChangeText={setListingLicense} />
        <ActionButton title="Save Listing Draft" onPress={createListing} />
      </Panel>
      <Panel title="Marketplace Drafts">
        {listings.map((row) => (
          <Text key={row.id} style={styles.listText}>• {row.title} — ${row.price} ({row.status})</Text>
        ))}
      </Panel>
    </View>
  );

  const renderAcademy = () => (
    <View>
      <Panel title="Academy Courses">
        {courses.map((course) => (
          <View key={course.id} style={styles.itemCard}>
            <Text style={styles.cardTitle}>{course.title}</Text>
            <Text style={styles.copy}>{course.description}</Text>
            <Text style={styles.listText}>Progress: {course.progress}%</Text>
            <View style={styles.actionRow}>
              <ActionButton title="+10" onPress={() => updateCourseProgress(course, 10)} compact />
              <ActionButton title="-10" onPress={() => updateCourseProgress(course, -10)} compact secondary />
            </View>
          </View>
        ))}
      </Panel>
    </View>
  );

  const renderMore = () => (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.moreRail}>
        {[
          ['projects', 'Projects'],
          ['galleryBuilder', 'Gallery'],
          ['competitions', 'Competitions'],
          ['creatorDashboard', 'Dashboard'],
          ['creationLog', 'Creation Log'],
          ['creativeMemory', 'Memory'],
          ['controlCenter', 'Control'],
          ['assistant', 'Gestalt AI'],
        ].map(([key, label]) => (
          <Pressable key={key} onPress={() => setMoreScreen(key as MoreScreen)} style={[styles.chip, moreScreen === key && styles.chipActive]}>
            <Text style={styles.chipText}>{label}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {moreScreen === 'projects' && (
        <Panel title="Projects">
          {projects.map((p) => (
            <View key={p.id} style={styles.itemCard}>
              <Text style={styles.cardTitle}>{p.title}</Text>
              <Text style={styles.listText}>{p.type} • {p.status}</Text>
              <Text style={styles.copy}>{p.description}</Text>
              <ActionButton title="Delete" onPress={() => deleteProject(p)} compact secondary />
            </View>
          ))}
        </Panel>
      )}
      {moreScreen === 'galleryBuilder' && (
        <Panel title="Gallery Builder">
          <Field label="Gallery Title" value={galleryTitle} onChangeText={setGalleryTitle} />
          <Field label="Description" value={galleryDescription} onChangeText={setGalleryDescription} multiline />
          <Field label="Theme" value={galleryTheme} onChangeText={setGalleryTheme} />
          <Field label="Project IDs (comma separated)" value={galleryProjectId} onChangeText={setGalleryProjectId} />
          <ActionButton title="Save Gallery Draft" onPress={createGallery} />
          {galleries.map((g) => (
            <Text key={g.id} style={styles.listText}>• {g.title} ({g.status}) [{g.theme}]</Text>
          ))}
        </Panel>
      )}
      {moreScreen === 'competitions' && (
        <Panel title="Competitions">
          <Text style={styles.warning}>Leaderboard is local demo-only, not live global results.</Text>
          {competitionTypes.map((c) => (
            <View key={c} style={styles.itemRow}>
              <Text style={styles.listText}>{c}</Text>
              <ActionButton title="Submit" onPress={() => submitCompetition(c)} compact />
            </View>
          ))}
          {entries.map((e) => (
            <Text key={e.id} style={styles.muted}>• {e.competitionType}: {e.status} ({e.prizeField})</Text>
          ))}
        </Panel>
      )}
      {moreScreen === 'creatorDashboard' && (
        <Panel title="Creator Dashboard">
          <Text style={styles.listText}>Project Count: {projects.length}</Text>
          <Text style={styles.listText}>Gallery Count: {galleries.length}</Text>
          <Text style={styles.listText}>Marketplace Drafts: {listings.filter((l) => l.status === 'Draft Mode').length}</Text>
          <Text style={styles.listText}>Competition Entries: {entries.filter((e) => e.status === 'Submitted').length}</Text>
          <Text style={styles.listText}>Estimated Value: ${listings.reduce((sum, l) => sum + l.price, 0).toFixed(2)}</Text>
          <Text style={styles.copy}>AI Suggestion: Convert "Ready to Publish" projects into themed gallery drops and create one exclusive license offer this week.</Text>
        </Panel>
      )}
      {moreScreen === 'creationLog' && (
        <Panel title="Creation Log">
          {logs.map((l) => (
            <Text key={l.id} style={styles.listText}>• [{l.type}] {l.message}</Text>
          ))}
        </Panel>
      )}
      {moreScreen === 'creativeMemory' && (
        <Panel title="Creative Memory (editable/deletable)">
          <Field label="Memory Key" value={memoryKey} onChangeText={setMemoryKey} />
          <Field label="Value" value={memoryValue} onChangeText={setMemoryValue} multiline />
          <Field label="Category" value={memoryCategory} onChangeText={setMemoryCategory} />
          <ActionButton title="Save Memory" onPress={saveMemory} />
          {memory.map((m) => (
            <View key={m.id} style={styles.itemRow}>
              <Text style={styles.listText}>{m.memKey}: {m.value}</Text>
              <ActionButton title="Delete" onPress={() => deleteMemory(m)} compact secondary />
            </View>
          ))}
        </Panel>
      )}
      {moreScreen === 'controlCenter' && (
        <Panel title="Control Center">
          <Text style={styles.copy}>AI access, memory, export, marketplace and privacy controls.</Text>
          <ToggleRow label="AI Access" value={settings.aiAccess === 'enabled'} onValueChange={(v) => upsertSetting('aiAccess', v ? 'enabled' : 'disabled')} />
          <ToggleRow label="Export Permission" value={settings.exportPermission !== 'disabled'} onValueChange={(v) => upsertSetting('exportPermission', v ? 'enabled' : 'disabled')} />
          <ToggleRow label="Marketplace Permission" value={settings.marketplacePermissions !== 'disabled'} onValueChange={(v) => upsertSetting('marketplacePermissions', v ? 'draft-only' : 'disabled')} />
          <ActionButton title="Export JSON" onPress={handleExport} />
          <Field label="JSON Buffer" value={jsonBuffer} onChangeText={setJsonBuffer} multiline />
          <ActionButton title="Import Project JSON" onPress={handleImport} secondary />
        </Panel>
      )}
      {moreScreen === 'assistant' && (
        <Panel title="Gestalt AI Assistant">
          <Text style={styles.copy}>Roles: Creative Director, Curator, Marketplace Advisor, Tutor, Prompt Engineer, Brand Strategist.</Text>
          <Field label="Ask Gestalt AI" value={assistantInput} onChangeText={setAssistantInput} multiline />
          <ActionButton title="Generate Structured Suggestion" onPress={runAssistant} />
          {!!assistantOutput && <Text style={styles.listText}>{assistantOutput}</Text>}
        </Panel>
      )}
    </View>
  );

  if (booting) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" />
        <View style={styles.loadingWrap}><Text style={styles.title}>Loading Gestalt Visions...</Text></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <View style={styles.container}>
        <Text style={styles.title}>Gestalt Visions</Text>
        <Text style={styles.subtitle}>Creative platform • museum • marketplace • academy • local-first AI studio</Text>
        <ScrollView contentContainerStyle={styles.content}>
          {activeTab === 'home' && renderHome()}
          {activeTab === 'studio' && renderStudio()}
          {activeTab === 'museum' && renderMuseum()}
          {activeTab === 'market' && renderMarket()}
          {activeTab === 'academy' && renderAcademy()}
          {activeTab === 'more' && renderMore()}
        </ScrollView>
        <View style={styles.tabBar}>
          {[
            ['home', 'Home'],
            ['studio', 'Studio'],
            ['museum', 'Museum'],
            ['market', 'Market'],
            ['academy', 'Academy'],
            ['more', 'More'],
          ].map(([key, label]) => (
            <Pressable key={key} onPress={() => setActiveTab(key as MainTab)} style={[styles.tab, activeTab === key && styles.tabActive]}>
              <Text style={styles.tabText}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Field({ label, value, onChangeText, multiline = false }: { label: string; value: string; onChangeText: (value: string) => void; multiline?: boolean }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        placeholderTextColor={palette.muted}
        style={[styles.input, multiline && styles.textArea]}
      />
    </View>
  );
}

function ActionButton({ title, onPress, compact = false, secondary = false }: { title: string; onPress: () => void; compact?: boolean; secondary?: boolean }) {
  return (
    <Pressable onPress={onPress} style={[styles.button, compact && styles.buttonCompact, secondary && styles.buttonSecondary]}>
      <Text style={styles.buttonText}>{title}</Text>
    </Pressable>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ToggleRow({ label, value, onValueChange }: { label: string; value: boolean; onValueChange: (value: boolean) => void }) {
  return (
    <View style={styles.itemRow}>
      <Text style={styles.listText}>{label}</Text>
      <Pressable onPress={() => onValueChange(!value)} style={[styles.chip, value && styles.chipActive]}>
        <Text style={styles.chipText}>{value ? 'Enabled' : 'Disabled'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.bg },
  container: { flex: 1, paddingHorizontal: 14, paddingTop: 8 },
  content: { paddingBottom: 120 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 26, color: palette.text, fontWeight: '800' },
  subtitle: { color: palette.muted, marginTop: 2, marginBottom: 10 },
  panel: {
    backgroundColor: palette.panel,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
  },
  panelTitle: { color: palette.text, fontSize: 17, fontWeight: '700', marginBottom: 8 },
  copy: { color: palette.muted, lineHeight: 20 },
  listText: { color: palette.text, lineHeight: 20, marginBottom: 6 },
  muted: { color: palette.muted, fontSize: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  statCard: {
    width: '48%',
    backgroundColor: palette.panelSolid,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 12,
  },
  statValue: { color: palette.cyan, fontSize: 24, fontWeight: '800' },
  statLabel: { color: palette.muted, marginTop: 2 },
  fieldWrap: { marginBottom: 10 },
  fieldLabel: { color: palette.text, fontSize: 13, marginBottom: 6 },
  input: {
    backgroundColor: '#0c1330',
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: 12,
    color: palette.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  textArea: { minHeight: 78, textAlignVertical: 'top' },
  button: {
    backgroundColor: palette.cyan,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 14,
    marginBottom: 8,
    alignItems: 'center',
  },
  buttonSecondary: { backgroundColor: palette.violet },
  buttonCompact: { paddingVertical: 8, paddingHorizontal: 10, minWidth: 84 },
  buttonText: { color: '#00121A', fontWeight: '700' },
  actionRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 },
  tabBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    padding: 8,
    borderTopWidth: 1,
    borderColor: palette.border,
    backgroundColor: '#080d1f',
  },
  tab: {
    width: '16.1%',
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabActive: { backgroundColor: 'rgba(59, 231, 255, 0.2)' },
  tabText: { color: palette.text, fontSize: 12, fontWeight: '600' },
  moreRail: { marginBottom: 10 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.border,
    marginRight: 8,
    backgroundColor: '#0b1230',
  },
  chipActive: { backgroundColor: 'rgba(155, 92, 255, 0.28)' },
  chipText: { color: palette.text, fontSize: 12, fontWeight: '700' },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    gap: 8,
  },
  itemCard: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    padding: 10,
    backgroundColor: '#0c142d',
    marginBottom: 8,
  },
  cardTitle: { color: palette.text, fontSize: 15, fontWeight: '700', marginBottom: 4 },
  roomInfo: { marginTop: 8, padding: 8, backgroundColor: '#0d1635', borderRadius: 10 },
  warning: { color: palette.amber, marginBottom: 8 },
});
