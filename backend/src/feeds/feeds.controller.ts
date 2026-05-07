import { Controller, Get, Post, Body, Res, HttpCode } from '@nestjs/common';
import { Readable } from 'stream';
import type { Response } from 'express';
import { FeedsService, type FeedMeta } from './feeds.service';

@Controller('feeds')
export class FeedsController {
  constructor(private readonly feedsService: FeedsService) {}

  @Get()
  list(): FeedMeta[] {
    return this.feedsService.list();
  }

  @Post('fetch')
  @HttpCode(200)
  async fetchFeed(
    @Body() body: { id: string },
    @Res() res: Response,
  ): Promise<void> {
    const { body: webStream, contentLength } = await this.feedsService.fetchFeedStream(body.id);

    res.set({ 'Content-Type': 'application/zip' });
    if (contentLength) res.set('Content-Length', contentLength);

    // Readable.fromWeb bridges the Web API ReadableStream returned by fetch
    // to a Node.js Readable that Express can pipe directly to the client.
    const nodeStream = Readable.fromWeb(webStream as Parameters<typeof Readable.fromWeb>[0]);
    nodeStream.on('error', () => res.destroy());
    nodeStream.pipe(res);
  }
}
