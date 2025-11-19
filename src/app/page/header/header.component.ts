import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { inject } from '@angular/core';
import { LayoutService, MatrixLayout } from '../live-matrix/layout.service';
import { filter } from 'rxjs';
import { CookieService } from 'ngx-cookie-service';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  styleUrls: ['./header.component.css']
})
export class HeaderComponent {
  private readonly layout = inject(LayoutService);
  private readonly router = inject(Router);
  private readonly cookies = inject(CookieService);
  userSession: boolean = true;
  firstLogin: boolean = false;
  liveEvents: boolean = true;
  isConnected: boolean = true;
  showDropdown: boolean = true;


  // which tab group (like your Thymeleaf flags)
  activeTabGroup: string = 'live-matrix';

  // current active tab
  activeTab: string = 'Dashboard';

  // current layout label for dropdown button
  currentLayout: string = '1x1';


   constructor() {
    // 🔹 Detect route changes
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      const url = event.urlAfterRedirects;
      if (url.includes('/live-matrix')) {
        this.activeTab = 'Dashboard';
        this.showDropdown = true;
      } else if (url.includes('/archive-matrix')) {
        this.activeTab = 'Archive';
        this.showDropdown = true;
      } else {
        this.activeTab = ''; // Other tabs
        this.showDropdown = false;
      }
    });
  }

  tabChanged(tab: string): void {
    this.activeTab = tab;
    // console.log('Tab changed to:', tab);
    this.showDropdown = (tab === 'Dashboard' || tab === 'Archive');
    // console.log("showDropdown", this.showDropdown);
  }

  selectLayout(layout: MatrixLayout): void {
    this.layout.setLayout(layout);
    this.currentLayout = layout;
  }

  signOut(): void {
    // redirect or handle logout
    this.cookies.delete('authToken', '/');
    this.cookies.delete('vSessionId', '/');
    // window.location.href = '/ivmsweb/signout?successto=/ivmsweb/login';
    this.router.navigate(['/ivmsweb/login']);
  }
}
