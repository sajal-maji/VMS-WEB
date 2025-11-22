import { Injectable, HostListener } from '@angular/core';
@Injectable({ providedIn: 'root' })
export class CleanupService {
  @HostListener('window:beforeunload', ['$event'])
  onTabClose() {
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const eqPos = cookie.indexOf('=');
      const name = eqPos > -1 ? cookie.substring(0, eqPos).trim() : cookie.trim();
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    }
  }
}
