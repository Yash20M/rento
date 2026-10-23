import { Injectable } from '@nestjs/common';

/** Flips to draining when shutdown begins so `/readyz` reports 503 and load balancers stop routing. */
@Injectable()
export class ShutdownState {
  private draining = false;

  beginDraining(): void {
    this.draining = true;
  }

  get isDraining(): boolean {
    return this.draining;
  }
}
