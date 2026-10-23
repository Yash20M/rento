type Listener = () => void;

/**
 * Where the signed-in session lives in the browser. ONLY the short-lived access token exists here, in memory: it is
 * gone on reload and never written to `localStorage`, `sessionStorage` or a log. The long-lived refresh token is an
 * `HttpOnly; SameSite=Strict` cookie set by the API (ADR-012), so page scripts can never read it; a reload gets a new
 * access token by asking the API to use that cookie.
 */
export class SessionStore {
  private access: string | undefined;
  private readonly listeners = new Set<Listener>();
  private stepUp: (() => Promise<boolean>) | undefined;
  private stepUpPending: Promise<boolean> | undefined;

  get accessToken(): string | undefined {
    return this.access;
  }

  setAccess(accessToken: string): void {
    this.access = accessToken;
  }

  /** Forgets the access token. `notify` tells the UI the session ended without the person asking for it. */
  clear(notify = false): void {
    this.access = undefined;
    if (notify) for (const listener of this.listeners) listener();
  }

  /**
   * The screen that asks for a fresh authenticator code registers itself here. The API client calls
   * {@link requestStepUp} when a sensitive action answers `STEP_UP_REQUIRED` and repeats the action if it resolves true.
   */
  setStepUpHandler(handler: () => Promise<boolean>): () => void {
    this.stepUp = handler;
    return () => {
      if (this.stepUp === handler) this.stepUp = undefined;
    };
  }

  /** One question at a time, however many requests are waiting for the answer. */
  requestStepUp(): Promise<boolean> {
    this.stepUpPending ??= (this.stepUp?.() ?? Promise.resolve(false)).finally(() => {
      this.stepUpPending = undefined;
    });
    return this.stepUpPending;
  }

  /** Called when the session was ended by the system (the refresh cookie was refused). */
  onForcedSignOut(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
