import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OneXOneComponent } from './one-x-one.component';
import { beforeEach, describe, it } from 'node:test';



describe('OneXOneComponent', () => {
  let component: OneXOneComponent;
  let fixture: ComponentFixture<OneXOneComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OneXOneComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OneXOneComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
