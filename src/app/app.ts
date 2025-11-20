import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CleanupService } from './cleanup.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class App {
  protected readonly title = signal('vms-web-angular-revamp');
   constructor(private cleanupService: CleanupService) {
    // Just injecting activates the HostListener globally
  }
}
