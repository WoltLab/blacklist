import { Container, Service } from 'typedi';

import { CsvParser, ICsvRow } from './csv-parser';
import { Database } from './database';

@Service()
export class Blacklist {
  protected get db(): Database {
    return Container.get(Database);
  }

  protected get parser(): CsvParser {
    return Container.get(CsvParser);
  }

  constructor(public readonly type: string) {}

  public async setup(): Promise<void> {
    await this.db.exec(`CREATE TABLE IF NOT EXISTS ${this.tableName} (
      hash TEXT NOT NULL,
      occurrences INTEGER NOT NULL,
      lastSeen INTEGER NOT NULL
    );`);

    await this.db.exec(
      `CREATE UNIQUE INDEX IF NOT EXISTS hash_${this.type} ON ${
        this.tableName
      } (hash);`,
    );
  }

  public async upsert(buffer: Buffer): Promise<void> {
    const items: ICsvRow[] = await this.parser.parse(buffer);
    if (items.length === 0) {
      throw new Error(`Received a zero-length response for '${this.type}'`);
    }

    const statement = await this.db.prepare(
      `INSERT INTO ${
        this.tableName
      } (hash, occurrences, lastSeen) VALUES (?, ?, ?)
      ON CONFLICT(hash) DO UPDATE SET occurrences = excluded.occurrences, lastSeen = excluded.lastSeen;`,
    );
    items.forEach(
      (item: ICsvRow): void => {
        statement.run(item.hash, item.occurrences, item.lastSeen);
      },
    );

    return statement.finalize();
  }

  public async getRows(
    timestampStart: number,
    timestampEnd: number,
  ): Promise<any> {
    const data: any = {};
    await this.db.each(
      `SELECT * FROM ${
        this.tableName
      } WHERE lastSeen BETWEEN ${timestampStart} AND ${timestampEnd}
      ORDER BY hash`,
      (err: Error, row: IBlacklistItem): void => {
        // Discard the value for 'lastSeen', the client can implicitly use the timestamp
        // when it has fetched them. The loss of resolution is very well acceptable and
        // the reduction of data decreases both the transfer size and the time required to
        // parse the file on the client side.
        data[row.hash] = row.occurrences;
      },
    );

    return data;
  }

  protected get tableName(): string {
    return `blacklist_${this.type}`;
  }
}

export interface IBlacklistItem {
  hash: string;
  lastSeen: number;
  occurrences: number;
}
