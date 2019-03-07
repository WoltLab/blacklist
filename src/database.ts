import * as path from 'path';
import { Database as SqliteDatabase, RunResult } from 'sqlite3';
import { Service } from 'typedi';

import { DatabaseStatement } from './database-statement';

@Service()
export class Database {
  protected db: SqliteDatabase;

  constructor() {
    this.db = new SqliteDatabase(path.join(__dirname, 'data.db'));
  }

  public async setup(): Promise<void> {
    this.db.exec('PRAGMA synchronous = OFF');
    this.db.exec('PRAGMA journal_mode = MEMORY');
  }

  public async shutdown(): Promise<void> {
    return new Promise<void>(
      (resolve: () => void, reject: (err: Error) => void): void => {
        this.db.close(
          (err?: Error): void => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          },
        );
      },
    );
  }

  public async all(sql: string): Promise<any[]> {
    return new Promise<any[]>(
      (resolve: (rows: any[]) => void, reject: (err: Error) => void): void => {
        this.db.all(
          sql,
          (err: Error | undefined, rows: any[]): void => {
            if (err) {
              reject(err);
            } else {
              resolve(rows);
            }
          },
        );
      },
    );
  }

  public async each(
    sql: string,
    callback: (err: Error | undefined, row: any) => void,
  ): Promise<number> {
    return new Promise<number>(
      (
        resolve: (count: number) => void,
        reject: (err: Error) => void,
      ): void => {
        this.db.each(
          sql,
          callback,
          (err: Error | undefined, count: number | undefined): void => {
            if (err) {
              reject(err);
            } else {
              resolve(count);
            }
          },
        );
      },
    );
  }

  public async exec(sql: string): Promise<void> {
    return new Promise<void>(
      (resolve: () => void, reject: (err: Error) => void): void => {
        this.db.exec(
          sql,
          (err: Error | null): void => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          },
        );
      },
    );
  }

  public async prepare(sql: string): Promise<DatabaseStatement> {
    return new Promise<DatabaseStatement>(
      (
        resolve: (statement: DatabaseStatement) => void,
        reject: (err: Error) => void,
      ): void => {
        this.db.prepare(sql, function(err: Error | null): void {
          if (err) {
            reject(err);
          } else {
            resolve(new DatabaseStatement(this));
          }
        });
      },
    );
  }

  public async run(sql: string): Promise<RunResult> {
    return new Promise<RunResult>(
      (
        resolve: (result: RunResult) => void,
        reject: (err: Error) => void,
      ): void => {
        this.db.run(sql, function(err?: Error): void {
          if (err) {
            reject(err);
          } else {
            resolve(this);
          }
        });
      },
    );
  }
}
