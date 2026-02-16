import { Injectable } from '@angular/core';
import { WatchPartyService as CoreWatchPartyService, WatchPartyCommand } from '../services/watch-party.service';

@Injectable({ providedIn: 'root' })
export class WatchPartyWrapperService {
  constructor(private core: CoreWatchPartyService) {}

  createRoom(roomId: string, userId: string) {
    return this.core.connect(roomId, userId, true);
  }

  getAllRooms(): Promise<string[]> {
    return Promise.resolve([]);
  }

  getRoom(roomId: string): Promise<any> {
    return Promise.resolve(null);
  }

  startVideo(videoId: number) {
    return this.core.playVideo(videoId);
  }

  closeRoom() {
    return this.core.disconnect();
  }

  connectToRoom(roomId: string, userId: string, asOwner = false) {
    return this.core.connect(roomId, userId, asOwner);
  }

  disconnectFromRoom() {
    return this.core.disconnect();
  }

  get events$() {
    return (this.core as any).events$;
  }

  get commands$() { return (this.core as any).commands$; }
  get messages$() { return (this.core as any).messages$; }
}

export type { WatchPartyCommand };
