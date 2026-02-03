import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';

export class SQLiteDB {
  constructor(k2) {
    this.v1 = null;
    this.p = null;
    this.F = false;
    this.c = {};

    const d = dirname(join(process.cwd(), k2));
    if (!existsSync(d)) mkdirSync(d, { recursive: true });

    this.v1 = new Database(join(process.cwd(), k2));
    this.v1.pragma('journal_mode = WAL');
    
    this.i();
    this.a();
    this.p = this.l();
  }

  i() {
    const t = global.DB_TABLES;
    t.forEach(r => {
      this.v1.exec(`CREATE TABLE IF NOT EXISTS ${r} (id TEXT PRIMARY KEY, data TEXT NOT NULL)`);
    });
  }

  a() {
    const t = global.DB_TABLES;
    t.forEach(n => {
      this.c[n] = {};
      try {
        const r = this.v1.prepare(`SELECT id, data FROM ${n}`).all();
        r.forEach(w => {
          try {
            this.c[n][w.id] = JSON.parse(w.data);
          } catch (e) {
            console.error(`Error parsing data for ${n}[${w.id}]:`, e);
            this.c[n][w.id] = {};
          }
        });
      } catch (e) {
        console.error(`Error loading table ${n}:`, e);
      }
    });
  }

  l() {
    const s = this;
    
    const m = (t, b, i) => {
      return new Proxy(t, {
        get(o, p) {
          if (typeof p === 'symbol') return o[p];
          return o[p];
        },
        set(o, p, v) {
          if (typeof p === 'symbol') return false;
          o[p] = v;
          try {
            s.v1.prepare(`INSERT OR REPLACE INTO ${b} (id, data) VALUES (?, ?)`).run(i, JSON.stringify(o));
          } catch (e) {
            console.error('Error saving:', e);
          }
          return true;
        }
      });
    };
    
    const h = {
      get(g, b) {
        if (typeof b === 'symbol') return g[b];
        return new Proxy(s.c[b] || {}, {
          get(t, i) {
            if (typeof i === 'symbol') return t[i];
            if (!(i in t)) {
              try {
                const q = s.v1.prepare(`SELECT data FROM ${b} WHERE id = ?`);
                const w = q.get(i);
                if (w && w.data) {
                  const d = JSON.parse(w.data);
                  t[i] = m(d, b, i);
                  s.c[b][i] = t[i];
                } else {
                  t[i] = m({}, b, i);
                  s.c[b][i] = t[i];
                }
              } catch (e) {
                console.error(`Error loading ${b}[${i}]:`, e);
                t[i] = m({}, b, i);
                s.c[b][i] = t[i];
              }
            }
            return t[i];
          },
          set(t, i, v) {
            if (typeof i === 'symbol') return false;
            try {
              t[i] = m(v, b, i);
              s.c[b][i] = t[i];
              s.v1.prepare(`INSERT OR REPLACE INTO ${b} (id, data) VALUES (?, ?)`).run(i, JSON.stringify(v));
            } catch (e) {
              console.error(`Error setting ${b}[${i}]:`, e);
            }
            return true;
          },
          deleteProperty(t, i) {
            if (typeof i === 'symbol') return false;
            delete t[i];
            if (s.c[b]) delete s.c[b][i];
            try {
              s.v1.prepare(`DELETE FROM ${b} WHERE id = ?`).run(i);
            } catch (e) {
              console.error(`Error deleting ${b}[${i}]:`, e);
            }
            return true;
          },
          ownKeys(t) {
            return Object.keys(t);
          },
          getOwnPropertyDescriptor(t, p) {
            return { enumerable: true, configurable: true };
          }
        });
      }
    };
    
    return new Proxy({}, h);
  }

  get data() {
    return this.p;
  }

  async read() {
    this.a();
    return Promise.resolve();
  }

  async write() {
    const t = global.DB_TABLES;
    t.forEach(b => {
      const u = this.c[b];
      if (u) {
        Object.entries(u).forEach(([i, d]) => {
          this.v1.prepare(`INSERT OR REPLACE INTO ${b} (id, data) VALUES (?, ?)`).run(i, JSON.stringify(d));
        });
      }
    });
  }

  close() {
    this.v1.close();
  }
}