import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Radio, 
  Users, 
  Mic, 
  MicOff, 
  Settings, 
  Shield, 
  Volume2, 
  Zap, 
  MoreVertical, 
  Activity, 
  UserPlus, 
  ChevronLeft, 
  ChevronRight as ChevronRightIcon, 
  X, 
  Target, 
  FlaskConical, 
  Volume, 
  Battery, 
  Compass, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Plus, 
  Trash2, 
  Database, 
  Volume1, 
  Waves, 
  ArrowRightLeft, 
  UserMinus, 
  Signal,
  Globe,
  Lock,
  Wifi,
  Smartphone
} from 'lucide-react';
import { MurmurUser, UserStatus, Channel } from './types';

const CALLSIGN_SELF = 'GHOST 1-1';
const DEFAULT_CHANNEL_NAME = 'RED DE PRUEBAS';
const STORAGE_KEY = 'SENTINEL_PTT_STATE';

type VoiceProfile = 'POR_DEFECTO' | 'MUJER' | 'NIÑO' | 'ANCIANO';
type SettingsTab = 'AUDIO' | 'REDES' | 'OPERADORES';

const PITCH_MAP: Record<VoiceProfile, number> = {
  POR_DEFECTO: 1.0,
  MUJER: 1.25,
  NIÑO: 1.55,
  ANCIANO: 0.82
};

const ENCRYPTION_TYPES = ['AES-256 CTR', 'SALSA20', 'CHACHA20', 'DES-64', 'SIN CIFRADO'];

const StatusIcon: React.FC<{ status: UserStatus; size?: number; className?: string }> = ({ status, size = 20, className = "" }) => {
  switch (status) {
    case UserStatus.TALKING:
      return <Waves size={size} className={className} />;
    case UserStatus.ONLINE:
      return <CheckCircle2 size={size} className={className} />;
    case UserStatus.MUTED:
      return <MicOff size={size} className={className} />;
    case UserStatus.OFFLINE:
      return <XCircle size={size} className={className} />;
    default:
      return <Activity size={size} className={className} />;
  }
};

const INITIAL_USERS: MurmurUser[] = [
  { id: '1', callsign: CALLSIGN_SELF, status: UserStatus.ONLINE, channel: DEFAULT_CHANNEL_NAME, lat: 0, lng: 0 },
  { id: '2', callsign: 'BRAVO-6', status: UserStatus.ONLINE, channel: DEFAULT_CHANNEL_NAME, lat: 0, lng: 0 },
  { id: '3', callsign: 'SPECTER', status: UserStatus.MUTED, channel: 'SIN RED', lat: 0, lng: 0 },
];

const INITIAL_CHANNELS: Channel[] = [
  { id: 'default-1', name: DEFAULT_CHANNEL_NAME, userCount: 2, isActive: true, frequency: '446.00625', encryption: 'AES-256 CTR' },
  { id: 'diag-eco', name: 'Diagnóstico-Eco', userCount: 0, isActive: false, frequency: 'LOCAL', encryption: 'LOOPBACK' }
];

const App: React.FC = () => {
  const loadInitialState = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error("Error loading state", e);
    }
    return null;
  };

  const initialState = loadInitialState();

  const [users, setUsers] = useState<MurmurUser[]>(initialState?.users || INITIAL_USERS);
  const [channels, setChannels] = useState<Channel[]>(initialState?.channels || INITIAL_CHANNELS);
  const [selectedChannel, setSelectedChannel] = useState<string>(initialState?.selectedChannel || DEFAULT_CHANNEL_NAME);
  const [masterVolume, setMasterVolume] = useState(initialState?.masterVolume ?? 0.8);
  const [voiceProfile, setVoiceProfile] = useState<VoiceProfile>(initialState?.voiceProfile || 'POR_DEFECTO');

  const [isTransmitting, setIsTransmitting] = useState(false);
  const [activeMenuUser, setActiveMenuUser] = useState<string | null>(null);
  const [isEchoPlayback, setIsEchoPlayback] = useState(false);
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [isAddChannelModalOpen, setIsAddChannelModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('AUDIO');
  const [editingChannelId, setEditingChannelId] = useState<string | null>(null);
  const [newOperatorCallsign, setNewOperatorCallsign] = useState('');
  const [newOperatorChannel, setNewOperatorChannel] = useState('');
  const [newChannelName, setNewChannelName] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());

  const audioCtxRef = useRef<AudioContext | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    const stateToSave = { users, channels, selectedChannel, masterVolume, voiceProfile };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
  }, [users, channels, selectedChannel, masterVolume, voiceProfile]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getAudioContext = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  };

  const playTacticalChirp = useCallback((type: 'start' | 'end') => {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.connect(ctx.destination);
    masterGain.gain.setValueAtTime(masterVolume * 0.25, now);

    if (type === 'start') {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(900, now);
      osc.frequency.exponentialRampToValueAtTime(1400, now + 0.04);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(1, now + 0.005);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      osc.connect(g);
      g.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.06);
    } else if (type === 'end') {
      const bufferSize = ctx.sampleRate * 0.04; 
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.4, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      noise.connect(noiseGain);
      noiseGain.connect(masterGain);
      noise.start(now);
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now + 0.04);
      osc.frequency.setValueAtTime(660, now + 0.09);
      const toneGain = ctx.createGain();
      toneGain.gain.setValueAtTime(0, now + 0.04);
      toneGain.gain.linearRampToValueAtTime(0.8, now + 0.045);
      toneGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.connect(toneGain);
      toneGain.connect(masterGain);
      osc.start(now + 0.04);
      osc.stop(now + 0.15);
    }
  }, [masterVolume]);

  const cycleChannel = useCallback((direction: 'next' | 'prev') => {
    if (channels.length === 0) return;
    const currentIndex = channels.findIndex(c => c.name === selectedChannel);
    let nextIndex;
    if (currentIndex === -1) {
      nextIndex = 0;
    } else {
      nextIndex = direction === 'next' ? (currentIndex + 1) % channels.length : (currentIndex - 1 + channels.length) % channels.length;
    }
    const nextChannelName = channels[nextIndex].name;
    setSelectedChannel(nextChannelName);
    if ("vibrate" in navigator) navigator.vibrate(10);
  }, [channels, selectedChannel]);

  const startTransmission = useCallback(async () => {
    if (isTransmitting || !selectedChannel) return;
    setIsTransmitting(true);
    if ("vibrate" in navigator) navigator.vibrate([15, 30, 15]);
    setUsers(prev => prev.map(u => u.callsign === CALLSIGN_SELF ? { ...u, status: UserStatus.TALKING, channel: selectedChannel } : u));
    playTacticalChirp('start');

    if (selectedChannel === 'Diagnóstico-Eco') {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];
        mediaRecorder.ondataavailable = (event) => audioChunksRef.current.push(event.data);
        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const audioUrl = URL.createObjectURL(audioBlob);
          const audio = new Audio(audioUrl);
          audio.volume = masterVolume;
          audio.preservesPitch = false;
          audio.playbackRate = PITCH_MAP[voiceProfile];
          setIsEchoPlayback(true);
          setTimeout(() => {
            audio.play();
            audio.onended = () => {
              setIsEchoPlayback(false);
              URL.revokeObjectURL(audioUrl);
            };
          }, 400);
        };
        mediaRecorder.start();
      } catch (err) {
        console.error('Mic Access Denied:', err);
      }
    }
  }, [selectedChannel, isTransmitting, playTacticalChirp, masterVolume, voiceProfile]);

  const stopTransmission = useCallback(() => {
    if (!isTransmitting) return;
    setIsTransmitting(false);
    if ("vibrate" in navigator) navigator.vibrate(25);
    setUsers(prev => prev.map(u => u.callsign === CALLSIGN_SELF ? { ...u, status: UserStatus.ONLINE } : u));
    playTacticalChirp('end');
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  }, [isTransmitting, playTacticalChirp]);

  const moveUserToChannel = (userId: string, channelName: string) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, channel: channelName } : u));
    setActiveMenuUser(null);
  };

  const removeOperator = (userId: string) => {
    const targetUser = users.find(u => u.id === userId);
    if (!targetUser || targetUser.callsign === CALLSIGN_SELF) return;
    setUsers(prev => prev.filter(u => u.id !== userId));
    setActiveMenuUser(null);
    if ("vibrate" in navigator) navigator.vibrate([30, 10, 30]);
  };

  const handleAddOperator = () => {
    if (!newOperatorCallsign.trim()) return;
    const newUser: MurmurUser = {
      id: Math.random().toString(36).substr(2, 9),
      callsign: newOperatorCallsign.toUpperCase(),
      status: UserStatus.ONLINE,
      channel: newOperatorChannel || 'SIN RED',
      lat: 0,
      lng: 0
    };
    setUsers(prev => [...prev, newUser]);
    setNewOperatorCallsign('');
    setIsAddUserModalOpen(false);
  };

  const handleAddChannel = () => {
    if (!newChannelName.trim()) return;
    const newChan: Channel = {
      id: `c${Date.now()}`,
      name: newChannelName.trim().toUpperCase(),
      userCount: 0,
      isActive: false,
      frequency: '446.00000',
      encryption: 'AES-256 CTR'
    };
    setChannels(prev => [...prev, newChan]);
    if (!selectedChannel) setSelectedChannel(newChan.name);
    setNewChannelName('');
    setIsAddChannelModalOpen(false);
  };

  const handleRemoveChannel = (chanId: string) => {
    const chanToRemove = channels.find(c => c.id === chanId);
    if (!chanToRemove) return;
    setChannels(prev => prev.filter(c => c.id !== chanId));
    if (selectedChannel === chanToRemove.name) {
      setSelectedChannel(channels.find(c => c.id !== chanId)?.name || '');
    }
  };

  const updateChannelConfig = (chanId: string, updates: Partial<Channel>) => {
    setChannels(prev => prev.map(c => c.id === chanId ? { ...c, ...updates } : c));
    if (updates.name) {
      const oldName = channels.find(c => c.id === chanId)?.name;
      if (selectedChannel === oldName) setSelectedChannel(updates.name);
      setUsers(prev => prev.map(u => u.channel === oldName ? { ...u, channel: updates.name! } : u));
    }
  };

  const resetAllSettings = () => {
    if (confirm("¿Confirmar reinicio total de parámetros tácticos?")) {
      localStorage.removeItem(STORAGE_KEY);
      window.location.reload();
    }
  };

  const currentChannelData = channels.find(c => c.name === selectedChannel);

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0a0a0a] overflow-hidden text-sm uppercase mono font-['JetBrains_Mono'] select-none">
      <header className={`h-14 border-b flex items-center justify-between px-6 z-50 transition-colors duration-500 ${isTransmitting ? 'bg-red-950/60 border-red-500' : 'bg-[#111] border-white/10'}`}>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <Shield className={`w-6 h-6 ${isTransmitting ? 'text-red-500 animate-pulse' : 'text-green-500'}`} />
            <span className="font-extrabold tracking-tighter text-xl text-white/90">SENTINEL-PTT <span className="text-white/30 text-xs font-normal">V4.2.0-TAC</span></span>
          </div>
          <div className="hidden md:flex items-center gap-4 bg-black/40 px-3 py-1 border border-white/5 rounded">
            <Activity className={`w-3.5 h-3.5 ${isTransmitting ? 'text-red-500 animate-bounce' : 'text-green-500'}`} />
            <span className={`text-[10px] font-bold ${isTransmitting ? 'text-red-400' : 'text-green-400 animate-tactical-text'}`}>
              {isTransmitting ? 'TRANSMITIENDO' : 'SERVIDOR CIFRADO'}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-8">
          <div className="hidden lg:flex items-center gap-4 text-white/40 text-[10px] font-bold">
            <div className="flex items-center gap-2"><Clock className="w-3.5 h-3.5" /> {currentTime.toLocaleTimeString()} Z</div>
            <div className="flex items-center gap-2"><Battery className="w-3.5 h-3.5 text-green-500" /> 84%</div>
            <div className="flex items-center gap-2"><Compass className="w-3.5 h-3.5" /> 284° ONO</div>
          </div>
          <div className="flex gap-1">
            <button onClick={() => setIsSettingsOpen(true)} className="p-2 bg-white/5 border border-white/10 text-white/40 rounded hover:text-white transition-all" title="Ajustes del Sistema"><Settings className="w-4 h-4" /></button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Panel Izquierdo: Redes */}
        <aside className="flex-1 transition-all duration-300 border-r border-white/10 bg-[#0c0c0c] flex flex-col z-40 overflow-hidden relative">
          <div className="h-16 px-6 border-b border-white/10 bg-black/40 flex items-center justify-between shrink-0">
            <h2 className="flex items-center gap-3 font-black text-white/60 text-[11px] tracking-widest uppercase"><Radio className="w-5 h-5 text-green-500" /> REDES TÁCTICAS</h2>
            <button onClick={() => setIsAddChannelModalOpen(true)} className="p-2 bg-green-600/10 text-green-500 hover:bg-green-600 hover:text-white rounded border border-green-500/20 transition-all active:scale-90 shadow-lg" title="Añadir Red"><Plus className="w-4 h-4" /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
            {channels.map(ch => (
              <button
                key={ch.id}
                onClick={() => setSelectedChannel(ch.name)}
                className={`w-full flex flex-col p-4 rounded-sm transition-all border text-left relative group ${selectedChannel === ch.name ? 'bg-green-600/10 border-green-500/40 text-green-400 shadow-[inset_0_0_20px_rgba(34,197,94,0.05)]' : 'bg-white/5 border-white/5 text-white/30 hover:bg-white/10 hover:border-white/10'}`}
              >
                {selectedChannel === ch.name && <div className="absolute left-0 top-0 bottom-0 w-1 bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]" />}
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-3">
                    <div className={`w-1.5 h-1.5 rounded-full ${ch.name === 'Diagnóstico-Eco' ? 'bg-orange-500 animate-pulse' : ch.userCount > 0 ? 'bg-green-500' : 'bg-white/10'}`} />
                    <span className="font-black tracking-widest text-sm">{ch.name.toUpperCase()}</span>
                  </div>
                  <span className="text-[9px] font-black bg-black/40 px-2 py-0.5 rounded border border-white/5 tracking-tighter">[{ch.userCount} OP]</span>
                </div>
                <div className="flex items-center gap-4 ml-4.5 text-[9px] font-bold text-white/20 group-hover:text-white/40 transition-colors">
                  <span className="flex items-center gap-1.5"><Wifi className="w-3 h-3" /> {ch.frequency} MHZ</span>
                  <span className="flex items-center gap-1.5"><Lock className="w-3 h-3" /> {ch.encryption}</span>
                </div>
              </button>
            ))}
          </div>
        </aside>

        {/* Panel Derecho: Operadores (Simétrico al izquierdo) */}
        <aside className="flex-1 transition-all duration-300 bg-[#0c0c0c] flex flex-col z-40 overflow-hidden relative">
          <div className="h-16 px-6 border-b border-white/10 bg-black/40 flex items-center justify-between shrink-0">
            <h2 className="flex items-center gap-3 font-black text-white/60 text-[11px] tracking-widest uppercase"><Users className="w-5 h-5 text-green-500" /> OPERADORES</h2>
            <button onClick={() => setIsAddUserModalOpen(true)} className="p-2 bg-green-600/10 text-green-500 hover:bg-green-600 hover:text-white rounded border border-green-500/20 transition-all active:scale-90 shadow-lg" title="Añadir Operador"><UserPlus className="w-4 h-4" /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
            {users.map(user => (
              <div key={user.id} className={`p-3.5 border transition-all group relative rounded-sm ${user.status === UserStatus.TALKING ? 'bg-green-600/10 border-green-500/50' : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className={`w-11 h-11 border flex items-center justify-center bg-black/40 rounded-sm transition-all ${user.status === UserStatus.TALKING ? 'border-green-400 scale-105 shadow-[0_0_15px_rgba(34,197,94,0.3)]' : 'border-white/10'}`}>
                        <StatusIcon status={user.status} size={20} className={
                          user.status === UserStatus.TALKING ? 'text-green-500' :
                          user.status === UserStatus.ONLINE ? 'text-green-500' :
                          user.status === UserStatus.MUTED ? 'text-orange-500' :
                          'text-white/20'
                        } />
                      </div>
                      <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-[#0c0c0c] ${
                        user.status === UserStatus.TALKING ? 'bg-green-500 animate-pulse' : 
                        user.status === UserStatus.ONLINE ? 'bg-green-500' : 
                        user.status === UserStatus.MUTED ? 'bg-orange-500' : 
                        'bg-gray-500/30'
                      }`} />
                    </div>
                    <div>
                      <div className="font-black text-white text-[13px] tracking-widest">{user.callsign}</div>
                      <div className={`text-[9px] font-bold tracking-tight inline-flex items-center gap-1.5 ${user.status === UserStatus.TALKING ? 'text-green-400' : 'text-white/20'}`}>
                        <Smartphone className="w-2.5 h-2.5" /> {user.channel || 'OFFLINE'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button 
                      onClick={() => setActiveMenuUser(activeMenuUser === user.id ? null : user.id)} 
                      className={`p-2 rounded-sm transition-all ${activeMenuUser === user.id ? 'bg-green-600 text-white' : 'opacity-0 group-hover:opacity-100 bg-white/5 border border-white/10 text-white/40 hover:text-white'}`}
                      title="Gestionar Operador"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                    </button>
                    <button className="p-2 opacity-0 group-hover:opacity-100 bg-white/5 border border-white/10 rounded-sm hover:text-white transition-all"><MoreVertical className="w-3.5 h-3.5 text-white/40" /></button>
                  </div>
                </div>
                {activeMenuUser === user.id && (
                  <div className="mt-4 bg-[#080808] border border-green-500/50 p-4 rounded shadow-2xl animate-in fade-in slide-in-from-top-2 z-[60]">
                    <div className="space-y-4">
                      <div>
                        <div className="text-[10px] font-black text-green-400 mb-3 tracking-widest flex items-center gap-2 uppercase"><Signal className="w-3.5 h-3.5" /> REASIGNAR CANAL</div>
                        <div className="grid grid-cols-1 gap-1">
                          {channels.map(ch => (
                            <button
                              key={ch.id}
                              onClick={() => moveUserToChannel(user.id, ch.name)}
                              className={`w-full text-left p-3 text-[10px] font-black tracking-widest rounded-sm border transition-all ${user.channel === ch.name ? 'bg-green-600 border-green-400 text-white' : 'bg-white/5 border-transparent text-white/40 hover:bg-white/10 hover:text-white'}`}
                            >
                              {ch.name}
                            </button>
                          ))}
                        </div>
                      </div>
                      {user.callsign !== CALLSIGN_SELF && (
                        <div className="pt-3 border-t border-white/10">
                          <button
                            onClick={() => removeOperator(user.id)}
                            className="w-full flex items-center justify-center gap-2 p-3 bg-red-900/10 border border-red-500/20 text-red-500/60 text-[10px] font-black rounded-sm hover:bg-red-500/20 hover:text-red-400 transition-all uppercase tracking-widest"
                          >
                            <UserMinus className="w-4 h-4" /> ELIMINAR OPERADOR
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </aside>
      </div>

      <footer className="h-32 border-t border-white/10 bg-[#0a0a0a] flex items-center justify-center z-50 overflow-hidden relative shrink-0">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
           <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white to-transparent" />
           <div className="w-full h-full grid-bg" />
        </div>
        
        <div className="flex-1 flex flex-col items-center justify-center relative px-6 md:px-12">
           <div className="hidden md:flex absolute left-10 flex-col gap-1 text-[8px] font-black text-white/20 tracking-[0.2em] select-none">
              <span className="flex items-center gap-2"><Shield className="w-3 h-3" /> CANAL SEGURO</span>
              <span className="flex items-center gap-2 uppercase"><Activity className="w-3 h-3" /> {currentChannelData?.frequency || '---'} MHZ</span>
              <span className="flex items-center gap-2 uppercase"><Zap className="w-3 h-3 text-yellow-500/50" /> {currentChannelData?.encryption || '---'}</span>
           </div>

           <div className="flex items-center gap-6 md:gap-12 relative">
              {isEchoPlayback && <div className="absolute inset-x-0 -top-10 flex flex-col items-center justify-center pointer-events-none animate-pulse"><Volume className="w-5 h-5 text-orange-500 mb-1" /><span className="text-[7px] text-orange-400 font-black tracking-[0.3em]">RETORNO ACTIVO</span></div>}
              
              <button onClick={() => cycleChannel('prev')} disabled={channels.length < 2} className={`p-4 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 transition-all active:scale-90 group touch-none disabled:opacity-20`}>
                <ChevronLeft className="w-6 h-6 text-white/40 group-hover:text-white transition-colors" />
              </button>
              
              <div className="relative">
                <div className={`absolute -inset-4 rounded-full transition-all duration-300 ${isTransmitting ? 'bg-red-500/20 scale-110 blur-xl opacity-100' : 'opacity-0 scale-90'}`} />
                <button
                  onMouseDown={startTransmission} 
                  onMouseUp={stopTransmission} 
                  onMouseLeave={stopTransmission}
                  onTouchStart={(e) => { e.preventDefault(); startTransmission(); }}
                  onTouchEnd={(e) => { e.preventDefault(); stopTransmission(); }}
                  disabled={!selectedChannel}
                  className={`w-20 h-20 rounded-full flex flex-col items-center justify-center transition-all relative z-10 border-2 touch-none select-none disabled:grayscale disabled:opacity-20 ${isTransmitting ? (selectedChannel === 'Diagnóstico-Eco' ? 'bg-orange-600 border-orange-400 ptt-active' : 'bg-red-600 border-red-400 ptt-active') : 'bg-[#1a1a1a] border-white/10 ptt-idle shadow-[0_0_20px_rgba(0,0,0,0.5)] hover:bg-[#222] hover:border-white/20'}`}
                >
                  {isTransmitting ? <Mic className="w-7 h-7 mb-1 text-white" /> : <MicOff className="w-7 h-7 mb-1 text-white/20" />}
                  <span className={`text-[9px] font-black tracking-[0.2em] ${isTransmitting ? 'text-white' : 'text-white/20'}`}>{isTransmitting ? 'EMITIENDO' : 'PUSH'}</span>
                </button>
              </div>

              <button onClick={() => cycleChannel('next')} disabled={channels.length < 2} className={`p-4 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 transition-all active:scale-90 group touch-none disabled:opacity-20`}>
                <ChevronRightIcon className="w-6 h-6 text-white/40 group-hover:text-white transition-colors" />
              </button>
           </div>

           <div className="hidden md:flex absolute right-10 text-right flex flex-col items-end gap-1 text-[8px] font-black text-white/20 tracking-[0.2em] select-none">
              <div className="flex items-center gap-2">42MS <Globe className="w-3 h-3 text-green-500/40" /></div>
              <div className="flex items-center gap-2">64 KBPS <Activity className="w-3 h-3 text-blue-500/40" /></div>
              <div className="flex items-center gap-2 uppercase tracking-tighter"><span className="text-green-500">OPTIMIZADO</span> <Smartphone className="w-3 h-3" /></div>
           </div>
        </div>
      </footer>

      {/* Modales - Se mantienen pero se ajusta el estilo visual para match */}
      {isAddUserModalOpen && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[100] backdrop-blur-md p-4">
          <div className="w-full max-w-[440px] bg-[#0f0f0f] border border-white/10 p-8 relative shadow-[0_0_50px_rgba(0,0,0,0.5)]">
            <div className="absolute top-0 left-0 w-full h-0.5 bg-green-500 animate-pulse" />
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-white font-black tracking-[0.2em] text-lg flex items-center gap-3 uppercase"><UserPlus className="w-6 h-6 text-green-500" /> ALTA OPERADOR</h3>
              <button onClick={() => setIsAddUserModalOpen(false)} className="text-white/20 hover:text-white transition-colors"><X className="w-6 h-6" /></button>
            </div>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-white/30 tracking-widest uppercase flex items-center gap-2"><Target className="w-3.5 h-3.5" /> INDICATIVO / CALLSIGN</label>
                <input autoFocus value={newOperatorCallsign} onChange={(e) => setNewOperatorCallsign(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddOperator()} placeholder="EJ: STRIKER 1" className="w-full bg-black/50 border border-white/10 p-4 text-white focus:border-green-500 outline-none transition-all font-black text-base placeholder:text-white/5 uppercase" />
              </div>
              <button onClick={handleAddOperator} disabled={!newOperatorCallsign.trim()} className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-20 p-4 font-black tracking-[0.3em] text-white shadow-lg active:scale-95 transition-all flex items-center justify-center gap-3 uppercase text-xs">INTEGRAR EN MALLA <Shield className="w-5 h-5" /></button>
            </div>
          </div>
        </div>
      )}

      {isAddChannelModalOpen && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[100] backdrop-blur-md p-4">
          <div className="w-full max-w-[440px] bg-[#0f0f0f] border border-white/10 p-8 relative shadow-[0_0_50px_rgba(0,0,0,0.5)]">
            <div className="absolute top-0 left-0 w-full h-0.5 bg-green-500 animate-pulse" />
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-white font-black tracking-[0.2em] text-lg flex items-center gap-3 uppercase"><Signal className="w-6 h-6 text-green-500" /> CREAR NODO</h3>
              <button onClick={() => setIsAddChannelModalOpen(false)} className="text-white/20 hover:text-white transition-colors"><X className="w-6 h-6" /></button>
            </div>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-white/30 tracking-widest uppercase flex items-center gap-2"><Radio className="w-3.5 h-3.5" /> NOMBRE DE LA RED</label>
                <input autoFocus value={newChannelName} onChange={(e) => setNewChannelName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddChannel()} placeholder="EJ: TACTIC-01" className="w-full bg-black/50 border border-white/10 p-4 text-white focus:border-green-500 outline-none transition-all font-black text-base placeholder:text-white/5 uppercase" />
              </div>
              <button onClick={handleAddChannel} disabled={!newChannelName.trim()} className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-20 p-4 font-black tracking-[0.3em] text-white shadow-lg active:scale-95 transition-all flex items-center justify-center gap-3 uppercase text-xs">DESPLEGAR FRECUENCIA <Zap className="w-5 h-5" /></button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ajustes Avanzado */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[110] backdrop-blur-xl">
          <div className="w-full max-w-[840px] h-full max-h-[720px] bg-[#0c0c0c] border border-white/10 flex flex-col shadow-[0_0_100px_rgba(0,0,0,0.8)] mx-2">
            <div className="h-16 bg-white/5 border-b border-white/10 flex items-center justify-between px-6">
              <div className="flex items-center gap-6">
                <button onClick={() => setIsSettingsOpen(false)} className="flex items-center gap-2 text-white/30 hover:text-white transition-all pr-4 border-r border-white/10 group">
                  <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                  <span className="text-[10px] font-black tracking-widest uppercase">REGRESAR</span>
                </button>
                <h3 className="font-black tracking-[0.2em] text-white/90 uppercase text-xs">SISTEMA SENTINEL - CONFIGURACIÓN CENTRAL</h3>
              </div>
              <button onClick={() => setIsSettingsOpen(false)} className="text-white/20 hover:text-white transition-all"><X className="w-5 h-5" /></button>
            </div>

            <div className="flex-1 flex min-h-0">
              <div className="w-20 md:w-56 border-r border-white/10 bg-black/40 flex flex-col p-2 gap-1 shrink-0">
                {(['AUDIO', 'REDES', 'OPERADORES'] as SettingsTab[]).map(tab => (
                  <button
                    key={tab}
                    onClick={() => { setSettingsTab(tab); setEditingChannelId(null); }}
                    className={`flex items-center gap-3 px-4 py-4 text-[10px] font-black tracking-widest transition-all rounded-sm border ${settingsTab === tab ? 'bg-green-600/10 border-green-500 text-green-400 shadow-[inset_0_0_15px_rgba(34,197,94,0.1)]' : 'bg-transparent border-transparent text-white/30 hover:bg-white/5'}`}
                  >
                    {tab === 'AUDIO' && <Volume2 className="w-4 h-4" />}
                    {tab === 'REDES' && <Radio className="w-4 h-4" />}
                    {tab === 'OPERADORES' && <Users className="w-4 h-4" />}
                    <span className="hidden md:inline">{tab}</span>
                  </button>
                ))}
                
                <div className="mt-auto p-2">
                   <button onClick={resetAllSettings} className="w-full flex items-center gap-3 px-4 py-4 text-[9px] font-black tracking-widest text-red-500 hover:bg-red-500/10 rounded-sm transition-all border border-transparent hover:border-red-500/50">
                     <Trash2 className="w-3.5 h-3.5" /> REINICIO MAESTRO
                   </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar">
                {settingsTab === 'AUDIO' && (
                  <div className="space-y-12 animate-in fade-in duration-300">
                    <div className="space-y-5">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-black text-white/30 tracking-widest flex items-center gap-2 uppercase"><Volume2 className="w-4 h-4" /> VOLUMEN PRINCIPAL</label>
                        <span className="text-green-500 font-black text-xs">{Math.round(masterVolume * 100)}%</span>
                      </div>
                      <div className="relative group p-4 bg-white/5 border border-white/5 rounded-sm">
                        <input type="range" min="0" max="1" step="0.01" value={masterVolume} onChange={(e) => setMasterVolume(parseFloat(e.target.value))} className="w-full accent-green-600 bg-white/10 h-1.5 rounded-lg appearance-none cursor-pointer" />
                      </div>
                    </div>
                  </div>
                )}
                
                {settingsTab === 'REDES' && (
                  <div className="space-y-8 h-full flex flex-col animate-in fade-in duration-300">
                    {!editingChannelId ? (
                      <>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-[10px] font-black text-white/30 tracking-widest flex items-center gap-2 uppercase"><Radio className="w-4 h-4" /> ADMINISTRAR NODOS</label>
                          <button onClick={() => setIsAddChannelModalOpen(true)} className="flex items-center gap-2 px-3 py-1.5 bg-green-600/10 border border-green-500/20 text-green-500 text-[10px] font-bold hover:bg-green-600 hover:text-white transition-all rounded-sm"><Plus className="w-3 h-3" /> AGREGAR</button>
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                          {channels.map(ch => (
                            <div key={ch.id} className="flex flex-col p-5 bg-white/5 border border-white/10 rounded-sm hover:border-white/20 transition-all group">
                              <div className="flex items-center justify-between">
                                <div className="flex flex-col">
                                  <span className="font-black tracking-[0.1em] text-white/80 uppercase">{ch.name}</span>
                                  <div className="flex gap-4 mt-2">
                                    <span className="text-[9px] font-black text-white/20 flex items-center gap-1.5 uppercase"><Wifi className="w-3 h-3" /> {ch.frequency} MHZ</span>
                                    <span className="text-[9px] font-black text-white/20 flex items-center gap-1.5 uppercase"><Lock className="w-3 h-3" /> {ch.encryption}</span>
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <button onClick={() => setEditingChannelId(ch.id)} className="p-3 bg-white/5 border border-white/10 text-white/30 hover:text-white hover:border-white/30 rounded-sm transition-all" title="Editar"><Settings className="w-4 h-4" /></button>
                                  {ch.name !== selectedChannel && ch.id !== 'diag-eco' && (
                                    <button onClick={() => handleRemoveChannel(ch.id)} className="p-3 bg-red-950/20 border border-red-500/20 text-red-500/40 hover:text-red-400 hover:border-red-500 transition-all rounded-sm" title="Eliminar"><Trash2 className="w-4 h-4" /></button>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="flex items-center gap-5 pb-8 border-b border-white/10">
                          <button onClick={() => setEditingChannelId(null)} className="p-3 bg-white/5 border border-white/10 text-white/40 hover:text-white rounded-sm transition-all active:scale-90"><ChevronLeft className="w-5 h-5" /></button>
                          <div>
                            <h4 className="font-black text-green-500 tracking-[0.2em] text-lg uppercase">CONFIGURACIÓN AVANZADA</h4>
                            <p className="text-[9px] font-black text-white/20 mt-1 uppercase">ESTADO ACTUAL: ACTIVO // NODO: {channels.find(c => c.id === editingChannelId)?.name}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-10">
                          <div className="space-y-3">
                            <label className="text-[10px] font-black text-white/30 tracking-widest uppercase flex items-center gap-2"><Target className="w-4 h-4 text-green-500/50" /> IDENTIFICADOR DE RED</label>
                            <input 
                              type="text" 
                              value={channels.find(c => c.id === editingChannelId)?.name || ''} 
                              onChange={(e) => updateChannelConfig(editingChannelId!, { name: e.target.value })} 
                              className="w-full bg-black/50 border border-white/10 p-5 text-white font-black tracking-widest focus:border-green-500 outline-none transition-all uppercase rounded-sm text-base"
                            />
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                            <div className="space-y-3">
                              <label className="text-[10px] font-black text-white/30 tracking-widest uppercase flex items-center gap-2"><Wifi className="w-4 h-4 text-green-500/50" /> FRECUENCIA CENTRAL (MHZ)</label>
                              <input 
                                type="text" 
                                value={channels.find(c => c.id === editingChannelId)?.frequency || ''} 
                                onChange={(e) => updateChannelConfig(editingChannelId!, { frequency: e.target.value })} 
                                className="w-full bg-black/50 border border-white/10 p-5 text-white font-black tracking-widest focus:border-green-500 outline-none transition-all rounded-sm text-base"
                              />
                            </div>

                            <div className="space-y-3">
                              <label className="text-[10px] font-black text-white/30 tracking-widest uppercase flex items-center gap-2"><Lock className="w-4 h-4 text-green-500/50" /> PROTOCOLO ENCRIPTACIÓN</label>
                              <div className="relative">
                                <select 
                                  value={channels.find(c => c.id === editingChannelId)?.encryption || ''} 
                                  onChange={(e) => updateChannelConfig(editingChannelId!, { encryption: e.target.value })}
                                  className="w-full bg-black/50 border border-white/10 p-5 text-white font-black tracking-widest focus:border-green-500 outline-none transition-all appearance-none rounded-sm uppercase text-base cursor-pointer"
                                >
                                  {ENCRYPTION_TYPES.map(enc => (
                                    <option key={enc} value={enc} className="bg-[#111]">{enc}</option>
                                  ))}
                                </select>
                                <ChevronRightIcon className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 pointer-events-none rotate-90" />
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="pt-10 border-t border-white/5">
                           <button onClick={() => setEditingChannelId(null)} className="w-full bg-green-600 hover:bg-green-500 p-5 text-white font-black tracking-[0.3em] shadow-lg active:scale-[0.98] transition-all rounded-sm uppercase text-xs">ACTUALIZAR PARÁMETROS DE RED</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {settingsTab === 'OPERADORES' && (
                  <div className="space-y-8 animate-in fade-in duration-300">
                    <div className="flex items-center justify-between mb-4">
                      <label className="text-[10px] font-black text-white/30 tracking-widest uppercase flex items-center gap-2"><Users className="w-4 h-4 text-green-500/50" /> PERSONAL AUTORIZADO</label>
                      <button onClick={() => setIsAddUserModalOpen(true)} className="flex items-center gap-2 px-3 py-1.5 bg-green-600/10 border border-green-500/20 text-green-500 text-[10px] font-bold hover:bg-green-600 hover:text-white transition-all rounded-sm"><UserPlus className="w-3.5 h-3.5" /> RECLUTAR</button>
                    </div>
                    <div className="space-y-3">
                      {users.map(u => (
                        <div key={u.id} className="flex items-center justify-between p-5 bg-white/5 border border-white/5 rounded-sm group hover:border-white/10 transition-all">
                          <div className="flex items-center gap-5">
                            <div className={`w-2.5 h-2.5 rounded-full ${u.status === UserStatus.ONLINE || u.status === UserStatus.TALKING ? 'bg-green-500' : 'bg-white/10'}`} />
                            <div>
                               <span className="font-black tracking-widest text-white/90 uppercase text-sm">{u.callsign}</span>
                               <div className="text-[9px] font-black text-white/20 mt-1 uppercase tracking-widest flex items-center gap-2"><Smartphone className="w-2.5 h-2.5" /> Malla: {u.channel}</div>
                            </div>
                          </div>
                          {u.callsign !== CALLSIGN_SELF && (
                            <button onClick={() => removeOperator(u.id)} className="p-3 text-white/10 hover:text-red-500 hover:bg-red-500/10 transition-all rounded-sm"><Trash2 className="w-4.5 h-4.5" /></button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="h-16 bg-black/40 border-t border-white/10 flex items-center justify-end px-8">
              <button onClick={() => setIsSettingsOpen(false)} className="bg-green-600 text-white font-black tracking-[0.2em] px-10 py-3 rounded-sm text-[10px] shadow-lg active:scale-95 transition-all uppercase hover:bg-green-500">CONFIRMAR CAMBIOS</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;