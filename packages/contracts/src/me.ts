/** The signed-in account, as returned by `GET /me`. */
export interface MeResponse {
  id: string;
  email: string | null;
  displayName: string | null;
  createdAt: string;
}
