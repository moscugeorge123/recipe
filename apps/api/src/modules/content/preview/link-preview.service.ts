import type { AppConfig } from '../../../config/env.js';
import { assertSafeUrl } from '../../../infrastructure/security/ssrf-guard.js';
import { UnsupportedSourceError } from '../../../shared/errors/extraction-errors.js';
import { YtDlpClient, type VideoDownloadClient } from '../providers/youtube/ytdlp-client.js';
import type { LinkPreview, LinkUnfurler } from './types.js';
import { FakeLinkUnfurler } from './unfurlers/fake.unfurler.js';
import { InstagramLinkUnfurler } from './unfurlers/instagram.unfurler.js';
import { OpenGraphLinkUnfurler } from './unfurlers/open-graph.unfurler.js';
import { YouTubeLinkUnfurler } from './unfurlers/youtube.unfurler.js';

export class LinkPreviewService {
  constructor(private readonly unfurlers: LinkUnfurler[]) {}

  async preview(url: string): Promise<LinkPreview> {
    await assertSafeUrl(url);

    const unfurler = this.unfurlers.find((entry) => entry.supports(url));
    if (!unfurler) {
      throw new UnsupportedSourceError({
        message: 'The provided URL is not currently supported',
      });
    }

    return unfurler.unfurl(url);
  }
}

export function createLinkPreviewService(
  appConfig: AppConfig,
  ytdlp: VideoDownloadClient = new YtDlpClient(appConfig.providers.ytdlpPath),
): LinkPreviewService {
  const metaAppId = appConfig.providers.metaAppId;
  const metaAppSecret = appConfig.providers.metaAppSecret;

  return new LinkPreviewService([
    new FakeLinkUnfurler(),
    new InstagramLinkUnfurler(
      metaAppId && metaAppSecret ? { appId: metaAppId, appSecret: metaAppSecret } : {},
    ),
    new YouTubeLinkUnfurler(ytdlp),
    new OpenGraphLinkUnfurler(),
  ]);
}
