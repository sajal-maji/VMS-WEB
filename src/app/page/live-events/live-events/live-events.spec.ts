import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LiveEvents } from './live-events';

describe('LiveEvents', () => {
  let component: LiveEvents;
  let fixture: ComponentFixture<LiveEvents>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LiveEvents]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LiveEvents);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
