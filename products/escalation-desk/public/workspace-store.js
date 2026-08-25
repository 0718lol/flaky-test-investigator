(function attachRelayWorkspaceStore(global) {
  class RelayWorkspaceStore {
    constructor({ key, schemaVersion, createSeed, migrate }) {
      this.key = key;
      this.schemaVersion = schemaVersion;
      this.createSeed = createSeed;
      this.migrate = migrate;
      this.data = this.load();
    }

    load() {
      try {
        const parsed = JSON.parse(localStorage.getItem(this.key));
        if (parsed?.schemaVersion === this.schemaVersion) return parsed;
        if (parsed && this.migrate) return this.persist(this.migrate(parsed, parsed.schemaVersion || 0));
      } catch {}
      const migrated = this.migrate?.(null, 0);
      return this.persist(migrated || this.createSeed());
    }

    persist(next = this.data) {
      next.schemaVersion = this.schemaVersion;
      next.meta = { ...next.meta, updatedAt: new Date().toISOString() };
      localStorage.setItem(this.key, JSON.stringify(next));
      this.data = next;
      return next;
    }

    save() {
      return this.persist(this.data);
    }

    transaction(update) {
      update(this.data);
      return this.save();
    }
  }

  global.RelayWorkspaceStore = RelayWorkspaceStore;
})(window);
