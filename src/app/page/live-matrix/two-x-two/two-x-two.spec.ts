import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TwoXTwo } from './two-x-two';

describe('TwoXTwo', () => {
  let component: TwoXTwo;
  let fixture: ComponentFixture<TwoXTwo>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TwoXTwo]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TwoXTwo);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
