import React, { useState, useEffect, useId, useRef } from 'react';
import Layout from '../../components/Layout.jsx';
import { getMemories, updateMemory, deleteMemory } from '../../api/vault.js';
import { useUser } from '../../context/UserContext.jsx';
import {
  Brain,
  Search,
  Filter,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Edit3,
  Trash2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  X,
  ShieldAlert,
  ArrowRight,
  Info
} from 'lucide-react';

const MEMORY_TYPES = [
  { id: 'all', label: 'All Types' },
  { id: 'strength', label: 'Strength', color: 'emerald' },
  { id: 'weakness', label: 'Weakness', color: 'rose' },
  { id: 'mistake', label: 'Mistake', color: 'amber' },
  { id: 'learning_preference', label: 'Learning Preference', color: 'violet' },
  { id: 'concept_understood', label: 'Understood Concept', color: 'cyan' },
  { id: 'revision_needed', label: 'Revision Needed', color: 'fuchsia' }
];

const TOPICS = [
  'all',
  'arrays',
  'strings',
  'linked-list',
  'stacks-queues',
  'hashing',
  'sorting',
  'recursion',
  'trees',
  'graphs',
  'dp'
];

function formatTimeRemaining(expiresAt) {
  if (!expiresAt) return null;
  const expiry = new Date(expiresAt).getTime();
  const now = Date.now();
  const diffMs = expiry - now;

  if (diffMs <= 0) return 'Expired';
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h remaining`;
  if (hours > 0) return `${hours}h ${minutes}m remaining`;
  return `${minutes}m remaining`;
}

function formatDate(dateString) {
  if (!dateString) return 'Never';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return 'Unknown';
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getTypeStyle(type, isSuperseded) {
  if (isSuperseded) {
    return {
      badge: 'bg-slate-800 text-slate-400 border-slate-700',
      border: 'border-slate-800',
      bar: 'bg-slate-600',
      tag: 'text-slate-400'
    };
  }

  switch (type) {
    case 'strength':
      return {
        badge: 'bg-emerald-950/60 text-emerald-400 border-emerald-800/80',
        border: 'border-emerald-900/40 hover:border-emerald-700/60',
        bar: 'bg-emerald-500',
        tag: 'text-emerald-400'
      };
    case 'weakness':
      return {
        badge: 'bg-rose-950/60 text-rose-400 border-rose-800/80',
        border: 'border-rose-900/40 hover:border-rose-700/60',
        bar: 'bg-rose-500',
        tag: 'text-rose-400'
      };
    case 'mistake':
      return {
        badge: 'bg-amber-950/60 text-amber-400 border-amber-800/80',
        border: 'border-amber-900/40 hover:border-amber-700/60',
        bar: 'bg-amber-500',
        tag: 'text-amber-400'
      };
    case 'learning_preference':
      return {
        badge: 'bg-violet-950/60 text-violet-400 border-violet-800/80',
        border: 'border-violet-900/40 hover:border-violet-700/60',
        bar: 'bg-violet-500',
        tag: 'text-violet-400'
      };
    case 'concept_understood':
      return {
        badge: 'bg-cyan-950/60 text-cyan-400 border-cyan-800/80',
        border: 'border-cyan-900/40 hover:border-cyan-700/60',
        bar: 'bg-cyan-500',
        tag: 'text-cyan-400'
      };
    case 'revision_needed':
      return {
        badge: 'bg-fuchsia-950/60 text-fuchsia-400 border-fuchsia-800/80',
        border: 'border-fuchsia-900/40 hover:border-fuchsia-700/60',
        bar: 'bg-fuchsia-500',
        tag: 'text-fuchsia-400'
      };
    default:
      return {
        badge: 'bg-slate-800 text-slate-300 border-slate-700',
        border: 'border-slate-800 hover:border-slate-700',
        bar: 'bg-indigo-500',
        tag: 'text-slate-300'
      };
  }
}

export default function Vault() {
  const { user } = useUser();
  const [memories, setMemories] = useState([]);
  const [counts, setCounts] = useState({ active: 0, superseded: 0, corrected: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [selectedStatus, setSelectedStatus] = useState('active');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedTopic, setSelectedTopic] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Expand evidence tracking
  const [expandedEvidence, setExpandedEvidence] = useState({});

  // Inline editing state
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    content: '',
    topic: '',
    type: '',
    confidence: 0.95,
    expiresAt: ''
  });
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete modal state
  const [memoryToDelete, setMemoryToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const deleteDialogRef = useRef(null);

  const fetchVaultMemories = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = {};
      if (selectedStatus !== 'all') params.status = selectedStatus;
      if (selectedType !== 'all') params.type = selectedType;
      if (selectedTopic !== 'all') params.topic = selectedTopic;

      const res = await getMemories(params);
      setMemories(res.data.memories || []);
      setCounts(res.data.counts || { active: 0, superseded: 0, corrected: 0 });
    } catch (err) {
      console.error('Failed to load memories:', err);
      setError(err.response?.data?.error?.message || 'Failed to load Memory Vault items');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVaultMemories();
  }, [selectedStatus, selectedType, selectedTopic]);

  // Handle native dialog open / close for delete confirmation
  useEffect(() => {
    const dialog = deleteDialogRef.current;
    if (!dialog) return;

    if (memoryToDelete) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [memoryToDelete]);

  const toggleEvidence = (id) => {
    setExpandedEvidence(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const startEdit = (memory) => {
    setEditingId(memory._id);
    setEditForm({
      content: memory.content,
      topic: memory.topic,
      type: memory.type,
      confidence: memory.confidence ?? 0.95,
      expiresAt: memory.expiresAt ? new Date(memory.expiresAt).toISOString().slice(0, 16) : ''
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async (id) => {
    try {
      setSavingEdit(true);
      const payload = {
        content: editForm.content,
        topic: editForm.topic,
        type: editForm.type,
        confidence: Number(editForm.confidence) || 0.95,
        expiresAt: editForm.expiresAt ? new Date(editForm.expiresAt).toISOString() : null
      };

      const res = await updateMemory(id, payload);
      const updated = res.data.memory;

      setMemories(prev => prev.map(m => (m._id === id ? updated : m)));
      setEditingId(null);
      // Refresh count summary
      fetchVaultMemories();
    } catch (err) {
      alert('Failed to save correction: ' + (err.response?.data?.error?.message || err.message));
    } finally {
      setSavingEdit(false);
    }
  };

  const confirmDelete = async () => {
    if (!memoryToDelete) return;
    try {
      setDeleting(true);
      await deleteMemory(memoryToDelete._id);
      setMemories(prev => prev.filter(m => m._id !== memoryToDelete._id));
      setMemoryToDelete(null);
      // Refresh counts
      fetchVaultMemories();
    } catch (err) {
      alert('Failed to forget memory: ' + (err.response?.data?.error?.message || err.message));
    } finally {
      setDeleting(false);
    }
  };

  // Client-side text filter on content & evidence
  const filteredMemories = memories.filter(memory => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const matchesContent = memory.content?.toLowerCase().includes(query);
    const matchesTopic = memory.topic?.toLowerCase().includes(query);
    const matchesEvidence = memory.evidence?.some(e => e.text?.toLowerCase().includes(query));
    return matchesContent || matchesTopic || matchesEvidence;
  });

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-indigo-950/60 border border-indigo-800/80 rounded-xl text-indigo-400">
                <Brain className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                  Memory Vault
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800">
                    Person B
                  </span>
                </h1>
                <p className="text-sm text-slate-400 mt-0.5">
                  AI-extracted strengths, weaknesses, mistakes, and learning preferences scoped to your profile.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchVaultMemories}
              disabled={loading}
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
              title="Refresh memories"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Status Bar / Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/60 border border-slate-800/80 p-3 rounded-xl mb-6 backdrop-blur">
          <div className="flex items-center space-x-1 bg-slate-950/70 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setSelectedStatus('active')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition flex items-center space-x-2 ${
                selectedStatus === 'active'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>Active</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                selectedStatus === 'active' ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-800 text-slate-400'
              }`}>
                {counts.active}
              </span>
            </button>

            <button
              onClick={() => setSelectedStatus('corrected')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition flex items-center space-x-2 ${
                selectedStatus === 'corrected'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>Corrected</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                selectedStatus === 'corrected' ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-800 text-slate-400'
              }`}>
                {counts.corrected}
              </span>
            </button>

            <button
              onClick={() => setSelectedStatus('superseded')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition flex items-center space-x-2 ${
                selectedStatus === 'superseded'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>Superseded</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                selectedStatus === 'superseded' ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-800 text-slate-400'
              }`}>
                {counts.superseded}
              </span>
            </button>

            <button
              onClick={() => setSelectedStatus('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
                selectedStatus === 'all'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All Records
            </button>
          </div>

          {/* Quick Search */}
          <div className="relative min-w-[240px] flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search content or evidence..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950/80 border border-slate-800 rounded-lg pl-9 pr-8 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Filter Chips by Type */}
        <div className="mb-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
            <Filter className="w-3 h-3 text-slate-400" />
            <span>Filter by Type</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {MEMORY_TYPES.map(t => {
              const active = selectedType === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setSelectedType(t.id)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition border ${
                    active
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                      : 'bg-slate-900/80 text-slate-300 border-slate-800 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Filter Chips by Topic */}
        <div className="mb-6">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-slate-400" />
            <span>Filter by Topic</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {TOPICS.map(topic => {
              const active = selectedTopic === topic;
              return (
                <button
                  key={topic}
                  onClick={() => setSelectedTopic(topic)}
                  className={`px-2.5 py-0.5 rounded-md text-xs font-medium transition border capitalize ${
                    active
                      ? 'bg-slate-200 text-slate-900 border-slate-200 font-semibold shadow-sm'
                      : 'bg-slate-900/50 text-slate-400 border-slate-800/80 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  {topic === 'all' ? 'All Topics' : topic}
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Filters Bar */}
        {(selectedType !== 'all' || selectedTopic !== 'all' || searchQuery) && (
          <div className="flex items-center gap-2 mb-6 text-xs text-slate-400 bg-slate-900/40 px-3 py-2 rounded-lg border border-slate-800/60">
            <span>Filtering:</span>
            {selectedType !== 'all' && (
              <span className="bg-indigo-950 text-indigo-300 px-2 py-0.5 rounded border border-indigo-800">
                Type: {selectedType}
              </span>
            )}
            {selectedTopic !== 'all' && (
              <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
                Topic: {selectedTopic}
              </span>
            )}
            {searchQuery && (
              <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
                "{searchQuery}"
              </span>
            )}
            <button
              onClick={() => {
                setSelectedType('all');
                setSelectedTopic('all');
                setSearchQuery('');
              }}
              className="ml-auto text-indigo-400 hover:underline flex items-center gap-1 font-medium"
            >
              Clear filters
            </button>
          </div>
        )}

        {/* Content Area */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin text-indigo-400 mb-3" />
            <p className="text-sm">Accessing Memory Vault...</p>
          </div>
        ) : error ? (
          <div className="p-6 bg-rose-950/30 border border-rose-800/80 rounded-xl text-rose-300 flex items-center space-x-3">
            <AlertTriangle className="w-6 h-6 flex-shrink-0 text-rose-400" />
            <div>
              <p className="font-semibold text-sm">Failed to retrieve memory items</p>
              <p className="text-xs text-rose-400/90 mt-0.5">{error}</p>
            </div>
          </div>
        ) : filteredMemories.length === 0 ? (
          <div className="py-16 text-center border border-dashed border-slate-800 rounded-2xl bg-slate-900/20">
            <Brain className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-200">No memories match this filter</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Try adjusting your status, type, or topic filters, or complete coding practice to accumulate new memories.
            </p>
            {(selectedType !== 'all' || selectedTopic !== 'all' || selectedStatus !== 'active' || searchQuery) && (
              <button
                onClick={() => {
                  setSelectedStatus('active');
                  setSelectedType('all');
                  setSelectedTopic('all');
                  setSearchQuery('');
                }}
                className="mt-4 px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition"
              >
                Reset to Active Memories
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredMemories.map(memory => {
              const isSuperseded = memory.status === 'superseded';
              const isEditing = editingId === memory._id;
              const styles = getTypeStyle(memory.type, isSuperseded);
              const ttlCountdown = formatTimeRemaining(memory.expiresAt);
              const isEvidenceExpanded = !!expandedEvidence[memory._id];
              const evidenceCount = memory.evidence?.length || 0;
              const confidencePercent = Math.round((memory.confidence ?? 0.5) * 100);

              return (
                <div
                  key={memory._id}
                  className={`relative rounded-xl border p-5 transition flex flex-col justify-between ${
                    isSuperseded
                      ? 'bg-slate-900/30 border-dashed border-slate-800 text-slate-400 opacity-75'
                      : 'bg-slate-900/80 ' + styles.border + ' shadow-lg shadow-black/20'
                  }`}
                >
                  {/* Superseded Warning Banner */}
                  {isSuperseded && (
                    <div className="mb-3 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/80 text-xs text-slate-300 flex items-center justify-between">
                      <div className="flex items-center space-x-1.5">
                        <Info className="w-3.5 h-3.5 text-slate-400" />
                        <span>Superseded by more recent understanding</span>
                      </div>
                      {memory.supersededBy && (
                        <span className="text-[10px] text-slate-400 font-mono">
                          ID: {String(memory.supersededBy).slice(-6)}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Header Badges */}
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center space-x-2">
                        <span className={`text-[11px] font-semibold uppercase px-2.5 py-0.5 rounded-full border ${styles.badge}`}>
                          {memory.type?.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 capitalize">
                          {memory.topic}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2">
                        {memory.status === 'corrected' && (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-800 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                            Corrected
                          </span>
                        )}

                        {/* Inline Edit & Delete Buttons */}
                        {!isEditing && (
                          <div className="flex items-center space-x-1">
                            <button
                              onClick={() => startEdit(memory)}
                              className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
                              title="Correct / Edit Memory"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setMemoryToDelete(memory)}
                              className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/50 transition"
                              title="Forget / Delete Memory"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Content or Inline Edit Form */}
                    {isEditing ? (
                      <div className="my-3 space-y-3 p-3 bg-slate-950 rounded-lg border border-slate-800">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-400 mb-1">
                            Memory Content
                          </label>
                          <textarea
                            rows={3}
                            value={editForm.content}
                            onChange={(e) => setEditForm(prev => ({ ...prev, content: e.target.value }))}
                            className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[11px] font-medium text-slate-400 mb-1">Topic</label>
                            <select
                              value={editForm.topic}
                              onChange={(e) => setEditForm(prev => ({ ...prev, topic: e.target.value }))}
                              className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 capitalize"
                            >
                              {TOPICS.filter(t => t !== 'all').map(t => (
                                <option key={t} value={t}>{t}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-[11px] font-medium text-slate-400 mb-1">Type</label>
                            <select
                              value={editForm.type}
                              onChange={(e) => setEditForm(prev => ({ ...prev, type: e.target.value }))}
                              className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                            >
                              {MEMORY_TYPES.filter(t => t.id !== 'all').map(t => (
                                <option key={t.id} value={t.id}>{t.label}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-slate-400 mb-1">
                            Confidence ({Math.round(editForm.confidence * 100)}%)
                          </label>
                          <input
                            type="range"
                            min="0.1"
                            max="1.0"
                            step="0.05"
                            value={editForm.confidence}
                            onChange={(e) => setEditForm(prev => ({ ...prev, confidence: parseFloat(e.target.value) }))}
                            className="w-full accent-indigo-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-slate-400 mb-1">
                            Expiry (Optional TTL)
                          </label>
                          <input
                            type="datetime-local"
                            value={editForm.expiresAt}
                            onChange={(e) => setEditForm(prev => ({ ...prev, expiresAt: e.target.value }))}
                            className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                          />
                        </div>

                        <div className="flex items-center justify-end space-x-2 pt-2">
                          <button
                            type="button"
                            onClick={cancelEdit}
                            disabled={savingEdit}
                            className="px-2.5 py-1 text-xs text-slate-400 hover:text-white rounded border border-slate-700 hover:bg-slate-800 transition"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => saveEdit(memory._id)}
                            disabled={savingEdit}
                            className="px-3 py-1 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded font-medium transition"
                          >
                            {savingEdit ? 'Saving...' : 'Save Correction'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className={`text-sm font-medium mt-1 mb-3 leading-relaxed ${
                        isSuperseded ? 'text-slate-400 line-through decoration-slate-600' : 'text-slate-100'
                      }`}>
                        {memory.content}
                      </p>
                    )}

                    {/* Confidence Meter Bar */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="text-slate-400 font-medium">Confidence Score</span>
                        <span className="font-semibold text-slate-300">{confidencePercent}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${styles.bar}`}
                          style={{ width: `${confidencePercent}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* TTL Expiry Countdown Alert Badge if present */}
                    {ttlCountdown && (
                      <div className="mb-3 px-2.5 py-1 rounded bg-fuchsia-950/40 border border-fuchsia-800/60 flex items-center justify-between text-xs text-fuchsia-300">
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-fuchsia-400" />
                          <span>TTL Auto-Purge</span>
                        </span>
                        <span className="font-semibold">{ttlCountdown}</span>
                      </div>
                    )}
                  </div>

                  {/* Footer Stats & Evidence Drawer */}
                  <div className="pt-3 border-t border-slate-800/80">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <div className="flex items-center space-x-3">
                        <span>Used: <strong className="text-slate-300">{memory.useCount || 0}x</strong></span>
                        {memory.lastUsedAt && (
                          <span>Last: <span className="text-slate-300">{formatDate(memory.lastUsedAt)}</span></span>
                        )}
                      </div>

                      {evidenceCount > 0 && (
                        <button
                          onClick={() => toggleEvidence(memory._id)}
                          className="flex items-center space-x-1 text-indigo-400 hover:text-indigo-300 font-medium transition"
                        >
                          <span>Evidence ({evidenceCount})</span>
                          {isEvidenceExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                    </div>

                    {/* Expanded Evidence List */}
                    {isEvidenceExpanded && evidenceCount > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-800/60 space-y-2">
                        {memory.evidence.map((ev, idx) => (
                          <div
                            key={idx}
                            className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80 text-xs text-slate-300"
                          >
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="text-[10px] font-semibold uppercase px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700">
                                {ev.source || 'practice'}
                              </span>
                              <span className="text-[10px] text-slate-500">
                                {formatDate(ev.at)}
                              </span>
                            </div>
                            <p className="text-slate-300 text-[11px] leading-relaxed italic">
                              "{ev.text}"
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Delete Confirmation Modal using HTML dialog element */}
        <dialog
          ref={deleteDialogRef}
          aria-labelledby="delete-dialog-title"
          className="bg-slate-900 text-slate-100 p-0 rounded-2xl border border-slate-800 shadow-2xl backdrop:bg-black/70 backdrop:backdrop-blur-sm max-w-md w-full m-auto"
          onClose={() => setMemoryToDelete(null)}
        >
          {memoryToDelete && (
            <div className="p-6">
              <div className="flex items-center space-x-3 text-rose-400 mb-3">
                <div className="p-2 bg-rose-950/60 border border-rose-800 rounded-xl">
                  <ShieldAlert className="w-5 h-5 text-rose-400" />
                </div>
                <h3 id="delete-dialog-title" className="text-lg font-bold text-white">
                  Forget this memory?
                </h3>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed mb-4">
                You are about to permanently delete this insight from your AI profile:
              </p>

              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs text-slate-300 italic mb-5">
                "{memoryToDelete.content}"
              </div>

              <p className="text-[11px] text-slate-400 mb-6">
                Once forgotten, your AI mentor will reset its assumptions on this concept and will no longer tailor explanations to this pattern.
              </p>

              <div className="flex items-center justify-end space-x-3">
                <button
                  type="button"
                  autoFocus
                  onClick={() => setMemoryToDelete(null)}
                  disabled={deleting}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
                >
                  Keep Memory
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  disabled={deleting}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-500 text-white transition flex items-center space-x-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{deleting ? 'Forgetting...' : 'Forget Memory'}</span>
                </button>
              </div>
            </div>
          )}
        </dialog>
      </div>
    </Layout>
  );
}
