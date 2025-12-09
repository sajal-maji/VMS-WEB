import { Injectable, signal } from '@angular/core';

export type MatrixLayout = '1x1' | '2x2' | '3x3' | '4x4' | '5x5';

@Injectable({ providedIn: 'root' })
export class LayoutService {
  readonly selectedLayout = signal<MatrixLayout>('1x1');

  readonly allowedLayouts = signal<MatrixLayout[]>(['1x1', '2x2', '3x3', '4x4']);

  setLayout(layout: MatrixLayout): void {
    this.selectedLayout.set(layout);
  }

  setAllowedLayouts(layouts: MatrixLayout[]): void {
    this.allowedLayouts.set(layouts);
  }
}
