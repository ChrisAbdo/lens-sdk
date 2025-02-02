import { LoginButton } from './auth/LoginButton';
import { WhenLoggedOut } from './auth/auth';

type UnauthenticatedFallbackProps = {
  message?: string;
};

export function UnauthenticatedFallback({ message }: UnauthenticatedFallbackProps) {
  return (
    <WhenLoggedOut>
      <div>
        <p>{message ?? 'Log in to view this example.'}</p>
        <LoginButton />
      </div>
    </WhenLoggedOut>
  );
}
