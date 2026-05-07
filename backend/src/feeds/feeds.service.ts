import { Injectable, BadRequestException } from '@nestjs/common';

export type FeedMeta = {
  id: string;
  name: string;
  city: string;
  country: string;
};

type FeedEntry = FeedMeta & { url: string };

// URLs stay server-side — the client only sends an id, preventing open-redirect / SSRF.
const FEEDS: FeedEntry[] = [
  {
    id: 'exo',
    name: 'EXO',
    city: 'Montreal',
    country: 'Canada',
    url: 'https://exo.quebec/xdata/trains/google_transit.zip',
  },
  {
    id: 'maritime-bus',
    name: 'Maritime Bus',
    city: 'Halifax',
    country: 'Canada',
    url: 'https://data.trilliumtransit.com/gtfs/maritimebus-ca/maritimebus-ca.zip',
  },
  {
    id: 'hinton-transit',
    name: 'Hinton Transit',
    city: 'Hinton',
    country: 'Canada',
    url: 'https://www.hinton.ca/DocumentCenter/View/4738',
  },
  {
    id: 'saint-john-transit',
    name: 'Saint John Transit',
    city: 'Saint John',
    country: 'Canada',
    url: 'https://www.arcgis.com/sharing/rest/content/items/d6f4783521364429a2e51a64c60ae234/data',
  },
  {
    id: 'union-pearson-express',
    name: 'Union Pearson Express (UP Express)',
    city: 'Toronto',
    country: 'Canada',
    url: 'https://assets.metrolinx.com/raw/upload/Documents/Metrolinx/Open%20Data/UP-GTFS.zip',
  },
  {
    id: 'roam-transit',
    name: 'Roam Transit',
    city: 'Banff',
    country: 'Canada',
    url: 'https://data.trilliumtransit.com/gtfs/roamtransit-banff-ab-ca/roamtransit-banff-ab-ca.zip',
  }
];

@Injectable()
export class FeedsService {
  list(): FeedMeta[] {
    return FEEDS.map(({ id, name, city, country }) => ({ id, name, city, country }));
  }

  async fetchFeedStream(
    id: string,
  ): Promise<{ body: ReadableStream<Uint8Array>; contentLength: string | null }> {
    const entry = FEEDS.find((f) => f.id === id);
    if (!entry) throw new BadRequestException(`Unknown feed id: ${id}`);

    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 30_000);

    let res: Response;
    try {
      res = await fetch(entry.url, { signal: abort.signal });
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) throw new Error(`Upstream ${res.status} from ${entry.id}`);
    if (!res.body) throw new Error('Empty response body from upstream');

    return { body: res.body, contentLength: res.headers.get('content-length') };
  }
}
