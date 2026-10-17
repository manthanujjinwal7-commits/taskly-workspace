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
import { Session } from '@supabase/supabase-js';

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
  const [session, setSession] = useState<Session | null>(null);
  const [appLoading, setAppLoading] = useState<boolean>(true);

  // Theme Management (White, Black, Dark Blue)
  const [theme, setTheme] = useState<ThemeMode>(() => {
    return (localStorage.getItem('taskly_theme') as ThemeMode) || 'black';
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
      setAppLoading(false);
      if (session?.user) {
        setDisplayNameInput(session.user.user_metadata?.full_name || session.user.user_metadata?.display_name || '');
        setPhoneInput(session.user.user_metadata?.phone || session.user.phone || '');
      }
    }).catch(() => {
      setAppLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setAppLoading(false);
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

  if (appLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-black text-white text-base md:text-xl font-bold">
        Loading Taskly...
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${themeStyles.bg} flex flex-col font-sans pb-48 selection:bg-indigo-500 selection:text-white transition-colors duration-300 text-base md:text-lg`}>
      
      {/* FORCE LOGIN MODAL (Agar user logged in nahi hai) */}
      {!session && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-3xl p-6 md:p-8 shadow-2xl text-white">
            <h2 className="text-2xl md:text-3xl font-extrabold text-center mb-2 text-indigo-400 tracking-tight">
              Welcome to Taskly
            </h2>
            <p className="text-gray-400 text-center text-sm md:text-base mb-6">
              Please sign in or create an account to manage your tasks.
            </p>

            {authError && (
              <div className="mb-4 p-3 bg-red-900/50 border border-red-700 text-red-200 text-xs md:text-sm rounded-xl">
                {authError}
              </div>
            )}

            <form onSubmit={handleAuthSubmit} className="space-y-4">
              <div>
                <label className="block text-xs md:text-sm font-medium text-gray-300 mb-1">Email Address</label>
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="abcd@gmail.com"
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 text-sm md:text-base text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs md:text-sm font-medium text-gray-300 mb-1">Password</label>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 text-sm md:text-base text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <button 
                type="submit"
                disabled={authLoading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl text-sm md:text-base transition shadow-lg cursor-pointer"
              >
                {authLoading ? 'Processing...' : (isSignUp ? 'Create Account' : 'Sign In')}
              </button>
            </form>

            <div className="mt-4 text-center">
              <button 
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-xs md:text-sm text-indigo-400 hover:underline cursor-pointer"
              >
                {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
              </button>
            </div>
          </div>
        </div>
      )}

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
            <h1 className="text-sm sm:text-base font-extrabold group-hover:text-indigo-500 transition-colors">
              Hello, {userName}
            </h1>
            <p className={`text-xs sm:text-sm font-medium ${themeStyles.textMuted} flex items-center gap-1`}>
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              <span>Progress: {progressPercentage}%</span>
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Streak Badge */}
          <div className="flex items-center space-x-1 px-2.5 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-500 rounded-full text-xs sm:text-sm font-black" title="Daily Completion Streak">
            <Flame className="w-4 h-4 fill-amber-500" />
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
              className="text-xs sm:text-sm font-bold text-white bg-indigo-600 border border-indigo-500 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-full hover:bg-indigo-700 transition-colors shadow-sm cursor-pointer flex items-center space-x-1"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          ) : (
            <button 
              onClick={() => setShowAuthModal(true)}
              className="text-xs sm:text-sm font-bold text-white bg-indigo-600 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full shadow-md hover:bg-indigo-700 transition-colors cursor-pointer flex items-center space-x-1"
            >
              <LogIn className="w-4 h-4" />
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
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-indigo-600 rounded-full"></span>
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
                  <span className="text-[10px] sm:text-xs font-extrabold tracking-wider uppercase bg-white/50 text-indigo-900 px-3 py-1 rounded-full">
                    Taskly Workspace
                  </span>
                  <span className="text-xs font-semibold text-slate-700 bg-white/30 px-2.5 py-0.5 rounded-md">
                    Press <kbd className="font-mono bg-white px-1 rounded shadow-xs">N</kbd> for quick task
                  </span>
                </div>

                <h2 className="text-xl sm:text-3xl font-black mt-3 mb-1">
                  {userName}'s Dashboard
                </h2>
                <p className="text-sm sm:text-base text-slate-800 font-medium">
                  {completedCount} of {tasks.length} tasks completed this week.
                </p>
              </div>

              {nextUpTask && (
                <div className="mt-4 p-3.5 bg-white/70 backdrop-blur-xs rounded-2xl border border-white/80 flex items-center justify-between z-10">
                  <div className="flex items-center space-x-2 min-w-0 pr-2">
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-indigo-600 text-white rounded-md">
                      Next Up
                    </span>
                    <span className="text-sm sm:text-base font-bold text-slate-900 truncate">{nextUpTask.title}</span>
                  </div>
                  <button 
                    onClick={() => toggleTask(nextUpTask.id)}
                    className="text-xs font-bold px-3 py-1.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition shrink-0 cursor-pointer"
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
                className={`p-4 rounded-[1.5rem] sm:rounded-[2rem] shadow-sm border transition-all cursor-pointer ${filter === 'All' ? 'bg-indigo-600 text-white border-indigo-600' : themeStyles.cardBg}`}
              >
                <span className="text-xs font-bold uppercase opacity-80">Total</span>
                <p className="text-xl sm:text-2xl font-black mt-1">{tasks.length}</p>
              </div>

              <div 
                onClick={() => setFilter('Work')} 
                className={`p-4 rounded-[1.5rem] sm:rounded-[2rem] shadow-sm border transition-all cursor-pointer ${filter === 'Work' ? 'bg-indigo-600 text-white border-indigo-600' : themeStyles.cardBg}`}
              >
                <span className="text-xs font-bold uppercase text-indigo-400">Work</span>
                <p className="text-xl sm:text-2xl font-black mt-1">{tasks.filter(t => t.category === 'Work').length}</p>
              </div>

              <div 
                onClick={() => setFilter('Urgent')} 
                className={`p-4 rounded-[1.5rem] sm:rounded-[2rem] shadow-sm border transition-all cursor-pointer ${filter === 'Urgent' ? 'bg-indigo-600 text-white border-indigo-600' : themeStyles.cardBg}`}
              >
                <span className="text-xs font-bold uppercase text-amber-500">Urgent</span>
                <p className="text-xl sm:text-2xl font-black mt-1">{tasks.filter(t => t.category === 'Urgent').length}</p>
              </div>

              <div 
                onClick={() => setFilter('Overdue')} 
                className={`p-4 rounded-[1.5rem] sm:rounded-[2rem] shadow-sm border transition-all cursor-pointer ${filter === 'Overdue' ? 'bg-rose-600 text-white border-rose-600' : themeStyles.cardBg}`}
              >
                <span className="text-xs font-bold uppercase text-rose-500 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> Overdue
                </span>
                <p className="text-xl sm:text-2xl font-black mt-1 text-rose-500">{overdueTasksCount}</p>
              </div>
            </div>

            {/* TASK MANAGEMENT SECTION */}
            <div className={`p-4 sm:p-6 rounded-[2rem] sm:rounded-[2.5rem] shadow-sm border space-y-4 sm:space-y-5 ${themeStyles.cardBg}`}>
              
              <form onSubmit={handleSaveTask} className={`space-y-3 p-4 rounded-2xl sm:rounded-3xl border ${themeStyles.cardSubBg}`}>
                <input 
                  ref={taskInputRef}
                  type="text"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="Add a new task... (Press 'N' to focus)"
                  className={`w-full rounded-xl sm:rounded-2xl px-4 py-3 text-sm md:text-base focus:outline-none focus:border-indigo-500 shadow-sm ${themeStyles.inputBg}`}
                />

                <div className="flex items-center justify-between gap-2">
                  <div className="flex gap-1.5">
                    {(['Work', 'Personal', 'Urgent'] as const).map(cat => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSelectedCategory(cat)}
                        className={`text-xs px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
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
                    className={`rounded-xl px-3 py-1.5 text-xs md:text-sm focus:outline-none ${themeStyles.inputBg}`}
                    title="Due Date"
                  />

                  <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs md:text-sm font-bold px-4 py-2.5 rounded-xl shadow-md transition-all cursor-pointer flex items-center space-x-1">
                    <Plus className="w-4 h-4" />
                    <span>Add Task</span>
                  </button>
                </div>
              </form>

              <div className="space-y-3">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 opacity-40" />
                  <input 
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search tasks..."
                    className={`w-full rounded-xl sm:rounded-2xl pl-11 pr-4 py-2.5 text-sm md:text-base focus:outline-none shadow-sm ${themeStyles.inputBg}`}
                  />
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1">
                  {(['All', 'Work', 'Personal', 'Urgent', 'Overdue'] as const).map(cat => (
                    <button
                      key={cat}
                      onClick={() => setFilter(cat)}
                      className={`text-xs md:text-sm px-3.5 py-1.5 rounded-full font-bold transition-all cursor-pointer whitespace-nowrap ${
                        filter === cat ? 'bg-indigo-600 text-white' : 'bg-slate-800/10 opacity-70 hover:opacity-100'
                      }`}
                    >
                      {cat} {cat === 'Overdue' && `(${overdueTasksCount})`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Task List Items */}
              <div className="space-y-2.5">
                {filteredTasks.length === 0 ? (
                  <p className="text-center py-6 text-xs md:text-sm opacity-60">No tasks found.</p>
                ) : (
                  filteredTasks.map(task => (
                    <div 
                      key={task.id}
                      className={`p-3.5 sm:p-4 rounded-2xl border flex items-center justify-between transition-all ${themeStyles.cardSubBg}`}
                    >
                      <div className="flex items-center space-x-3 min-w-0 pr-2">
                        <button 
                          onClick={() => toggleTask(task.id)}
                          className="text-indigo-600 hover:scale-110 transition-transform cursor-pointer shrink-0"
                        >
                          {task.is_completed ? (
                            <CheckCircle2 className="w-5 h-5 text-indigo-500 fill-indigo-500/20" />
                          ) : (
                            <Circle className="w-5 h-5 opacity-40" />
                          )}
                        </button>
                        <div className="min-w-0">
                          <p className={`text-sm md:text-base font-semibold truncate ${task.is_completed ? 'line-through opacity-50' : ''}`}>
                            {task.title}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] md:text-xs font-bold px-2 py-0.5 bg-indigo-500/10 text-indigo-400 rounded-md">
                              {task.category}
                            </span>
                            {task.due_date && (
                              <span className="text-[10px] md:text-xs opacity-60 flex items-center gap-1">
                                <Clock className="w-3 h-3" /> {formatDate(task.due_date)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1 shrink-0">
                        <button 
                          onClick={() => startEdit(task)}
                          className="p-1.5 opacity-60 hover:opacity-100 transition"
                          title="Edit Task"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => deleteTask(task.id)}
                          className="p-1.5 text-rose-500 opacity-80 hover:opacity-100 transition"
                          title="Delete Task"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

            </div>

          </div>
        )}

      </main>

      {/* BOTTOM NAVIGATION BAR */}
      <nav className={`fixed bottom-4 left-1/2 -translate-x-1/2 w-[90%] max-w-md rounded-full px-4 py-3 shadow-2xl backdrop-blur-lg border flex items-center justify-around z-40 ${themeStyles.navBg}`}>
        {[
          { name: 'Overview', icon: LayoutDashboard },
          { name: 'Tasks', icon: CheckSquare },
          { name: 'Projects', icon: FolderKanban },
          { name: 'Progress', icon: TrendingUp },
          { name: 'Profile', icon: User }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.name;
          return (
            <button
              key={tab.name}
              onClick={() => setActiveTab(tab.name as any)}
              className={`flex flex-col items-center space-y-0.5 px-3 py-1 rounded-full transition-all cursor-pointer ${
                isActive ? 'text-indigo-400 scale-105' : 'opacity-60 hover:opacity-100'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] md:text-xs font-bold">{tab.name}</span>
            </button>
          );
        })}
      </nav>

    </div>
  );
}