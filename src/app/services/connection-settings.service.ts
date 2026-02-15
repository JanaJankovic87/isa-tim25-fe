import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ConnectionSettingsService {
  private readonly STORAGE_KEY = 'backend_server_address';
  private readonly DEFAULT_PORT = '8082';
  
  private serverAddressSubject = new BehaviorSubject<string>(
    this.getStoredAddress()
  );
  
  serverAddress$ = this.serverAddressSubject.asObservable();

  private getStoredAddress(): string {
    return localStorage.getItem(this.STORAGE_KEY) || 'localhost';
  }

  setServerAddress(address: string): void {
    address = address.trim().replace(/^https?:\/\//, '').replace(/:\d+$/, '');
    localStorage.setItem(this.STORAGE_KEY, address);
    this.serverAddressSubject.next(address);
  }

  getServerAddress(): string {
    return this.serverAddressSubject.value;
  }

  getApiUrl(): string {
    return `http://${this.getServerAddress()}:${this.DEFAULT_PORT}/api`;
  }

  getWsUrl(): string {
    return `http://${this.getServerAddress()}:${this.DEFAULT_PORT}/ws`;
  }
}