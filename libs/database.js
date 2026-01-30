import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';

export class SQLiteDB {
  constructor(k2) {
    this.v1 = null;
    this.p = null;
    this.F = false;

    const d = dirname(join(process.cwd(), k2));
    if (!existsSync(d)) {
      mkdirSync(d, { recursive: true });
    }

    this.v1 = new Database(join(process.cwd(), k2));
    this.v1.pragma('journal_mode = WAL');
    
    this.i();
    this.p = this.l();
  }

  i() {
    const t = global.DB_TABLES;
    
    t.forEach(r => {
      this.v1.exec(`
        CREATE TABLE IF NOT EXISTS ${r} (
          id TEXT PRIMARY KEY,
          data TEXT NOT NULL
        )
      `);
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
            const z = s.v1.prepare(`
              INSERT OR REPLACE INTO ${b} (id, data) 
              VALUES (?, ?)
            `);
            z.run(i, JSON.stringify(o));
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
        
        return new Proxy({}, {
          get(_, i) {
            if (typeof i === 'symbol') return undefined;
  
            if (!g[b]) {
              g[b] = {};
            }

            if (g[b][i]) {
              return g[b][i];
            }
    
            try {
              const q = s.v1.prepare(`SELECT data FROM ${b} WHERE id = ?`);
              const w = q.get(i);
              
              if (w && w.data) {
                const d = JSON.parse(w.data);
                g[b][i] = m(d, b, i);
              } else {
                g[b][i] = m({}, b, i);
              }
            } catch (e) {
              console.error(`Error loading ${b}[${i}]:`, e);
              g[b][i] = m({}, b, i);
            }
            
            return g[b][i];
          },
          
          set(_, i, v) {
            if (typeof i === 'symbol') return false;
            
            if (!g[b]) {
              g[b] = {};
            }
            
            try {
              g[b][i] = m(v, b, i);

              const z = s.v1.prepare(`
                INSERT OR REPLACE INTO ${b} (id, data) 
                VALUES (?, ?)
              `);
              z.run(i, JSON.stringify(v));
            } catch (e) {
              console.error(`Error setting ${b}[${i}]:`, e);
            }
            
            return true;
          },
          
          deleteProperty(_, i) {
            if (typeof i === 'symbol') return false;
            
            if (g[b]) {
              delete g[b][i];
            }
  
            try {
              const d = s.v1.prepare(`DELETE FROM ${b} WHERE id = ?`);
              d.run(i);
            } catch (e) {
              console.error(`Error deleting ${b}[${i}]:`, e);
            }
            
            return true;
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
    return Promise.resolve();
  }

  async write() {
    const t = global.DB_TABLES;
    
    t.forEach(b => {
      const u = this.p[b];
      if (u) {
        Object.entries(u).forEach(([i, d]) => {
          this.v1.prepare(`
            INSERT OR REPLACE INTO ${b} (id, data) 
            VALUES (?, ?)
          `).run(i, JSON.stringify(d));
        });
      }
    });
  }

  close() {
    this.v1.close();
  }
}