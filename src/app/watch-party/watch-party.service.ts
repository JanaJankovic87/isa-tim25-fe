import { Injectable } from '@angular/core';
import { WatchPartyService as CoreWatchPartyService, WatchPartyCommand } from '../services/watch-party.service';

@Injectable({ providedIn: 'root' })
export class WatchPartyWrapperService {
  constructor(private core: CoreWatchPartyService) {}

  // Compatibility method names
  createRoom(roomId: string, userId: string) {
    // creating a room is modeled by connecting as owner
    return this.core.connect(roomId, userId, true);
  }

  getAllRooms(): Promise<string[]> {
    // No backend endpoint in frontend; return empty list placeholder
    return Promise.resolve([]);
  }

  getRoom(roomId: string): Promise<any> {
    // Placeholder: frontend doesn't maintain full room info
    return Promise.resolve(null);
  }

  startVideo(videoId: number) {
    return this.core.playVideo(videoId);
  }

  closeRoom() {
    // close room -> disconnect
    return this.core.disconnect();
  }

  connectToRoom(roomId: string, userId: string, asOwner = false) {
    return this.core.connect(roomId, userId, asOwner);
  }

  disconnectFromRoom() {
    return this.core.disconnect();
  }

  // expose events observable
  get events$() {
    return (this.core as any).events$;
  }

  // expose messages and commands as needed
  get commands$() { return (this.core as any).commands$; }
  get messages$() { return (this.core as any).messages$; }
}

export type { WatchPartyCommand };
