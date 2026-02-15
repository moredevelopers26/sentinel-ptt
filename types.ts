
export enum UserStatus {
  ONLINE = 'online',
  TALKING = 'talking',
  MUTED = 'muted',
  OFFLINE = 'offline'
}

export interface MurmurUser {
  id: string;
  callsign: string;
  status: UserStatus;
  channel: string;
  lat: number;
  lng: number;
  lastTransmission?: string;
}

export interface Channel {
  id: string;
  name: string;
  userCount: number;
  isActive: boolean;
}
