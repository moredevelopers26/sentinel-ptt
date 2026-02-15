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
  Globe
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

// @fix: Componente StatusIcon para retroalimentación visual de los estados de usuario.
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
];

const INITIAL_CHANNELS: Channel[] = [
  { id: 'default-1', name: DEFAULT_CHANNEL_NAME, userCount: 1, isActive: true },
  { id: 'diag-eco', name: 'Diagnóstico-Eco', userCount: 0, isActive: false }
];

const App: React.FC = () => {
  // Carga inicial desde localStorage o valores por defecto
  const loadInitialState = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
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
  const [newOperatorCallsign, setNewOperatorCallsign] = useState('');
  const [newOperatorChannel, setNewOperatorChannel] = useState('');
  const [newChannelName, setNewChannelName] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());

  const audioCtxRef = useRef<AudioContext | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Efecto para guardar automáticamente ante cualquier cambio
  useEffect(() => {
    const stateToSave = {
      users,
      channels,
      selectedChannel,
      masterVolume,
      voiceProfile
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
  }, [users, channels, selectedChannel, masterVolume, voiceProfile]);

  // Asegurar guardado al cerrar la ventana
  useEffect(() => {
    const handleUnload = () => {
      const stateToSave = {
        users,
        channels,
        selectedChannel,
        masterVolume,
        voiceProfile
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
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

  const playTacticalChirp = useCallback((type: 'start' | 'end' | 'incoming') => {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const gainNode = ctx.createGain();
    
    gainNode.connect(ctx.destination);
    gainNode.gain.setValueAtTime(masterVolume * 0.15, now);

    if (type === 'start') {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1320, now + 0.06);
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(masterVolume * 0.15, now + 0.005);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.connect(gainNode);
      osc.start(now);
      osc.stop(now + 0.08);
    } else if (type === 'end') {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.04);
      gainNode.gain.setValueAtTime(masterVolume * 0.12, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.connect(gainNode);
      osc.start(now);
      osc.stop(now + 0.05);
    } else if (type === 'incoming') {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(1800, now);
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(masterVolume * 0.075, now + 0.005);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.connect(gainNode);
      osc.start(now);
      osc.stop(now + 0.05);
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
    if ("vibrate" in navigator) navigator.vibrate([10, 30, 10]);
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
          }, 500);
        };
        mediaRecorder.start();
      } catch (err) {
        console.error('Error mic:', err);
      }
    }
  }, [selectedChannel, isTransmitting, playTacticalChirp, masterVolume, voiceProfile]);

  const stopTransmission = useCallback(() => {
    if (!isTransmitting) return;
    setIsTransmitting(false);
    if ("vibrate" in navigator) navigator.vibrate(20);
    setUsers(prev => prev.map(u => u.callsign === CALLSIGN_SELF ? { ...u, status: UserStatus.ONLINE } : u));
    playTacticalChirp('end');
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  }, [isTransmitting, playTacticalChirp]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT') return;
      if (e.code === 'Space' && !isTransmitting) { e.preventDefault(); startTransmission(); }
      else if (e.code === 'KeyC') { e.preventDefault(); cycleChannel('next'); }
      else if (e.code === 'ArrowUp') { e.preventDefault(); cycleChannel('prev'); }
      else if (e.code === 'ArrowDown') { e.preventDefault(); cycleChannel('next'); }
    };
    const handleKeyUp = (e: KeyboardEvent) => { if (e.code === 'Space') { e.preventDefault(); stopTransmission(); } };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isTransmitting, startTransmission, stopTransmission, cycleChannel]);

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
      isActive: false
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

  const resetAllSettings = () => {
    if (confirm("¿Confirmar reinicio total de parámetros tácticos?")) {
      localStorage.removeItem(STORAGE_KEY);
      window.location.reload();
    }
  };

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
          <div className="p-6 border-b border-white/10 bg-black/20">
            <div className="flex items-center justify-between mb-6">
              <h2 className="flex items-center gap-3 font-black text-white/60 text-xs tracking-widest uppercase"><Radio className="w-5 h-5 text-green-500" /> CANALES DE COMUNICACIÓN</h2>
              <button onClick={() => setIsAddChannelModalOpen(true)} className="p-2 bg-green-600/10 text-green-500 hover:bg-green-600 hover:text-white rounded border border-green-500/20 transition-all active:scale-95 shadow-lg" title="Añadir Red"><Plus className="w-4 h-4" /></button>
            </div>
            <div className="space-y-2">
              {channels.map(ch => (
                <button
                  key={ch.id}
                  onClick={() => setSelectedChannel(ch.name)}
                  className={`w-full flex items-center justify-between p-4 rounded transition-all border ${selectedChannel === ch.name ? 'bg-green-600/20 border-green-500/50 text-green-400 shadow-[inset_0_0_20px_rgba(34,197,94,0.1)]' : 'bg-white/5 border-transparent text-white/30 hover:bg-white/10'}`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-2 h-2 rounded-full ${ch.name === 'Diagnóstico-Eco' ? 'bg-orange-500 animate-pulse' : ch.userCount > 0 ? 'bg-green-500' : 'bg-white/20'}`} />
                    <span className="font-bold tracking-widest">{ch.name.toUpperCase()}</span>
                  </div>
                  <div className="flex items-center gap-3">
                     <span className="text-[10px] font-black opacity-40">CH-{ch.id.substring(0,2)}</span>
                     <span className="text-[9px] bg-black/40 px-2 py-0.5 rounded border border-white/5">[{ch.userCount} OP]</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 p-6 flex flex-col items-center justify-center opacity-10 pointer-events-none">
             <Signal className="w-24 h-24 mb-4" />
             <div className="font-black tracking-[0.5em] text-xs">ENLACE ACTIVO</div>
          </div>
        </aside>

        {/* Panel Derecho: Operadores */}
        <aside className="flex-1 border-l border-white/10 bg-[#0c0c0c] flex flex-col z-40 relative">
          <div className="p-6 border-b border-white/10 bg-black/40 flex items-center justify-between">
            <h2 className="flex items-center gap-3 font-black text-white/60 text-xs tracking-widest uppercase"><Users className="w-5 h-5 text-green-500" /> DESPLIEGUE OPERATIVO</h2>
            <button onClick={() => setIsAddUserModalOpen(true)} className="p-2 bg-green-600/10 text-green-500 hover:bg-green-600 hover:text-white rounded border border-green-500/20 transition-all active:scale-95" title="Reclutar Operador"><UserPlus className="w-4 h-4" /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {users.map(user => (
              <div key={user.id} className={`p-4 border transition-all group relative rounded-sm ${user.status === UserStatus.TALKING ? 'bg-green-600/10 border-green-500/50' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className={`w-12 h-12 border flex items-center justify-center bg-black/40 rounded-sm transition-all ${user.status === UserStatus.TALKING ? 'border-green-400 scale-105 shadow-[0_0_15px_rgba(34,197,94,0.3)]' : 'border-white/10'}`}>
                        <StatusIcon status={user.status} size={22} className={
                          user.status === UserStatus.TALKING ? 'text-green-500' :
                          user.status === UserStatus.ONLINE ? 'text-green-500' :
                          user.status === UserStatus.MUTED ? 'text-orange-500' :
                          'text-white/20'
                        } />
                      </div>
                      <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-[#0c0c0c] ${
                        user.status === UserStatus.TALKING ? 'bg-green-500 animate-pulse' : 
                        user.status === UserStatus.ONLINE ? 'bg-green-500' : 
                        user.status === UserStatus.MUTED ? 'bg-orange-500' : 
                        'bg-gray-500'
                      }`} />
                    </div>
                    <div>
                      <div className="font-black text-white text-sm tracking-widest">{user.callsign}</div>
                      <div className={`text-[10px] font-bold tracking-tight ${user.status === UserStatus.TALKING ? 'text-green-400' : 'text-white/30'}`}>NET: {user.channel || 'OFFLINE'}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setActiveMenuUser(activeMenuUser === user.id ? null : user.id)} 
                      className={`p-2 rounded transition-all ${activeMenuUser === user.id ? 'bg-green-600 text-white' : 'opacity-0 group-hover:opacity-100 bg-white/5 border border-white/10 text-white/40 hover:text-white'}`}
                      title="Gestionar Operador"
                    >
                      <ArrowRightLeft className="w-4 h-4" />
                    </button>
                    <button className="p-2 opacity-0 group-hover:opacity-100 bg-white/5 border border-white/10 rounded hover:text-white transition-all"><MoreVertical className="w-4 h-4 text-white/40" /></button>
                  </div>
                </div>

                {activeMenuUser === user.id && (
                  <div className="mt-4 bg-[#080808] border border-green-500/50 p-4 rounded shadow-2xl animate-in fade-in slide-in-from-top-2 z-[60]">
                    <div className="space-y-4">
                      <div>
                        <div className="text-[10px] font-black text-green-400 mb-3 tracking-widest flex items-center gap-2"><Signal className="w-3.5 h-3.5" /> REASIGNAR RED TÁCTICA</div>
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
                            className="w-full flex items-center justify-center gap-2 p-3 bg-red-900/20 border border-red-500/30 text-red-400 text-[10px] font-black rounded-sm hover:bg-red-500/20 transition-all uppercase tracking-widest"
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

      <footer className="h-36 border-t border-white/10 bg-[#0a0a0a] flex items-center justify-center z-50 overflow-hidden relative">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
           <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white to-transparent" />
           <div className="w-full h-full bg-[repeating-linear-gradient(45deg,transparent,transparent_20px,rgba(255,255,255,0.02)_20px,rgba(255,255,255,0.02)_21px)]" />
        </div>
        
        <div className="flex-1 flex flex-col items-center justify-center relative px-6 md:px-12">
           <div className="hidden md:flex absolute left-10 flex-col gap-1 text-[8px] font-black text-white/20 tracking-widest select-none">
              <span className="flex items-center gap-2"><Shield className="w-3 h-3" /> ENLACE SEGURO</span>
              <span className="flex items-center gap-2"><Activity className="w-3 h-3" /> 446.00625 MHZ</span>
              <span className="flex items-center gap-2"><Zap className="w-3 h-3 text-yellow-500/50" /> AES-256 CTR</span>
           </div>

           <div className="flex items-center gap-4 md:gap-10 relative">
              {isEchoPlayback && <div className="absolute inset-x-0 -top-12 flex flex-col items-center justify-center pointer-events-none animate-pulse"><Volume className="w-6 h-6 text-orange-500 mb-1" /><span className="text-[7px] text-orange-400 font-black tracking-[0.3em]">RETORNO ACTIVO</span></div>}
              
              <button 
                onClick={() => cycleChannel('prev')} 
                disabled={channels.length < 2}
                className={`p-3 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 transition-all active:scale-90 group touch-none disabled:opacity-20`}
              >
                <ChevronLeft className="w-6 h-6 text-white/40 group-hover:text-white transition-colors" />
              </button>
              
              <div className="relative">
                <div className={`absolute -inset-3 rounded-full transition-all duration-300 ${isTransmitting ? 'bg-red-500/20 scale-110 blur-xl opacity-100' : 'opacity-0 scale-90'}`} />
                <button
                  onMouseDown={startTransmission} 
                  onMouseUp={stopTransmission} 
                  onMouseLeave={stopTransmission}
                  onTouchStart={(e) => { e.preventDefault(); startTransmission(); }}
                  onTouchEnd={(e) => { e.preventDefault(); stopTransmission(); }}
                  disabled={!selectedChannel}
                  className={`w-24 h-24 rounded-full flex flex-col items-center justify-center transition-all relative z-10 border-4 touch-none select-none disabled:grayscale disabled:opacity-20 ${isTransmitting ? (selectedChannel === 'Diagnóstico-Eco' ? 'bg-orange-600 border-orange-400 ptt-active' : 'bg-red-600 border-red-400 ptt-active') : 'bg-[#1a1a1a] border-white/10 ptt-idle shadow-[0_0_20px_rgba(0,0,0,0.5)] hover:bg-[#222] hover:border-white/20'}`}
                >
                  {isTransmitting ? <Mic className="w-8 h-8 mb-1 text-white" /> : <MicOff className="w-8 h-8 mb-1 text-white/20" />}
                  <span className={`text-[10px] font-black tracking-[0.2em] ${isTransmitting ? 'text-white' : 'text-white/20'}`}>{isTransmitting ? 'AL AIRE' : 'PTT'}</span>
                </button>
                
                {voiceProfile !== 'POR_DEFECTO' && (
                  <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[7px] font-black text-red-500 flex items-center gap-1">
                    <Zap className="w-1.5 h-1.5 fill-current" /> {voiceProfile}
                  </div>
                )}
              </div>

              <button 
                onClick={() => cycleChannel('next')} 
                disabled={channels.length < 2}
                className={`p-3 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 transition-all active:scale-90 group touch-none disabled:opacity-20`}
              >
                <ChevronRightIcon className="w-6 h-6 text-white/40 group-hover:text-white transition-colors" />
              </button>
           </div>

           <div className="hidden md:flex absolute right-10 text-right flex flex-col items-end gap-1 text-[8px] font-black text-white/20 tracking-widest select-none">
              <div className="flex items-center gap-2">42MS <Globe className="w-3 h-3" /></div>
              <div className="flex items-center gap-2">64 KBPS <Activity className="w-3 h-3" /></div>
              <div className="flex items-center gap-2">84% <Battery className="w-3 h-3 text-green-500/50" /></div>
           </div>
        </div>
      </footer>

      {/* Enroll Operator Modal */}
      {isAddUserModalOpen && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[100] backdrop-blur-md">
          <div className="w-full max-w-[450px] mx-4 bg-[#111] border-2 border-white/10 p-8 relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-green-600 animate-pulse shadow-[0_0_15px_rgba(34,197,94,0.5)]" />
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-green-500 font-black tracking-[0.2em] text-xl flex items-center gap-4"><UserPlus className="w-8 h-8" /> RECLUTAMIENTO</h3>
              <button onClick={() => setIsAddUserModalOpen(false)} className="text-white/20 hover:text-white"><X className="w-6 h-6" /></button>
            </div>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-white/30 flex items-center gap-2 uppercase tracking-widest"><Target className="w-3.5 h-3.5" /> INDICATIVO</label>
                <input autoFocus value={newOperatorCallsign} onChange={(e) => setNewOperatorCallsign(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddOperator()} placeholder="EJ: VIPER 2-1" className="w-full bg-black border border-white/10 p-5 text-white focus:border-green-500 outline-none transition-all font-black text-lg placeholder:text-white/5" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-white/30 flex items-center gap-2 uppercase tracking-widest"><Radio className="w-3.5 h-3.5" /> RED TÁCTICA ASIGNADA</label>
                <div className="grid grid-cols-2 gap-2">
                  {channels.length > 0 ? channels.map(ch => (
                    <button
                      key={ch.id}
                      onClick={() => setNewOperatorChannel(ch.name)}
                      className={`p-3 text-[10px] font-bold border transition-all ${newOperatorChannel === ch.name ? 'bg-green-600 border-green-400 text-white shadow-[0_0_10px_rgba(34,197,94,0.4)]' : 'bg-black border-white/10 text-white/40 hover:bg-white/5'}`}
                    >
                      {ch.name}
                    </button>
                  )) : (
                    <div className="col-span-2 text-[9px] text-white/10 p-4 border border-dashed border-white/5 text-center">Sin redes disponibles para asignación</div>
                  )}
                </div>
              </div>
              <button onClick={handleAddOperator} disabled={!newOperatorCallsign.trim()} className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-20 p-5 font-black tracking-[0.3em] text-white shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3 uppercase">INTEGRAR OPERADOR <Shield className="w-5 h-5" /></button>
            </div>
          </div>
        </div>
      )}

      {/* New Channel Quick Modal */}
      {isAddChannelModalOpen && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[100] backdrop-blur-md">
          <div className="w-full max-w-[450px] mx-4 bg-[#111] border-2 border-white/10 p-8 relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-green-600 animate-pulse shadow-[0_0_15px_rgba(34,197,94,0.5)]" />
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-green-500 font-black tracking-[0.2em] text-xl flex items-center gap-4"><Signal className="w-8 h-8" /> NUEVA RED</h3>
              <button onClick={() => setIsAddChannelModalOpen(false)} className="text-white/20 hover:text-white"><X className="w-6 h-6" /></button>
            </div>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-white/30 flex items-center gap-2 uppercase tracking-widest"><Radio className="w-3.5 h-3.5" /> IDENTIFICADOR DE RED</label>
                <input autoFocus value={newChannelName} onChange={(e) => setNewChannelName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddChannel()} placeholder="EJ: TÁCTICO ALPHA" className="w-full bg-black border border-white/10 p-5 text-white focus:border-green-500 outline-none transition-all font-black text-lg placeholder:text-white/5" />
              </div>
              <button onClick={handleAddChannel} disabled={!newChannelName.trim()} className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-20 p-5 font-black tracking-[0.3em] text-white shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3 uppercase">DESPLEGAR NODO <Zap className="w-5 h-5" /></button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[110] backdrop-blur-xl">
          <div className="w-full max-w-[700px] h-full max-h-[600px] bg-[#0c0c0c] border border-white/10 flex flex-col shadow-[0_0_100px_rgba(0,0,0,0.8)] mx-2">
            <div className="h-14 bg-white/5 border-b border-white/10 flex items-center justify-between px-6">
              <div className="flex items-center gap-6">
                <button onClick={() => setIsSettingsOpen(false)} className="flex items-center gap-2 text-white/30 hover:text-white transition-all pr-4 border-r border-white/10 group">
                  <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                  <span className="text-[10px] font-black tracking-widest uppercase">VOLVER</span>
                </button>
                <h3 className="font-black tracking-[0.2em] text-white/90 uppercase">CONFIGURACIÓN TÁCTICA</h3>
              </div>
              <button onClick={() => setIsSettingsOpen(false)} className="text-white/20 hover:text-white transition-all"><X className="w-5 h-5" /></button>
            </div>

            <div className="flex-1 flex min-h-0">
              <div className="w-20 md:w-48 border-r border-white/10 bg-black/40 flex flex-col p-2 gap-1">
                {(['AUDIO', 'REDES', 'OPERADORES'] as SettingsTab[]).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setSettingsTab(tab)}
                    className={`flex items-center gap-3 px-4 py-3 text-[10px] font-black tracking-widest transition-all rounded-sm border ${settingsTab === tab ? 'bg-green-600/10 border-green-500 text-green-400' : 'bg-transparent border-transparent text-white/30 hover:bg-white/5'}`}
                  >
                    {tab === 'AUDIO' && <Volume2 className="w-4 h-4" />}
                    {tab === 'REDES' && <Radio className="w-4 h-4" />}
                    {tab === 'OPERADORES' && <Users className="w-4 h-4" />}
                    <span className="hidden md:inline">{tab}</span>
                  </button>
                ))}
                
                <div className="mt-auto p-2">
                   <button 
                    onClick={resetAllSettings}
                    className="w-full flex items-center gap-3 px-4 py-3 text-[8px] font-black tracking-widest text-red-500 hover:bg-red-500/10 rounded-sm transition-all border border-transparent hover:border-red-500/50"
                   >
                     <Trash2 className="w-3.5 h-3.5" /> REINICIAR
                   </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 md:p-8">
                {settingsTab === 'AUDIO' && (
                  <div className="space-y-10">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-black text-white/30 tracking-widest flex items-center gap-2 uppercase"><Volume2 className="w-4 h-4" /> Ganancia Maestra</label>
                        <span className="text-green-500 font-black text-xs">{Math.round(masterVolume * 100)}%</span>
                      </div>
                      <input type="range" min="0" max="1" step="0.01" value={masterVolume} onChange={(e) => setMasterVolume(parseFloat(e.target.value))} className="w-full accent-green-600 bg-white/5 h-2 rounded-lg appearance-none cursor-pointer" />
                    </div>
                    
                    <div className="space-y-4 pt-4 border-t border-white/10">
                      <label className="text-[10px] font-black text-white/30 tracking-widest flex items-center gap-2 uppercase"><Volume1 className="w-4 h-4" /> CIFRADO VOCAL (MODULADOR)</label>
                      <div className="grid grid-cols-1 gap-2">
                        {(['POR_DEFECTO', 'MUJER', 'NIÑO', 'ANCIANO'] as VoiceProfile[]).map((v) => (
                          <div key={v} className={`flex items-center justify-between p-4 border transition-all cursor-pointer ${voiceProfile === v ? 'bg-green-600/10 border-green-600/50 text-white' : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'}`} onClick={() => setVoiceProfile(v)}>
                             <div className="flex items-center gap-4">
                                <div className={`w-3 h-3 rounded-full border-2 ${voiceProfile === v ? 'bg-green-500 border-white' : 'border-white/20'}`} />
                                <span className="font-bold tracking-widest">
                                  {v === 'POR_DEFECTO' ? 'TÁCTICO (Zephyr)' : 
                                   v === 'MUJER' ? 'FEMENINO (Kore)' : 
                                   v === 'NIÑO' ? 'INFANTIL (Puck)' : 
                                   'SENIOR (Fenrir)'}
                                </span>
                             </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                
                {settingsTab === 'REDES' && (
                  <div className="space-y-8">
                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-white/30 tracking-widest flex items-center gap-2 uppercase"><Plus className="w-4 h-4" /> Nueva Red Táctica</label>
                      <div className="flex gap-2">
                        <input value={newChannelName} onChange={(e) => setNewChannelName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddChannel()} placeholder="NOMBRE DE RED..." className="flex-1 bg-black border border-white/10 p-3 text-white focus:border-green-500 outline-none transition-all font-bold" />
                        <button onClick={handleAddChannel} className="bg-green-600 px-6 font-black text-[10px] tracking-widest hover:bg-green-500 transition-all uppercase">AÑADIR</button>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        {channels.map(ch => (
                          <div key={ch.id} className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-sm">
                            <div className="flex items-center gap-4">
                              <Radio className="w-4 h-4 text-green-500" />
                              <span className="font-bold tracking-widest">{ch.name}</span>
                            </div>
                            {ch.name !== selectedChannel && (
                              <button onClick={() => handleRemoveChannel(ch.id)} className="p-2 text-white/20 hover:text-red-500 transition-all"><Trash2 className="w-4 h-4" /></button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                
                {settingsTab === 'OPERADORES' && (
                  <div className="space-y-8">
                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-white/30 tracking-widest flex items-center gap-2 uppercase"><Database className="w-4 h-4" /> Registro de Personal</label>
                      <div className="space-y-2">
                        {users.map(user => (
                          <div key={user.id} className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-sm">
                            <div className="flex items-center gap-4">
                              <div className={`w-2 h-2 rounded-full ${user.status === UserStatus.ONLINE ? 'bg-green-500' : 'bg-white/20'}`} />
                              <span className="font-bold tracking-widest">{user.callsign}</span>
                            </div>
                            {user.callsign !== CALLSIGN_SELF && (
                              <button onClick={() => setUsers(prev => prev.filter(u => u.id !== user.id))} className="p-2 text-white/20 hover:text-red-500 transition-all"><Trash2 className="w-4 h-4" /></button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="h-14 bg-black/40 border-t border-white/10 flex items-center justify-end px-6 gap-3">
              <button onClick={() => setIsSettingsOpen(false)} className="bg-green-600 text-white font-black tracking-widest px-8 py-2 rounded-sm text-[10px] shadow-lg active:scale-95 transition-all uppercase">CONFIGURACIÓN GUARDADA</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;