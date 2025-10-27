import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AudioBrodcast } from './audio-brodcast';

describe('AudioBrodcast', () => {
  let component: AudioBrodcast;
  let fixture: ComponentFixture<AudioBrodcast>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AudioBrodcast]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AudioBrodcast);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
