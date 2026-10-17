import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  CheckCircle2, 
  Circle, 
  Plus, 
  Trash2, 
  LayoutDashboard, 
  CheckSquare, 
  FolderKanban, 
  User, 
  Bell, 
  Sparkles,
  Search,
  ArrowRight,
  Edit2,
  Calendar as CalendarIcon,
  RotateCcw,
  LogOut,
  LogIn,
  X,
  Check,
  TrendingUp,
  BarChart3,
  ShieldCheck,
  History,
  Phone,
  Save,
  Sun,
  Moon,
  Zap,
  Clock,
  AlertCircle,
  Flame
} from 'lucide-react';
import { supabase } from './lib/supabase';

export interface Task {
  id: string;
  project_id?: string;
  title: string;
  is_completed: boolean;
  category: 'Work' | 'Personal' | 'Urgent';
  due_date?: string;
  created_at?: string;
  completed_on?: string; // YYYY-MM-DD
}

export interface Project {
  id: string;
  title: string;
  description: string;
  category: string;
  color: string;
}

export interface TaskHistoryItem {
  id: string;
  title: string;
  category: string;
  action: 'completed' | 'deleted' | 'created';
  timestamp: string;
}

type ThemeMode = 'white' | 'black' | 'darkblue';

const LOCAL_STORAGE_KEY_TASKS = 'taskly_local_tasks_v2';
const LOCAL_STORAGE_KEY_PROJECTS = 'taskly_local_projects_v2';

const DEFAULT_INITIAL_TASKS: Task[] = [
  { id: '1', title: 'Master React & Vite Component Architecture', is_completed: true, category: 'Work', due_date: new Date().toISOString().split('T')[0], completed_on: new Date().toISOString().split('T')[0] },
  { id: '2', title: 'Setup Supabase Cloud Database Sync', is_completed: false, category: 'Urgent', due_date: new Date().toISOString().split('T')[0] },
  { id: '3', title: 'Workout & Daily Exercise Routine', is_completed: true, category: 'Personal', completed_on: new Date().toISOString().split('T')[0] },
  { id: '4', title: 'Design Taskly Analytics UI Graph', is_completed: true, category: 'Work', completed_on: new Date().toISOString().split('T')[0] },
  { id: '5', title: 'Review SaaS Deployment Pipeline', is_completed: false, category: 'Work' }
];

const DEFAULT_INITIAL_PROJECTS: Project[] = [
  { id: 'proj-1', title: 'Taskly SaaS Platform', description: 'Neomorphic glassmorphism task manager app', category: 'Development', color: 'bg-[#D8C7F7]' },
  { id: 'proj-2', title: 'Quickbill Invoice Generator', description: 'Automated billing system for freelancers', category: 'SaaS', color: 'bg-[#FAD4B2]' }
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'Overview' | 'Tasks' | 'Projects' | 'Progress' | 'Profile'>('Overview');
  const [session, setSession] = useState<any>(null);

  // Theme Management (White, Black, Dark Blue)
  const [theme, setTheme] = useState<ThemeMode>(() => {
    return (localStorage.getItem('taskly_theme') as ThemeMode) || 'white';
  });

  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [isSignUp, setIsSignUp] = useState<boolean>(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Profile Edit
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState('');

  // History Log
  const [taskHistory, setTaskHistory] = useState<TaskHistoryItem[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);

  // Tasks & Projects Local Storage Backup Mode
  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY_TASKS);
    return saved ? JSON.parse(saved) : DEFAULT_INITIAL_TASKS;
  });

  const [projects, setProjects] = useState<Project[]>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY_PROJECTS);
    return saved ? JSON.parse(saved) : DEFAULT_INITIAL_PROJECTS;
  });

  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'Work' | 'Personal' | 'Urgent'>('Work');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const [filter, setFilter] = useState<'All' | 'Work' | 'Personal' | 'Urgent' | 'Overdue'>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const [lastDeletedTask, setLastDeletedTask] = useState<Task | null>(null);
  const [showUndoToast, setShowUndoToast] = useState<boolean>(false);

  const [showProjectModal, setShowProjectModal] = useState<boolean>(false);
  const [newProjectTitle, setNewProjectTitle] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [newProjectCategory, setNewProjectCategory] = useState('Development');

  const taskInputRef = useRef<HTMLInputElement>(null);

  // Helper to format due date nicely (e.g. 23 Oct)
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const [year, month, day] = parts;
    const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  // Keyboard shortcut: 'N' to focus task input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key.toLowerCase() === 'n' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA' &&
        document.activeElement?.tagName !== 'SELECT'
      ) {
        e.preventDefault();
        taskInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Save offline fallback tasks to LocalStorage
  useEffect(() => {
    if (!session) {
      localStorage.setItem(LOCAL_STORAGE_KEY_TASKS, JSON.stringify(tasks));
    }
  }, [tasks, session]);

  useEffect(() => {
    if (!session) {
      localStorage.setItem(LOCAL_STORAGE_KEY_PROJECTS, JSON.stringify(projects));
    }
  }, [projects, session]);

  // Save Theme to LocalStorage
  useEffect(() => {
    localStorage.setItem('taskly_theme', theme);
  }, [theme]);

  // Supabase Auth Listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        setDisplayNameInput(session.user.user_metadata?.full_name || session.user.user_metadata?.display_name || '');
        setPhoneInput(session.user.user_metadata?.phone || session.user.phone || '');
      }
    }).catch(() => {});

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        setDisplayNameInput(session.user.user_metadata?.full_name || session.user.user_metadata?.display_name || '');
        setPhoneInput(session.user.user_metadata?.phone || session.user.phone || '');
      } else {
        const localSaved = localStorage.getItem(LOCAL_STORAGE_KEY_TASKS);
        setTasks(localSaved ? JSON.parse(localSaved) : DEFAULT_INITIAL_TASKS);
        const localProjs = localStorage.getItem(LOCAL_STORAGE_KEY_PROJECTS);
        setProjects(localProjs ? JSON.parse(localProjs) : DEFAULT_INITIAL_PROJECTS);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    fetchData();
  }, [session]);

  const fetchData = async () => {
    if (session?.user) {
      try {
        const { data: tasksData, error: tErr } = await supabase.from('tasks').select('*').order('created_at', { ascending: false });
        const { data: projectsData, error: pErr } = await supabase.from('projects').select('*');

        if (!tErr && tasksData) setTasks(tasksData);
        if (!pErr && projectsData) setProjects(projectsData);
      } catch (err) {
        console.warn('Fallback to local state mode:', err);
      }
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ 
          email, 
          password,
          options: {
            data: {
              full_name: displayNameInput,
              phone: phoneInput
            }
          }
        });
        if (error) throw error;
        alert('Account created! Logging in...');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      setShowAuthModal(false);
      setEmail('');
      setPassword('');
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    setProfileSuccessMsg('');

    try {
      if (session?.user) {
        const { error } = await supabase.auth.updateUser({
          data: {
            full_name: displayNameInput,
            display_name: displayNameInput,
            phone: phoneInput
          }
        });

        if (error) throw error;
        setProfileSuccessMsg('Profile synced with Supabase!');
        setTimeout(() => setProfileSuccessMsg(''), 3000);
      } else {
        setProfileSuccessMsg('Updated locally!');
        setTimeout(() => setProfileSuccessMsg(''), 3000);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update profile');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Sign out warning:', err);
    }
    setSession(null);
    setActiveTab('Overview');
    const localSaved = localStorage.getItem(LOCAL_STORAGE_KEY_TASKS);
    setTasks(localSaved ? JSON.parse(localSaved) : DEFAULT_INITIAL_TASKS);
  };

  const addHistoryLog = (title: string, category: string, action: 'completed' | 'deleted' | 'created') => {
    const newLog: TaskHistoryItem = {
      id: Date.now().toString(),
      title,
      category,
      action,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setTaskHistory(prev => [newLog, ...prev]);
  };

  const clearHistory = () => {
    setTaskHistory([]);
  };

  const completedCount = useMemo(() => tasks.filter(t => t.is_completed).length, [tasks]);
  const progressPercentage = useMemo(() => tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0, [tasks, completedCount]);
  
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const overdueTasksCount = useMemo(() => {
    return tasks.filter(t => !t.is_completed && t.due_date && t.due_date < todayStr).length;
  }, [tasks, todayStr]);

  // Real Weekly Progress Calculation (Last 7 Days)
  const weeklyChartData = useMemo(() => {
    const days: { day: string; count: number; dateStr: string; percent: number; filledHeight: string; active: boolean }[] = [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayName = dayNames[d.getDay()];

      const count = tasks.filter(t => t.is_completed && t.completed_on === dateStr).length;
      days.push({
        day: dayName,
        count,
        dateStr,
        percent: 0,
        filledHeight: 'h-[10%]',
        active: dateStr === todayStr
      });
    }

    const maxCount = Math.max(...days.map(d => d.count), 1);
    return days.map(d => {
      const pct = Math.round((d.count / maxCount) * 100);
      const calculatedPct = d.count > 0 ? Math.max(pct, 15) : 5;
      return {
        ...d,
        percent: pct,
        filledHeight: `h-[${calculatedPct}%]`
      };
    });
  }, [tasks, todayStr]);

  // Real Consecutive Streak Counter
  const streakCount = useMemo(() => {
    let streak = 0;
    let checkDate = new Date();

    for (let i = 0; i < 30; i++) {
      const dStr = checkDate.toISOString().split('T')[0];
      const completedOnDay = tasks.some(t => t.is_completed && t.completed_on === dStr);
      if (completedOnDay) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        if (i === 0) {
          checkDate.setDate(checkDate.getDate() - 1);
          continue;
        }
        break;
      }
    }
    return streak;
  }, [tasks]);

  // Next Up Task
  const nextUpTask = useMemo(() => {
    const pendingTasks = tasks.filter(t => !t.is_completed);
    if (pendingTasks.length === 0) return null;

    const urgentTask = pendingTasks.find(t => t.category === 'Urgent');
    if (urgentTask) return urgentTask;

    const sortedByDate = [...pendingTasks].sort((a, b) => {
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return a.due_date.localeCompare(b.due_date);
    });

    return sortedByDate[0];
  }, [tasks]);

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    if (editingTask) {
      const updatedTask: Task = {
        ...editingTask,
        title: newTaskTitle.trim(),
        category: selectedCategory,
        due_date: dueDate || undefined,
        project_id: selectedProjectId || undefined
      };

      setTasks(tasks.map(t => t.id === editingTask.id ? updatedTask : t));

      if (session?.user) {
        try {
          await supabase.from('tasks').update(updatedTask).eq('id', editingTask.id);
        } catch (err) {
          console.warn('Supabase task update error:', err);
        }
      }
      setEditingTask(null);
    } else {
      const newTask: Task = {
        id: Date.now().toString(),
        title: newTaskTitle.trim(),
        is_completed: false,
        category: selectedCategory,
        due_date: dueDate || undefined,
        project_id: selectedProjectId || undefined,
        created_at: new Date().toISOString()
      };

      setTasks([newTask, ...tasks]);
      addHistoryLog(newTask.title, newTask.category, 'created');

      if (session?.user) {
        try {
          await supabase.from('tasks').insert([{ ...newTask, user_id: session.user.id }]);
        } catch (err) {
          console.warn('Supabase task insert error:', err);
        }
      }
    }

    setNewTaskTitle('');
    setDueDate('');
    setSelectedProjectId('');
  };

  const startEdit = (task: Task) => {
    setEditingTask(task);
    setNewTaskTitle(task.title);
    setSelectedCategory(task.category);
    setDueDate(task.due_date || '');
    setSelectedProjectId(task.project_id || '');
    setActiveTab('Tasks');
  };

  const toggleTask = async (id: string) => {
    const targetTask = tasks.find(t => t.id === id);
    if (!targetTask) return;

    const updatedStatus = !targetTask.is_completed;
    const completedDate = updatedStatus ? todayStr : undefined;

    setTasks(tasks.map(t => t.id === id ? { ...t, is_completed: updatedStatus, completed_on: completedDate } : t));

    if (updatedStatus) {
      addHistoryLog(targetTask.title, targetTask.category, 'completed');
    }

    if (session?.user) {
      try {
        await supabase.from('tasks').update({ is_completed: updatedStatus, completed_on: completedDate }).eq('id', id);
      } catch (err) {
        console.warn('Supabase toggle error:', err);
      }
    }
  };

  const deleteTask = async (id: string) => {
    const targetTask = tasks.find(t => t.id === id);
    if (targetTask) {
      setLastDeletedTask(targetTask);
      setShowUndoToast(true);
      addHistoryLog(targetTask.title, targetTask.category, 'deleted');
      setTimeout(() => setShowUndoToast(false), 5000);
    }

    setTasks(tasks.filter(t => t.id !== id));
    if (session?.user) {
      try {
        await supabase.from('tasks').delete({ count: 'exact' }).eq('id', id);
      } catch (err) {
        console.warn('Supabase delete error:', err);
      }
    }
  };

  const undoDelete = async () => {
    if (lastDeletedTask) {
      setTasks([lastDeletedTask, ...tasks]);
      if (session?.user) {
        try {
          await supabase.from('tasks').insert([{ ...lastDeletedTask, user_id: session.user.id }]);
        } catch (err) {
          console.warn('Supabase undo error:', err);
        }
      }
      setLastDeletedTask(null);
      setShowUndoToast(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectTitle.trim()) return;

    const colors = ['bg-[#D8C7F7]', 'bg-[#FAD4B2]', 'bg-[#D3F8E2]', 'bg-[#B3C2FC]'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const newProj: Project = {
      id: Date.now().toString(),
      title: newProjectTitle.trim(),
      description: newProjectDesc.trim(),
      category: newProjectCategory,
      color: randomColor
    };

    setProjects([...projects, newProj]);
    if (session?.user) {
      try {
        await supabase.from('projects').insert([{ ...newProj, user_id: session.user.id }]);
      } catch (err) {
        console.warn('Supabase project error:', err);
      }
    }

    setNewProjectTitle('');
    setNewProjectDesc('');
    setShowProjectModal(false);
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      let matchesCat = true;
      if (filter === 'Overdue') {
        matchesCat = !task.is_completed && !!task.due_date && task.due_date < todayStr;
      } else if (filter !== 'All') {
        matchesCat = task.category === filter;
      }

      const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCat && matchesSearch;
    });
  }, [tasks, filter, searchQuery, todayStr]);

  const metaName = session?.user?.user_metadata?.full_name || session?.user?.user_metadata?.display_name;
  const emailName = session?.user?.email ? session.user.email.split('@')[0] : '';
  const userName = session?.user ? (displayNameInput || metaName || emailName || 'Manthan') : 'Guest';

  // Dynamic Theme Styling Classes (White, Black, Dark Blue)
  const themeStyles = useMemo(() => {
    if (theme === 'black') {
      return {
        bg: 'bg-black text-slate-100',
        cardBg: 'bg-zinc-900 border-zinc-800 text-slate-100',
        cardSubBg: 'bg-zinc-950 border-zinc-800',
        headerBg: 'bg-zinc-900/80 border-zinc-800',
        inputBg: 'bg-zinc-950 text-white border-zinc-800',
        textMuted: 'text-zinc-400',
        navBg: 'bg-zinc-900/95 border-zinc-700/80'
      };
    } else if (theme === 'darkblue') {
      return {
        bg: 'bg-slate-950 text-slate-100',
        cardBg: 'bg-slate-900 border-slate-800 text-slate-100',
        cardSubBg: 'bg-slate-950 border-slate-800',
        headerBg: 'bg-slate-900/80 border-slate-800',
        inputBg: 'bg-slate-950 text-white border-slate-800',
        textMuted: 'text-slate-400',
        navBg: 'bg-slate-900/95 border-slate-700/80'
      };
    }
    return {
      bg: 'bg-[#F8F6F0] text-slate-900',
      cardBg: 'bg-white border-slate-200/60 text-slate-900',
      cardSubBg: 'bg-slate-50 border-slate-100',
      headerBg: 'bg-[#F8F6F0]/80 border-slate-200/60',
      inputBg: 'bg-white text-slate-900 border-slate-200',
      textMuted: 'text-slate-500',
      navBg: 'bg-slate-900/95 border-slate-700/50 text-white'
    };
  }, [theme]);

  return (
    <div className={`min-h-screen ${themeStyles.bg} flex flex-col font-sans pb-48 selection:bg-indigo-500 selection:text-white transition-colors duration-300`}>
      
      {/* HEADER */}
      <header className={`w-full max-w-xl md:max-w-2xl mx-auto px-4 sm:px-6 pt-5 pb-3 flex items-center justify-between sticky top-0 z-30 backdrop-blur-md border-b ${themeStyles.headerBg}`}>
        <div 
          onClick={() => setActiveTab('Profile')}
          className="flex items-center space-x-3 cursor-pointer group"
          title="Profile"
        >
          <div className="w-10 h-10 sm:w-11 sm:h-11 bg-indigo-600 rounded-full flex items-center justify-center text-white font-black text-sm sm:text-base shadow-md group-hover:scale-105 transition-transform">
            {userName.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-xs sm:text-sm font-extrabold group-hover:text-indigo-500 transition-colors">
              Hello, {userName}
            </h1>
            <p className={`text-[10px] sm:text-[11px] font-medium ${themeStyles.textMuted} flex items-center gap-1`}>
              <Sparkles className="w-3 h-3 text-indigo-500" />
              <span>Progress: {progressPercentage}%</span>
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Streak Badge */}
          <div className="flex items-center space-x-1 px-2.5 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-500 rounded-full text-[10px] sm:text-xs font-black" title="Daily Completion Streak">
            <Flame className="w-3.5 h-3.5 fill-amber-500" />
            <span>{streakCount}d Streak</span>
          </div>

          {/* Theme Switcher Button */}
          <button
            onClick={() => {
              if (theme === 'white') setTheme('black');
              else if (theme === 'black') setTheme('darkblue');
              else setTheme('white');
            }}
            className={`p-2 rounded-full border shadow-sm transition-transform active:scale-95 ${themeStyles.cardBg}`}
            title={`Current Theme: ${theme.toUpperCase()}. Click to switch.`}
          >
            {theme === 'white' && <Sun className="w-4 h-4 text-amber-500" />}
            {theme === 'black' && <Moon className="w-4 h-4 text-indigo-400" />}
            {theme === 'darkblue' && <Zap className="w-4 h-4 text-cyan-400" />}
          </button>

          {session ? (
            <button 
              onClick={handleSignOut}
              className="text-[11px] sm:text-xs font-bold text-white bg-indigo-600 border border-indigo-500 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-full hover:bg-indigo-700 transition-colors shadow-sm cursor-pointer flex items-center space-x-1"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          ) : (
            <button 
              onClick={() => setShowAuthModal(true)}
              className="text-[11px] sm:text-xs font-bold text-white bg-indigo-600 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full shadow-md hover:bg-indigo-700 transition-colors cursor-pointer flex items-center space-x-1"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Login</span>
            </button>
          )}

          <button 
            onClick={() => setShowHistoryModal(true)}
            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shadow-sm border relative hover:opacity-80 transition-opacity cursor-pointer ${themeStyles.cardBg}`}
            title="Activity History"
          >
            <History className="w-4 h-4" />
            {taskHistory.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-indigo-600 rounded-full"></span>
            )}
          </button>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="flex-1 w-full max-w-xl md:max-w-2xl mx-auto px-4 sm:px-6 space-y-6 mt-4">
        
        {/* OVERVIEW TAB */}
        {activeTab === 'Overview' && (
          <div className="space-y-6 animate-fadeIn">
            
            {/* Hero Card */}
            <div className="bg-[#D8C7F7] p-5 sm:p-7 rounded-[2rem] sm:rounded-[2.5rem] shadow-sm relative overflow-hidden flex flex-col justify-between min-h-[160px] text-slate-900">
              <div className="z-10">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] sm:text-[10px] font-extrabold tracking-wider uppercase bg-white/50 text-indigo-900 px-3 py-1 rounded-full">
                    Taskly Workspace
                  </span>
                  <span className="text-[10px] font-semibold text-slate-700 bg-white/30 px-2.5 py-0.5 rounded-md">
                    Press <kbd className="font-mono bg-white px-1 rounded shadow-xs">N</kbd> for quick task
                  </span>
                </div>

                <h2 className="text-xl sm:text-2xl font-black mt-3 mb-1">
                  {userName}'s Dashboard
                </h2>
                <p className="text-xs text-slate-800 font-medium">
                  {completedCount} of {tasks.length} tasks completed this week.
                </p>
              </div>

              {nextUpTask && (
                <div className="mt-4 p-3 bg-white/70 backdrop-blur-xs rounded-2xl border border-white/80 flex items-center justify-between z-10">
                  <div className="flex items-center space-x-2 min-w-0 pr-2">
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-indigo-600 text-white rounded-md">
                      Next Up
                    </span>
                    <span className="text-xs font-bold text-slate-900 truncate">{nextUpTask.title}</span>
                  </div>
                  <button 
                    onClick={() => toggleTask(nextUpTask.id)}
                    className="text-[10px] font-bold px-2.5 py-1 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition shrink-0 cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              )}
            </div>

            {/* Metric Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
              <div 
                onClick={() => setFilter('All')} 
                className={`p-3.5 sm:p-4 rounded-[1.5rem] sm:rounded-[2rem] shadow-sm border transition-all cursor-pointer ${filter === 'All' ? 'bg-indigo-600 text-white border-indigo-600' : themeStyles.cardBg}`}
              >
                <span className="text-[9px] sm:text-[10px] font-bold uppercase opacity-80">Total</span>
                <p className="text-lg sm:text-xl font-black mt-1">{tasks.length}</p>
              </div>

              <div 
                onClick={() => setFilter('Work')} 
                className={`p-3.5 sm:p-4 rounded-[1.5rem] sm:rounded-[2rem] shadow-sm border transition-all cursor-pointer ${filter === 'Work' ? 'bg-indigo-600 text-white border-indigo-600' : themeStyles.cardBg}`}
              >
                <span className="text-[9px] sm:text-[10px] font-bold uppercase text-indigo-400">Work</span>
                <p className="text-lg sm:text-xl font-black mt-1">{tasks.filter(t => t.category === 'Work').length}</p>
              </div>

              <div 
                onClick={() => setFilter('Urgent')} 
                className={`p-3.5 sm:p-4 rounded-[1.5rem] sm:rounded-[2rem] shadow-sm border transition-all cursor-pointer ${filter === 'Urgent' ? 'bg-indigo-600 text-white border-indigo-600' : themeStyles.cardBg}`}
              >
                <span className="text-[9px] sm:text-[10px] font-bold uppercase text-amber-500">Urgent</span>
                <p className="text-lg sm:text-xl font-black mt-1">{tasks.filter(t => t.category === 'Urgent').length}</p>
              </div>

              <div 
                onClick={() => setFilter('Overdue')} 
                className={`p-3.5 sm:p-4 rounded-[1.5rem] sm:rounded-[2rem] shadow-sm border transition-all cursor-pointer ${filter === 'Overdue' ? 'bg-rose-600 text-white border-rose-600' : themeStyles.cardBg}`}
              >
                <span className="text-[9px] sm:text-[10px] font-bold uppercase text-rose-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Overdue
                </span>
                <p className="text-lg sm:text-xl font-black mt-1 text-rose-500">{overdueTasksCount}</p>
              </div>
            </div>

            {/* TASK MANAGEMENT SECTION */}
            <div className={`p-4 sm:p-6 rounded-[2rem] sm:rounded-[2.5rem] shadow-sm border space-y-4 sm:space-y-5 ${themeStyles.cardBg}`}>
              
              <form onSubmit={handleSaveTask} className={`space-y-3 p-3.5 sm:p-4 rounded-2xl sm:rounded-3xl border ${themeStyles.cardSubBg}`}>
                <input 
                  ref={taskInputRef}
                  type="text"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="Add a new task... (Press 'N' to focus)"
                  className={`w-full rounded-xl sm:rounded-2xl px-3.5 sm:px-4 py-2.5 sm:py-3 text-xs focus:outline-none focus:border-indigo-500 shadow-sm ${themeStyles.inputBg}`}
                />

                <div className="flex items-center justify-between gap-2">
                  <div className="flex gap-1">
                    {(['Work', 'Personal', 'Urgent'] as const).map(cat => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSelectedCategory(cat)}
                        className={`text-[9px] sm:text-[10px] px-2.5 py-1.5 rounded-lg sm:rounded-xl font-bold transition-all cursor-pointer ${
                          selectedCategory === cat ? 'bg-indigo-600 text-white' : 'border border-slate-700/40 opacity-70'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  <input 
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className={`rounded-xl px-2.5 py-1 text-[11px] focus:outline-none ${themeStyles.inputBg}`}
                    title="Due Date"
                  />

                  <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl shadow-md transition-all cursor-pointer flex items-center space-x-1">
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Task</span>
                  </button>
                </div>
              </form>

              <div className="space-y-3">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 opacity-40" />
                  <input 
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search tasks..."
                    className={`w-full rounded-xl sm:rounded-2xl pl-10 pr-4 py-2 text-xs focus:outline-none shadow-sm ${themeStyles.inputBg}`}
                  />
                </div>

                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {(['All', 'Work', 'Personal', 'Urgent', 'Overdue'] as const).map(cat => (
                    <button
                      key={cat}
                      onClick={() => setFilter(cat)}
                      className={`text-xs px-3 py-1 rounded-full font-bold transition-all cursor-pointer whitespace-nowrap ${
                        filter === cat ? 'bg-indigo-600 text-white' : 'bg-slate-800/10 opacity-70 hover:opacity-100'
                      }`}
                    >
                      {cat} {cat === 'Overdue' && `(${overdueTasksCount})`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tasks List */}
              <div className="space-y-2">
                {filteredTasks.length === 0 ? (
                  <div className="text-center py-10 border border-dashed border-slate-700/30 rounded-3xl space-y-2">
                    <CheckSquare className="w-8 h-8 mx-auto opacity-30" />
                    <p className="text-xs font-semibold opacity-70">No tasks found in this view.</p>
                    <p className="text-[11px] opacity-50">Type a new task above or press 'N' to add one instantly.</p>
                  </div>
                ) : (
                  filteredTasks.map(task => {
                    const isOver = !task.is_completed && task.due_date && task.due_date < todayStr;
                    return (
                      <div 
                        key={task.id}
                        className={`group flex items-center justify-between p-3 sm:p-3.5 rounded-xl sm:rounded-2xl border transition-all ${
                          isOver ? 'bg-rose-500/10 border-rose-500/30' : themeStyles.cardSubBg
                        }`}
                      >
                        <div className="flex items-center space-x-2.5 sm:space-x-3 flex-1 min-w-0">
                          <button onClick={() => toggleTask(task.id)} className="cursor-pointer shrink-0">
                            {task.is_completed ? <CheckCircle2 className="w-5 h-5 text-indigo-500" /> : <Circle className="w-5 h-5 opacity-40" />}
                          </button>
                          <div className="flex flex-col min-w-0">
                            <span className={`text-xs font-bold truncate ${task.is_completed ? 'line-through opacity-40' : ''}`}>
                              {task.title}
                            </span>
                            {task.due_date && (
                              <span className={`text-[10px] ${themeStyles.textMuted} flex items-center gap-1 mt-0.5`}>
                                <CalendarIcon className="w-3 h-3 text-indigo-500" />
                                <span>{formatDate(task.due_date)}</span>
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center space-x-2 ml-2 shrink-0">
                          {isOver && (
                            <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-500 border border-rose-500/30">
                              Overdue
                            </span>
                          )}
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-800/10 opacity-80">
                            {task.category}
                          </span>
                          <button onClick={() => startEdit(task)} className="p-1 opacity-40 hover:opacity-100 transition cursor-pointer">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => deleteTask(task.id)} className="p-1 text-rose-500 opacity-60 hover:opacity-100 transition cursor-pointer">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

            </div>

          </div>
        )}

        {/* TASKS TAB */}
        {activeTab === 'Tasks' && (
          <div className="space-y-6 animate-fadeIn">
            <div className={`p-4 sm:p-6 rounded-[2rem] sm:rounded-[2.5rem] shadow-sm border space-y-4 sm:space-y-5 ${themeStyles.cardBg}`}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base sm:text-lg font-black">{editingTask ? 'Edit Task' : 'Dedicated Task Hub'}</h2>
                  <p className={`text-xs ${themeStyles.textMuted}`}>Manage categories, due dates, and projects.</p>
                </div>
                {editingTask && (
                  <button onClick={() => setEditingTask(null)} className="text-xs text-rose-500 font-bold hover:underline cursor-pointer">
                    Cancel Edit
                  </button>
                )}
              </div>

              <form onSubmit={handleSaveTask} className={`space-y-3 p-3.5 sm:p-4 rounded-2xl sm:rounded-3xl border ${themeStyles.cardSubBg}`}>
                <input 
                  type="text"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="Task title..."
                  className={`w-full rounded-xl sm:rounded-2xl px-3.5 sm:px-4 py-2.5 sm:py-3 text-xs focus:outline-none focus:border-indigo-500 shadow-sm ${themeStyles.inputBg}`}
                />

                <div className="grid grid-cols-2 gap-2">
                  <input 
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className={`rounded-xl px-3 py-2 text-xs focus:outline-none ${themeStyles.inputBg}`}
                  />

                  <select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    className={`rounded-xl px-3 py-2 text-xs focus:outline-none ${themeStyles.inputBg}`}
                  >
                    <option value="">No Project</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="flex gap-1">
                    {(['Work', 'Personal', 'Urgent'] as const).map(cat => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSelectedCategory(cat)}
                        className={`text-[9px] sm:text-[10px] px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                          selectedCategory === cat ? 'bg-indigo-600 text-white' : 'border border-slate-700/40 opacity-70'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-md transition-all cursor-pointer flex items-center space-x-1">
                    {editingTask ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                    <span>{editingTask ? 'Update Task' : 'Add Task'}</span>
                  </button>
                </div>
              </form>

              <div className="space-y-2">
                {tasks.map(task => (
                  <div 
                    key={task.id}
                    className={`flex items-center justify-between p-3 sm:p-3.5 rounded-xl sm:rounded-2xl border ${themeStyles.cardSubBg}`}
                  >
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <button onClick={() => toggleTask(task.id)} className="cursor-pointer shrink-0">
                        {task.is_completed ? <CheckCircle2 className="w-5 h-5 text-indigo-500" /> : <Circle className="w-5 h-5 opacity-40" />}
                      </button>
                      <div className="flex flex-col min-w-0">
                        <span className={`text-xs font-bold truncate ${task.is_completed ? 'line-through opacity-40' : ''}`}>
                          {task.title}
                        </span>
                        {task.due_date && (
                          <span className={`text-[10px] ${themeStyles.textMuted} flex items-center gap-1 mt-0.5`}>
                            <CalendarIcon className="w-3 h-3 text-indigo-500" />
                            <span>{formatDate(task.due_date)}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 ml-2 shrink-0">
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-800/10 opacity-80">
                        {task.category}
                      </span>
                      <button onClick={() => startEdit(task)} className="p-1 opacity-40 hover:opacity-100 cursor-pointer">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => deleteTask(task.id)} className="p-1 text-rose-500 opacity-60 hover:opacity-100 cursor-pointer">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* PROJECTS TAB */}
        {activeTab === 'Projects' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex items-center justify-between">
              <h2 className="text-base sm:text-lg font-black">Taskly Projects</h2>
              <button 
                onClick={() => setShowProjectModal(true)}
                className="bg-indigo-600 text-white text-xs font-bold px-3.5 py-2 rounded-2xl shadow-md cursor-pointer flex items-center space-x-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Project</span>
              </button>
            </div>

            <div className="space-y-4">
              {projects.map((proj) => {
                const projTasks = tasks.filter(t => t.project_id === proj.id);
                const projCompleted = projTasks.filter(t => t.is_completed).length;
                const projProgress = projTasks.length > 0 ? Math.round((projCompleted / projTasks.length) * 100) : 0;

                return (
                  <div key={proj.id} className={`${proj.color} text-slate-900 p-5 sm:p-6 rounded-[2rem] sm:rounded-[2.5rem] shadow-sm border border-black/5 space-y-4`}>
                    <div>
                      <span className="text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider bg-white/60 px-3 py-1 rounded-full text-slate-800">
                        {proj.category}
                      </span>
                      <h3 className="text-lg sm:text-xl font-black mt-2">{proj.title}</h3>
                      <p className="text-xs text-slate-700 font-medium mt-1">{proj.description}</p>
                    </div>

                    <div className="space-y-2 pt-2">
                      <div className="flex justify-between text-xs font-bold text-slate-800">
                        <span>Project Progress ({projTasks.length} Tasks)</span>
                        <span>{projProgress}%</span>
                      </div>
                      <div className="w-full bg-white/50 rounded-full h-2.5 overflow-hidden">
                        <div className="bg-slate-900 h-full rounded-full transition-all duration-500" style={{ width: `${projProgress}%` }}></div>
                      </div>
                    </div>
                  </div>  
                );
              })}
            </div>
          </div>
        )}

        {/* PROGRESS TAB */}
        {activeTab === 'Progress' && (
          <div className="space-y-6 animate-fadeIn">
            <div className={`p-4 sm:p-6 rounded-[2rem] sm:rounded-[2.5rem] shadow-sm border space-y-4 ${themeStyles.cardBg}`}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black">7-Day Task Completion Graph</h3>
                  <p className={`text-[11px] ${themeStyles.textMuted}`}>Real task activity over the past week</p>
                </div>
                <div className="flex items-center space-x-1.5 bg-indigo-500/10 px-2.5 py-1 rounded-xl border border-indigo-500/20 text-indigo-400 text-xs font-bold">
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>Real Metrics</span>
                </div>
              </div>

              <div className="relative pt-6 pb-2 px-1 sm:px-2">
                <div className="flex items-end justify-between h-40 sm:h-44 pl-2 pr-2 z-10 relative">
                  {weeklyChartData.map((bar, idx) => (
                    <div key={idx} className="flex flex-col items-center flex-1 space-y-2 group">
                      <div className={`w-6 sm:w-8 h-32 sm:h-36 rounded-xl relative overflow-hidden flex flex-col justify-end border ${themeStyles.cardSubBg}`}>
                        <div 
                          className={`w-full rounded-xl transition-all duration-500 relative flex flex-col justify-between items-center py-1 shadow-sm ${
                            bar.active ? 'bg-indigo-600' : 'bg-sky-500'
                          }`}
                          style={{ height: `${bar.percent > 0 ? Math.max(bar.percent, 12) : 8}%` }}
                        >
                          <span className="text-[9px] font-extrabold text-white bg-black/20 px-1 rounded-full">
                            {bar.count}
                          </span>
                        </div>
                      </div>
                      <span className={`text-[10px] sm:text-[11px] font-bold ${bar.active ? 'text-indigo-500 font-black' : themeStyles.textMuted}`}>
                        {bar.day}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div className={`p-4 sm:p-5 rounded-2xl sm:rounded-3xl border shadow-sm space-y-1 sm:space-y-2 ${themeStyles.cardBg}`}>
                <span className={`text-[9px] sm:text-[10px] uppercase font-bold ${themeStyles.textMuted}`}>Total Rate</span>
                <p className="text-xl sm:text-2xl font-black">{progressPercentage}%</p>
                <p className="text-[10px] sm:text-[11px] text-emerald-500 font-bold flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" /> Live Calculated
                </p>
              </div>

              <div className={`p-4 sm:p-5 rounded-2xl sm:rounded-3xl border shadow-sm space-y-1 sm:space-y-2 ${themeStyles.cardBg}`}>
                <span className={`text-[9px] sm:text-[10px] uppercase font-bold ${themeStyles.textMuted}`}>Completed Tasks</span>
                <p className="text-xl sm:text-2xl font-black text-indigo-500">{completedCount} <span className={`text-xs font-medium ${themeStyles.textMuted}`}>/ {tasks.length}</span></p>
                <p className={`text-[10px] sm:text-[11px] ${themeStyles.textMuted}`}>On schedule</p>
              </div>
            </div>
          </div>
        )}

        {/* PROFILE TAB */}
        {activeTab === 'Profile' && (
          <div className="space-y-6 animate-fadeIn">
            <div className={`p-5 sm:p-6 rounded-[2rem] sm:rounded-[2.5rem] shadow-sm border space-y-5 ${themeStyles.cardBg}`}>
              
              <div className="flex items-center space-x-4 border-b border-slate-700/20 pb-5">
                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xl sm:text-2xl font-black shadow-md">
                  {userName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black">{userName}</h2>
                  <p className={`text-xs ${themeStyles.textMuted}`}>{session?.user?.email || 'Active Local Mode'}</p>
                  <span className="inline-block mt-1 text-[9px] sm:text-[10px] font-bold px-2.5 py-0.5 bg-emerald-500/10 text-emerald-500 rounded-full border border-emerald-500/30">
                    <ShieldCheck className="w-3 h-3 inline mr-1" /> Account Active
                  </span>
                </div>
              </div>

              {profileSuccessMsg && (
                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  <span>{profileSuccessMsg}</span>
                </div>
              )}

              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <h3 className={`text-xs font-extrabold uppercase tracking-wider ${themeStyles.textMuted}`}>Edit Account Details</h3>
                
                <div className="space-y-1">
                  <label className="text-[11px] font-bold">Display Name (Required)</label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 opacity-40" />
                    <input 
                      type="text"
                      value={displayNameInput}
                      onChange={(e) => setDisplayNameInput(e.target.value)}
                      placeholder="Your full name..."
                      required
                      className={`w-full rounded-2xl pl-10 pr-4 py-2.5 text-xs focus:outline-none focus:border-indigo-500 ${themeStyles.inputBg}`}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold">Mobile Number (Required)</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 opacity-40" />
                    <input 
                      type="text"
                      value={phoneInput}
                      onChange={(e) => setPhoneInput(e.target.value)}
                      placeholder="+91 9876543210"
                      required
                      className={`w-full rounded-2xl pl-10 pr-4 py-2.5 text-xs focus:outline-none focus:border-indigo-500 ${themeStyles.inputBg}`}
                    />
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={isSavingProfile}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-3 rounded-2xl shadow-md transition-all cursor-pointer flex items-center justify-center space-x-2"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSavingProfile ? 'Saving Details...' : 'Save Profile Changes'}</span>
                </button>
              </form>

              <div className="pt-2 border-t border-slate-700/20">
                {session ? (
                  <button 
                    onClick={handleSignOut}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-3 rounded-2xl shadow-md transition-all cursor-pointer flex items-center justify-center space-x-2"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                ) : (
                  <button 
                    onClick={() => setShowAuthModal(true)}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-3 rounded-2xl shadow-md transition-all cursor-pointer flex items-center justify-center space-x-2"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>Login to Account</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* BRANDBUZZ STUDIO FOOTER */}
        <footer className="w-full py-8 text-center mt-12 border-t border-slate-700/20">
          <p className="text-xl sm:text-2xl font-extrabold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 drop-shadow-sm">
            Made by BrandBuzz Studio
          </p>
        </footer>

      </main>

      {/* FIXED RESPONSIVE BOTTOM NAVIGATION BAR */}
      <nav className={`fixed bottom-4 left-1/2 -translate-x-1/2 backdrop-blur-xl px-2 py-2 rounded-full shadow-2xl z-40 grid grid-cols-5 gap-1 border w-[92vw] max-w-sm sm:max-w-md ${themeStyles.navBg}`}>
        {[
          { id: 'Overview', icon: LayoutDashboard },
          { id: 'Tasks', icon: CheckSquare },
          { id: 'Projects', icon: FolderKanban },
          { id: 'Progress', icon: TrendingUp },
          { id: 'Profile', icon: User },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex flex-col sm:flex-row items-center justify-center sm:space-x-1.5 py-2.5 sm:py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
                isActive ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
              title={tab.id}
            >
              <Icon className="w-5 h-5 sm:w-4 sm:h-4 shrink-0" />
              <span className="hidden sm:inline text-xs">{tab.id}</span>
            </button>
          );
        })}
      </nav>

      {/* ACTIVITY HISTORY MODAL */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className={`rounded-[2rem] sm:rounded-[2.5rem] max-w-sm w-full p-5 sm:p-6 space-y-4 shadow-2xl border ${themeStyles.cardBg}`}>
            <div className="flex items-center justify-between border-b border-slate-700/20 pb-3">
              <div className="flex items-center space-x-2">
                <History className="w-4 h-4 text-indigo-500" />
                <h3 className="text-sm font-black">Task Activity Log</h3>
              </div>
              <button onClick={() => setShowHistoryModal(false)} className="w-7 h-7 rounded-full bg-slate-800/30 flex items-center justify-center cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
              {taskHistory.length === 0 ? (
                <div className={`text-center py-8 text-xs ${themeStyles.textMuted}`}>
                  No recent activity logged.
                </div>
              ) : (
                taskHistory.map(log => (
                  <div key={log.id} className={`p-3 rounded-2xl border flex items-center justify-between text-xs ${themeStyles.cardSubBg}`}>
                    <div>
                      <p className="font-bold truncate max-w-[180px]">{log.title}</p>
                      <span className={`text-[9px] ${themeStyles.textMuted}`}>{log.timestamp} • {log.category}</span>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      log.action === 'completed' ? 'bg-emerald-500/20 text-emerald-500' :
                      log.action === 'deleted' ? 'bg-rose-500/20 text-rose-500' :
                      'bg-indigo-500/20 text-indigo-500'
                    }`}>
                      {log.action}
                    </span>
                  </div>
                ))
              )}
            </div>

            {taskHistory.length > 0 && (
              <button 
                onClick={clearHistory}
                className="w-full bg-slate-800/30 hover:bg-rose-500/25 hover:text-rose-500 text-xs font-bold py-2.5 rounded-2xl transition-all cursor-pointer flex items-center justify-center space-x-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear History Log</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* AUTH MODAL */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className={`rounded-[2rem] sm:rounded-[2.5rem] max-w-sm w-full p-5 sm:p-6 space-y-4 shadow-2xl border ${themeStyles.cardBg}`}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black">{isSignUp ? 'Create Account' : 'Welcome Back'}</h3>
              <button onClick={() => setShowAuthModal(false)} className="w-8 h-8 rounded-full bg-slate-800/30 flex items-center justify-center cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            {authError && (
              <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs font-bold">
                {authError}
              </div>
            )}

            <form onSubmit={handleAuthSubmit} className="space-y-3">
              {isSignUp && (
                <>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold opacity-70">Full Name (Required)</label>
                    <input 
                      type="text"
                      value={displayNameInput}
                      onChange={(e) => setDisplayNameInput(e.target.value)}
                      placeholder="Your Full Name..."
                      required
                      className={`w-full rounded-2xl px-4 py-2.5 text-xs focus:outline-none focus:border-indigo-500 ${themeStyles.inputBg}`}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold opacity-70">Mobile Number (Required)</label>
                    <input 
                      type="text"
                      value={phoneInput}
                      onChange={(e) => setPhoneInput(e.target.value)}
                      placeholder="+91 9876543210"
                      required
                      className={`w-full rounded-2xl px-4 py-2.5 text-xs focus:outline-none focus:border-indigo-500 ${themeStyles.inputBg}`}
                    />
                  </div>
                </>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-bold opacity-70">Email Address</label>
                <input 
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address..."
                  required
                  className={`w-full rounded-2xl px-4 py-2.5 text-xs focus:outline-none focus:border-indigo-500 ${themeStyles.inputBg}`}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold opacity-70">Password</label>
                <input 
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password (min 6 chars)..."
                  required
                  className={`w-full rounded-2xl px-4 py-2.5 text-xs focus:outline-none focus:border-indigo-500 ${themeStyles.inputBg}`}
                />
              </div>

              <button 
                type="submit" 
                disabled={authLoading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-3 rounded-2xl shadow-md transition-all cursor-pointer flex items-center justify-center space-x-2 mt-2"
              >
                <span>{authLoading ? 'Processing...' : (isSignUp ? 'Sign Up' : 'Sign In')}</span>
              </button>
            </form>

            <div className="text-center pt-1">
              <button 
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-xs font-bold text-indigo-400 hover:underline cursor-pointer"
              >
                {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NEW PROJECT MODAL */}
      {showProjectModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className={`rounded-[2rem] sm:rounded-[2.5rem] max-w-sm w-full p-5 sm:p-6 space-y-4 shadow-2xl border ${themeStyles.cardBg}`}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black">Create New Project</h3>
              <button onClick={() => setShowProjectModal(false)} className="w-8 h-8 rounded-full bg-slate-800/30 flex items-center justify-center cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="space-y-3">
              <input 
                type="text"
                value={newProjectTitle}
                onChange={(e) => setNewProjectTitle(e.target.value)}
                placeholder="Project title..."
                required
                className={`w-full rounded-2xl px-4 py-3 text-xs focus:outline-none focus:border-indigo-500 ${themeStyles.inputBg}`}
              />

              <input 
                type="text"
                value={newProjectDesc}
                onChange={(e) => setNewProjectDesc(e.target.value)}
                placeholder="Description..."
                className={`w-full rounded-2xl px-4 py-3 text-xs focus:outline-none focus:border-indigo-500 ${themeStyles.inputBg}`}
              />

              <select
                value={newProjectCategory}
                onChange={(e) => setNewProjectCategory(e.target.value)}
                className={`w-full rounded-2xl px-4 py-3 text-xs focus:outline-none ${themeStyles.inputBg}`}
              >
                <option value="Development">Development</option>
                <option value="SaaS">SaaS</option>
                <option value="Personal">Personal</option>
              </select>

              <button 
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-3 rounded-2xl shadow-md transition-all cursor-pointer"
              >
                Create Project
              </button>
            </form>
          </div>
        </div>
      )}

      {/* UNDO TOAST */}
      {showUndoToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl z-50 flex items-center space-x-3 text-xs animate-bounce border border-slate-700">
          <span>Task deleted.</span>
          <button onClick={undoDelete} className="text-indigo-400 font-bold hover:underline flex items-center space-x-1 cursor-pointer">
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Undo</span>
          </button>
        </div>
      )}

    </div>
  );
}