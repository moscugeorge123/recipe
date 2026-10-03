import type {
  IProfileBootstrapRepository,
  ProfileBootstrapResult,
} from '../repository/profile-bootstrap.repository.js';

export class ProfileBootstrapService {
  constructor(private readonly repository: IProfileBootstrapRepository) {}

  ensureDefaults(): Promise<ProfileBootstrapResult> {
    return this.repository.ensureDefaults();
  }
}
