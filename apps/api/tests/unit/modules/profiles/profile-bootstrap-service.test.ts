import { describe, expect, it, vi } from 'vitest';

import { ProfileBootstrapService } from '../../../../src/modules/profiles/application/profile-bootstrap-service.js';
import type { IProfileBootstrapRepository } from '../../../../src/modules/profiles/repository/profile-bootstrap.repository.js';

describe('ProfileBootstrapService', () => {
  it('delegates idempotent profile repair to the repository', async () => {
    const ensureDefaults = vi
      .fn<IProfileBootstrapRepository['ensureDefaults']>()
      .mockResolvedValue({
        profileId: '00000000-0000-4000-8000-000000000001',
        categoriesCreated: 4,
        recipeLinksCreated: 2,
        revisionsCreated: 2,
      });
    const service = new ProfileBootstrapService({
      ensureDefaults,
      ensureDefaultUser: vi.fn<IProfileBootstrapRepository['ensureDefaultUser']>(),
    });

    await expect(service.ensureDefaults()).resolves.toEqual({
      profileId: '00000000-0000-4000-8000-000000000001',
      categoriesCreated: 4,
      recipeLinksCreated: 2,
      revisionsCreated: 2,
    });
    expect(ensureDefaults).toHaveBeenCalledOnce();
  });

  it('delegates the bare default-user upsert without the recipe repair', async () => {
    const ensureDefaults = vi.fn<IProfileBootstrapRepository['ensureDefaults']>();
    const ensureDefaultUser = vi
      .fn<IProfileBootstrapRepository['ensureDefaultUser']>()
      .mockResolvedValue(4);
    const service = new ProfileBootstrapService({ ensureDefaults, ensureDefaultUser });

    await expect(service.ensureDefaultUser()).resolves.toBe(4);
    expect(ensureDefaultUser).toHaveBeenCalledOnce();
    expect(ensureDefaults).not.toHaveBeenCalled();
  });
});
