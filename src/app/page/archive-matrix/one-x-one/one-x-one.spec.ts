import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OneXOne } from './one-x-one';

describe('OneXOne', () => {
  let component: OneXOne;
  let fixture: ComponentFixture<OneXOne>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OneXOne]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OneXOne);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
