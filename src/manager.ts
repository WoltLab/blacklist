import * as fs from 'fs';
import * as minimist from 'minimist';
import * as path from 'path';
import { Service } from 'typedi';
import { promisify } from 'util';

import { Archive } from './archive';
import { Blacklist } from './blacklist';
import { BlacklistIndex } from './blacklist-index';
import { Database } from './database';

const fsExists = promisify(fs.exists);
const fsMkdir = promisify(fs.mkdir);
const fsWriteFile = promisify(fs.writeFile);

@Service()
export class Manager {
  protected readonly delta: number;
  protected readonly deltaDate: string;
  protected readonly deltaEnd: Date;
  protected readonly deltaStart: Date;
  protected readonly filenameDaily: string;
  protected readonly filenameSixHours: string;
  protected readonly now: Date;
  protected readonly outDir: string;
  protected readonly yesterday: Date;

  protected db: Database;

  constructor() {
    const argv = minimist(process.argv.slice(2), {
      string: ['out-dir', 'db-name'],
      default: {
        'db-name': path.join(__dirname, 'data.db')
      },
      unknown: (): boolean => false,
    });

    this.outDir = argv['out-dir'];
    if (!this.outDir) {
      throw new Error("The '--out-dir' argument is missing.");
    }

    this.db = new Database(argv['db-name']);

    this.now = new Date();
    this.yesterday = new Date(this.now.getTime());
    this.yesterday.setDate(this.yesterday.getDate() - 1);

    this.filenameDaily = path.join(
      this.outDir,
      this.yesterday.toISOString().substr(0, 10),
      'full.json',
    );

    // The 6 hours delta only considers past segments in order to avoid incomplete data sets.
    const utcHours = this.now.getUTCHours();
    if (utcHours < 6) {
      this.delta = 4;

      this.deltaDate = this.yesterday.toISOString().substr(0, 10);
      this.deltaStart = new Date(`${this.deltaDate}T18:00:00Z`);
      this.deltaEnd = new Date(`${this.deltaDate}T23:59:59Z`);
    } else {
      this.delta = Math.floor(utcHours / 6);

      this.deltaDate = this.now.toISOString().substr(0, 10);
      this.deltaStart = new Date(
        this.deltaDate +
          'T' +
          ((this.delta - 1) * 6).toString().padStart(2, '0') +
          ':00:00Z',
      );
      this.deltaEnd = new Date(
        this.deltaDate +
          'T' +
          ((this.delta - 1) * 6 + 5).toString().padStart(2, '0') +
          ':59:59Z',
      );
    }

    this.filenameSixHours = path.join(
      this.outDir,
      this.deltaDate,
      `delta${this.delta}.json`,
    );
  }

  public async setup(): Promise<void> {
    await this.db.setup();
  }

  public async update(): Promise<void> {
    const rebuildDaily = await this.pendingDailyUpdate();
    const rebuildSixHours = await this.pendingSixHoursUpdate();

    if (rebuildDaily || rebuildSixHours) {
      const blacklists: Blacklist[] = [];

      await Promise.all(
        Archive.getAll().map(
          async (archive: Archive): Promise<void> => {
            const blacklist = new Blacklist(archive.type, this.db);
            blacklists.push(blacklist);

            await blacklist.setup();

            const buffer: Buffer | undefined = await archive.download();
            if (buffer) {
              await this.updateBlacklist(blacklist, buffer);
            } else {
              console.error(
                `Failed to download the file for '${archive.type}'.`,
              );
            }
          },
        ),
      );

      if (rebuildDaily) {
        await this.rebuildDaily(blacklists);
      }

      if (rebuildSixHours) {
        await this.rebuildSixHours(blacklists);
      }
    }
  }

  public async rebuildIndex(): Promise<void> {
    await new BlacklistIndex(this.now, this.outDir).rebuild();
  }

  protected async updateBlacklist(
    blacklist: Blacklist,
    buffer: Buffer,
  ): Promise<Blacklist> {
    await blacklist.setup();

    try {
      await blacklist.upsert(buffer);
    } catch (e) {
      console.error(
        `Failed to upsert the data for '${blacklist.type}': ${e.message}`,
        e.stack,
      );
    }

    try {
      await blacklist.garbageCollect();
    } catch (e) {
      console.error(
        `Failed to garbage collect the data for '${blacklist.type}': ${e.message}`,
        e.stack,
      );
    }

    return blacklist;
  }

  protected async rebuildDaily(blacklists: Blacklist[]): Promise<void> {
    const date = this.yesterday.toISOString().substr(0, 10);
    const start = date + 'T00:00:00Z';
    const end = date + 'T23:59:59Z';

    return this.rebuild(blacklists, this.filenameDaily, start, end, {
      date,
      end,
      start,
      type: 'day',
    });
  }

  protected async rebuildSixHours(blacklists: Blacklist[]): Promise<void> {
    return this.rebuild(
      blacklists,
      this.filenameSixHours,
      this.deltaStart.toISOString(),
      this.deltaEnd.toISOString(),
      {
        date: this.deltaDate,
        end: this.deltaEnd.toISOString(),
        start: this.deltaStart.toISOString(),
        type: `delta${this.delta}`,
      },
    );
  }

  protected async rebuild(
    blacklists: Blacklist[],
    filename: string,
    start: string,
    end: string,
    meta: any,
  ): Promise<void> {
    const data: any = {
      meta,
    };

    const entries = await Promise.all(
      blacklists.map(
        async (blacklist: Blacklist): Promise<any> => {
          return {
            blacklist,
            rows: await blacklist.getRows(
              new Date(start).getTime(),
              new Date(end).getTime(),
            )
          };
        },
      ),
    );

    entries.forEach(entry => {
      data[entry.blacklist.type] = entry.rows
    });

    const directory = path.dirname(filename);
    if (!(await fsExists(directory))) {
      await fsMkdir(directory);
    }

    await fsWriteFile(filename, JSON.stringify(data, null, 2));
  }

  protected async pendingDailyUpdate(): Promise<boolean> {
    return !(await fsExists(this.filenameDaily));
  }

  protected async pendingSixHoursUpdate(): Promise<boolean> {
    return !(await fsExists(this.filenameSixHours));
  }
}
