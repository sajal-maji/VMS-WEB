import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TreeComponent } from '../tree/tree.component'; // adjust path
import { HeaderComponent } from '../header/header.component';
import { RouterOutlet } from '@angular/router';
import { LayoutService } from '../live-matrix/layout.service';
import { OneXOneComponent } from '../live-matrix/one-x-one/one-x-one.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,        // ✅ must be standalone for lazy-loading
  imports: [CommonModule, TreeComponent, HeaderComponent, OneXOneComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent {
  private readonly layout = inject(LayoutService);
  readonly selectedLayout = computed(() => this.layout.selectedLayout());
}