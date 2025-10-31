import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { inject } from '@angular/core';
import { LayoutService, MatrixLayout } from '../live-matrix/layout.service';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  standalone: true,
  imports: [CommonModule],
  styleUrls: ['./header.component.css']
})
export class HeaderComponent {
  private readonly layout = inject(LayoutService);
  userSession: boolean = true;
  firstLogin: boolean = false;
  liveEvents: boolean = true;
  isConnected: boolean = true;

  // which tab group (like your Thymeleaf flags)
  activeTabGroup: string = 'live_matrix';

  // current active tab
  activeTab: string = 'Dashboard';

  tabChanged(tab: string): void {
    this.activeTab = tab;
    console.log('Tab changed to:', tab);
  }

  selectLayout(layout: MatrixLayout): void {
    this.layout.setLayout(layout);
  }

  signOut(): void {
    // redirect or handle logout
    window.location.href = '/ivmsweb/signout?successto=/ivmsweb';
  }
}
