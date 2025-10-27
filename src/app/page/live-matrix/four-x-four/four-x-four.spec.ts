import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FourXFour } from './four-x-four';

describe('FourXFour', () => {
  let component: FourXFour;
  let fixture: ComponentFixture<FourXFour>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FourXFour]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FourXFour);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
