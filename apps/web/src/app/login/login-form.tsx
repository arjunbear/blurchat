'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Ghost, Mail } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { BrandMark } from '@/components/brand-mark';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';

// Official Google "G" mark — used on every "Continue with Google" button
// across the web. Inline SVG so there's no extra request and the colors
// stay true regardless of theme.
function GoogleIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

// Official Facebook "f" mark (blue circle with white f cutout). Inline SVG
// for the same reasons as GoogleIcon — no extra request, brand-true colors.
function FacebookIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="#1877F2"
        d="M24 12c0-6.627-5.373-12-12-12S0 5.373 0 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 22.954 24 17.99 24 12z"
      />
      <path
        fill="#fff"
        d="M16.671 15.469L17.203 12H13.875V9.749c0-.949.465-1.874 1.956-1.874h1.51V4.922s-1.374-.235-2.686-.235c-2.741 0-4.533 1.662-4.533 4.669V12H7.078v3.469h3.047v8.385c.611.096 1.236.146 1.875.146.639 0 1.264-.05 1.875-.146v-8.385h2.796z"
      />
    </svg>
  );
}

// Email section progressive disclosure:
//   collapsed   → just a "Continue with email" button
//   sign-in     → email + password fields, Sign in button, Forgot? link
//   forgot      → email field, Send reset link, Back to sign in
//   forgot-sent → success message (anti-enumeration: always shown on 200),
//                  Back to sign in
type EmailMode = 'collapsed' | 'sign-in' | 'forgot' | 'forgot-sent';

export function LoginForm() {
  const router = useRouter();
  const [emailMode, setEmailMode] = useState<EmailMode>('collapsed');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onAuthSuccess = () => {
    router.push('/');
    router.refresh();
  };

  const handleEmailSubmit = async () => {
    setLoading(true);
    setError(null);

    try {
      await authClient.signIn.email(
        { email, password },
        {
          onError: (ctx) =>
            setError(ctx.error.message ?? 'Something went wrong.'),
          onSuccess: onAuthSuccess,
        }
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    setError(null);

    try {
      await authClient.signIn.social(
        {
          provider: 'google',
          callbackURL: `${window.location.origin}/`,
        },
        {
          onError: (ctx) =>
            setError(ctx.error.message ?? 'Google sign-in failed.'),
        }
      );
    } finally {
      setLoading(false);
    }
  };

  const handleFacebook = async () => {
    setLoading(true);
    setError(null);

    try {
      await authClient.signIn.social(
        {
          provider: 'facebook',
          callbackURL: `${window.location.origin}/`,
        },
        {
          onError: (ctx) =>
            setError(ctx.error.message ?? 'Facebook sign-in failed.'),
        }
      );
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async () => {
    setLoading(true);
    setError(null);

    try {
      await authClient.requestPasswordReset(
        {
          email,
          redirectTo: `${window.location.origin}/reset-password`,
        },
        {
          onError: (ctx) =>
            setError(ctx.error.message ?? 'Something went wrong.'),
          onSuccess: () => setEmailMode('forgot-sent'),
        }
      );
    } finally {
      setLoading(false);
    }
  };

  // TODO: once Better Auth's anonymous plugin is wired (see
  // docs/auth-architecture.md), call `authClient.signIn.anonymous()` before
  // redirecting. For now this just sends the user home.
  const handleAnonymous = () => {
    router.push('/');
  };

  const setMode = (mode: EmailMode) => {
    setEmailMode(mode);
    setError(null);
  };

  // The outer form dispatches based on the current mode, so Enter submits the
  // right action whether the user is on the sign-in or forgot-password fields.
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (emailMode === 'sign-in') handleEmailSubmit();
    else if (emailMode === 'forgot') handleForgotSubmit();
  };

  const errorMessage = error && (
    <p
      className="text-center text-sm text-destructive"
      role="alert"
      aria-live="polite"
    >
      {error}
    </p>
  );

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <BrandMark href="/" size="md" className="mx-auto mb-2" />
        <CardTitle>Welcome Back!</CardTitle>
        <CardDescription>
          Sign in to your account and start chatting with strangers!
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleFormSubmit}>
          <FieldGroup className="gap-3">
            <Field>
              <Button
                type="button"
                onClick={handleGoogle}
                disabled={loading}
                className="border border-[#dadce0] bg-white text-[#1f1f1f] shadow-sm hover:bg-[#f8f9fa]"
              >
                <GoogleIcon />
                Continue with Google
              </Button>
            </Field>

            <Field>
              <Button
                type="button"
                onClick={handleFacebook}
                disabled={loading}
                className="border border-[#dadce0] bg-white text-[#1f1f1f] shadow-sm hover:bg-[#f8f9fa]"
              >
                <FacebookIcon />
                Continue with Facebook
              </Button>
            </Field>

            <FieldSeparator>OR</FieldSeparator>

            {emailMode === 'collapsed' && (
              <>
                {errorMessage}
                <Field>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setMode('sign-in')}
                    disabled={loading}
                    className="h-auto py-2"
                  >
                    <Mail className="size-5" />
                    <span className="flex flex-col items-start gap-0.5 leading-tight">
                      <span>Continue with email</span>
                      <span className="text-xs font-normal opacity-70">
                        Existing users only
                      </span>
                    </span>
                  </Button>
                </Field>
              </>
            )}

            {emailMode === 'sign-in' && (
              <>
                <Field>
                  <FieldLabel htmlFor="email">Email</FieldLabel>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                    disabled={loading}
                  />
                </Field>
                <Field>
                  <div className="flex items-center justify-between">
                    <FieldLabel htmlFor="password">Password</FieldLabel>
                    <button
                      type="button"
                      onClick={() => setMode('forgot')}
                      className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      maxLength={128}
                      disabled={loading}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={
                        showPassword ? 'Hide password' : 'Show password'
                      }
                      aria-pressed={showPassword}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none"
                    >
                      {showPassword ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </button>
                  </div>
                </Field>
                {errorMessage}
                <Field>
                  <Button type="submit" disabled={loading}>
                    {loading ? 'Signing in…' : 'Sign in'}
                  </Button>
                </Field>
              </>
            )}

            {emailMode === 'forgot' && (
              <>
                <Field>
                  <FieldLabel htmlFor="email">Email</FieldLabel>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                    disabled={loading}
                  />
                  <FieldDescription className="text-center">
                    We&apos;ll email you a link to reset or set your password.
                  </FieldDescription>
                </Field>
                {errorMessage}
                <Field>
                  <Button type="submit" disabled={loading}>
                    {loading ? 'Sending…' : 'Send reset link'}
                  </Button>
                  <button
                    type="button"
                    onClick={() => setMode('sign-in')}
                    className="self-center text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
                  >
                    ← Back to sign in
                  </button>
                </Field>
              </>
            )}

            {emailMode === 'forgot-sent' && (
              <Field>
                <div className="text-center">
                  <p className="text-sm font-medium">Check your email</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    If an account exists for{' '}
                    <span className="font-medium text-foreground">{email}</span>
                    , you&apos;ll receive a reset link.
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    The link expires in 1 hour.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setMode('sign-in')}
                  className="self-center text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
                >
                  ← Back to sign in
                </button>
              </Field>
            )}

            <Field>
              <Button
                type="button"
                variant="ghost"
                onClick={handleAnonymous}
                disabled={loading}
              >
                <Ghost className="size-5" />
                Continue anonymously
              </Button>
            </Field>

            <FieldDescription className="text-center">
              By continuing, you agree to our{' '}
              <span className="whitespace-nowrap">
                <Link
                  href="/terms"
                  className="underline underline-offset-4 hover:text-foreground"
                >
                  Terms
                </Link>{' '}
                and{' '}
                <Link
                  href="/privacy"
                  className="underline underline-offset-4 hover:text-foreground"
                >
                  Privacy Policy
                </Link>
                .
              </span>
            </FieldDescription>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
