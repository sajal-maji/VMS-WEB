import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { inject } from '@angular/core';
import { LayoutService, MatrixLayout } from '../live-matrix/layout.service';
import { filter } from 'rxjs';
import { CookieService } from 'ngx-cookie-service';
import { AuthStore } from '../../auth/auth.store';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  styleUrls: ['./header.component.css'],
})
export class HeaderComponent {
  @Input() currentLayout: string = '1x1';
  @Input() allowedLayouts: MatrixLayout[] = [];
  @Output() layoutChange = new EventEmitter<MatrixLayout>();

  private readonly router = inject(Router);
  private readonly cookies = inject(CookieService);
  private readonly authStore = inject(AuthStore);

  userSession: boolean = true;
  firstLogin: boolean = false;
  liveEvents: boolean = true;
  isConnected: boolean = true;
  showDropdown: boolean = true;

  activeTabGroup: string = 'live-matrix';
  activeTab: string = 'Dashboard';

  selectLayout(layout: MatrixLayout) {
    this.layoutChange.emit(layout);
  }

  constructor() {
    // only detect route changes for showing/hiding dropdown
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        const url = event.urlAfterRedirects;
        if (url.includes('/live-matrix')) {
          this.activeTab = 'Dashboard';
          this.showDropdown = true;
        } else if (url.includes('/archive-matrix')) {
          this.activeTab = 'Archive';
          this.showDropdown = true;
        } else {
          this.activeTab = '';
          this.showDropdown = false;
        }
      });
  }

  tabChanged(tab: string): void {
    this.activeTab = tab;
    this.showDropdown = tab === 'Dashboard' || tab === 'Archive';
  }

  signOut(): void {
    this.authStore.logout();
  }
}
