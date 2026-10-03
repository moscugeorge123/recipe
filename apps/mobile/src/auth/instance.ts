import { FirebaseAuthGateway } from '@/auth/firebase/firebase.auth';
import { authApi } from '@/auth/services/auth-api';
import { AuthService } from '@/auth/services/auth.service';

export const authService = new AuthService(new FirebaseAuthGateway(), authApi);
