import { Component, HostListener, Inject, PLATFORM_ID, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
// import { CleanupService } from './cleanup.service';
import { CookieService } from 'ngx-cookie-service';
import { isPlatformBrowser } from '@angular/common';
import { AuthStore } from './auth/auth.store';
import { AuthService } from './auth/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrls: ['./app.css'],
})
export class App {
  protected readonly title = signal('vms-web-angular-revamp');
  private isTabClosed = false;
  constructor() { // @Inject(PLATFORM_ID) private platformId: Object, // private auth: AuthService, // private cookies: CookieService, // private cleanupService: CleanupService,
    // if (isPlatformBrowser(this.platformId)) {
    //   document.addEventListener('visibilitychange', () => {
    //     if (document.visibilityState === 'hidden') {
    //       this.isTabClosed = true;
    //     }
    //   });
    // }
  }

  // @HostListener('window:beforeunload', ['$event'])
  // onBeforeUnload(event: Event) {
  //   if (this.isTabClosed) {
  //     console.log('logout', this.isTabClosed);
  //     this.auth.logout();
  //     // optional: clear cookie/localStorage
  //   }
  // }
}
