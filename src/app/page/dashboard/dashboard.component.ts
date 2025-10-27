import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TreeComponent } from '../tree/tree.component'; // adjust path

@Component({
  selector: 'app-dashboard',
  standalone: true,        // ✅ must be standalone for lazy-loading
  imports: [CommonModule, TreeComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent {}