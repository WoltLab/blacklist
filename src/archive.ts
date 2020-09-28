import fetch from 'node-fetch';
import * as zlib from 'zlib';

export const sources = new Map<string, string>([
  ['ipv4', 'https://www.stopforumspam.com/downloads/listed_ip_1_all.gz'],
  ['ipv6', 'https://www.stopforumspam.com/downloads/listed_ip_1_ipv6_all.gz'],
  ['email', 'https://www.stopforumspam.com/downloads/listed_email_1_all.gz'],
  [
    'username',
    'https://www.stopforumspam.com/downloads/listed_username_1_all.gz',
  ],
]);

export class Archive {
  public get filename(): string {
    return `tmp.${this.type}.csv`;
  }

  public static getAll(): Archive[] {
    const archives: Archive[] = [];
    sources.forEach(
      (url: string, type: string): void => {
        archives.push(new Archive(type));
      },
    );

    return archives;
  }
  constructor(public readonly type: string) {
    if (!sources.has(this.type)) {
      throw new Error(`The type '${this.type}' is not known.`);
    }
  }

  public async download(): Promise<Buffer | undefined> {
    const response = await fetch(sources.get(this.type), {
      compress: false,
    });
    if (response.ok) {
      return zlib.gunzipSync(await response.buffer());
    }

    return undefined;
  }
}
