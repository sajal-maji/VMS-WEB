import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { VideoStreamService } from '../../../store/service/video-stream.service';

@Component({
  selector: 'app-two-x-two',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './two-x-two.component.html',
  styleUrls: ['./two-x-two.component.css']
})
export class TwoXTwo implements OnInit, OnDestroy {
  @ViewChild('videoPlayer', { static: true }) videoPlayer!:   ElementRef<HTMLVideoElement>;
  private videoSub?: Subscription;

  constructor(private videoService: VideoStreamService) {}

  ngOnInit() {
    
  }

  ngOnDestroy() {
    this.videoSub?.unsubscribe();
  }
}