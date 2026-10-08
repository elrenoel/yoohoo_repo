"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

export type OptimisticIntentState = {
  active: boolean;
  count?: number;
  pending: boolean;
};

export type OptimisticIntentResponse = {
  active: boolean;
  count?: number;
};

type TimerHandle = ReturnType<typeof setTimeout>;

type CoordinatorOptions = {
  entityKey: string;
  initialState: OptimisticIntentResponse;
  debounceMs: number;
  request: (desiredState: boolean) => Promise<OptimisticIntentResponse>;
  updateCache: (state: OptimisticIntentResponse) => void;
  onError: () => void;
};

type Listener = () => void;

export class OptimisticIntentCoordinator {
  private options: CoordinatorOptions;
  private listeners = new Set<Listener>();
  private timer: TimerHandle | null = null;
  private inFlight = false;
  private revision = 0;
  private serverState: OptimisticIntentResponse;
  private snapshot: OptimisticIntentState;

  constructor(options: CoordinatorOptions) {
    this.options = options;
    this.serverState = options.initialState;
    this.snapshot = { ...options.initialState, pending: false };
  }

  configure(options: CoordinatorOptions) {
    this.options = options;
  }

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.snapshot;

  hasSubscribers() {
    return this.listeners.size > 0;
  }

  isIdle() {
    return !this.inFlight && this.timer === null;
  }

  setDesiredState(desiredState: boolean) {
    this.revision += 1;
    const count = adjustCount(this.snapshot.count, this.snapshot.active, desiredState);
    this.snapshot = { active: desiredState, count, pending: desiredState !== this.serverState.active || this.inFlight };
    this.options.updateCache({ active: desiredState, count });
    this.emit();
    this.schedule();
  }

  dispose() {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.listeners.clear();
  }

  private emit() {
    this.listeners.forEach((listener) => listener());
  }

  private schedule(delay = this.options.debounceMs) {
    if (this.inFlight) return;
    if (this.timer !== null) clearTimeout(this.timer);
    if (this.snapshot.active === this.serverState.active) {
      this.timer = null;
      this.snapshot = { ...this.snapshot, pending: false };
      this.emit();
      return;
    }
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, delay);
  }

  private async flush() {
    if (this.inFlight || this.snapshot.active === this.serverState.active) return;
    const sentState = this.snapshot.active;
    const sentRevision = this.revision;
    this.inFlight = true;
    this.snapshot = { ...this.snapshot, pending: true };
    this.emit();

    try {
      const response = await this.options.request(sentState);
      const serverCount = response.count ?? adjustCount(this.snapshot.count, this.snapshot.active, response.active);
      this.serverState = { active: response.active, count: serverCount };
      const desiredState = this.snapshot.active;
      const count = adjustCount(serverCount, response.active, desiredState);
      this.snapshot = { active: desiredState, count, pending: desiredState !== response.active };
      this.options.updateCache({ active: desiredState, count });
    } catch {
      const superseded = sentRevision !== this.revision;
      if (!superseded) {
        this.snapshot = { ...this.serverState, pending: false };
        this.options.updateCache(this.serverState);
        this.options.onError();
      }
    } finally {
      this.inFlight = false;
      this.snapshot = { ...this.snapshot, pending: this.snapshot.active !== this.serverState.active };
      this.emit();
      if (this.snapshot.active !== this.serverState.active) this.schedule(0);
    }
  }
}

function adjustCount(count: number | undefined, from: boolean, to: boolean) {
  if (count === undefined || from === to) return count;
  return Math.max(0, count + (to ? 1 : -1));
}

const coordinators = new Map<string, OptimisticIntentCoordinator>();

export function useOptimisticIntentMutation(options: {
  entityKey: string;
  initialState: OptimisticIntentResponse;
  request: (desiredState: boolean) => Promise<OptimisticIntentResponse>;
  updateCache: (state: OptimisticIntentResponse) => void;
  onError: () => void;
  debounceMs?: number;
}) {
  let coordinator = coordinators.get(options.entityKey);
  if (!coordinator) {
    coordinator = new OptimisticIntentCoordinator({
      ...options,
      debounceMs: options.debounceMs ?? 350,
    });
    coordinators.set(options.entityKey, coordinator);
  }
  coordinator.configure({
    entityKey: options.entityKey,
    initialState: options.initialState,
    debounceMs: options.debounceMs ?? 350,
    request: options.request,
    updateCache: options.updateCache,
    onError: options.onError,
  });

  const state = useSyncExternalStore(coordinator.subscribe, coordinator.getSnapshot, coordinator.getSnapshot);

  useEffect(() => {
    const current = coordinator;
    return () => {
      queueMicrotask(() => {
        if (!current.hasSubscribers() && current.isIdle()) {
          current.dispose();
          coordinators.delete(options.entityKey);
        }
      });
    };
  }, [coordinator, options.entityKey]);

  const setDesiredState = useCallback(
    (desiredState: boolean) => coordinator.setDesiredState(desiredState),
    [coordinator],
  );

  return { ...state, setDesiredState };
}
