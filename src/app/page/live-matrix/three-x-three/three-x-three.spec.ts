import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ThreeXThree } from './three-x-three';

describe('ThreeXThree', () => {
  let component: ThreeXThree;
  let fixture: ComponentFixture<ThreeXThree>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ThreeXThree]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ThreeXThree);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
