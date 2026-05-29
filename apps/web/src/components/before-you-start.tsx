'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mars, Venus, type LucideIcon } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

type Gender = 'male' | 'female';

const OPTIONS: { value: Gender; label: string; Icon: LucideIcon }[] = [
  { value: 'male', label: 'Male', Icon: Mars },
  { value: 'female', label: 'Female', Icon: Venus },
];

// The mandatory entry gate on /chat. Collects gender (immutable) + implicit
// 18+/Terms consent (the CTA wording IS the agreement), then lazily creates a
// gendered anonymous session. gender rides on the signIn.anonymous body and is
// set at insert by apps/auth's databaseHooks.user.create.before. Returning
// users take the Login link instead (OAuth sign-in into their existing account).
export function BeforeYouStart() {
  const router = useRouter();
  const [gender, setGender] = useState<Gender | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAgree = async () => {
    if (!gender) return;
    setLoading(true);
    setError(null);
    await authClient.signIn.anonymous(
      // gender rides as a query param (the anon endpoint takes no body) and is
      // read in apps/auth's create.before. ?gender=male|female.
      { query: { gender } },
      {
        // Fresh gendered anon — its cookie is correct (gender set at creation),
        // so a plain refresh re-renders /chat past the gate. No ?upgraded.
        onSuccess: () => router.refresh(),
        onError: (ctx) => {
          setLoading(false);
          setError(ctx.error.message ?? 'Could not start. Please try again.');
        },
      },
    );
  };

  return (
    // Mobile: full-width bottom sheet — flush sides/bottom, only the top corners
    // rounded. sm+: a normal centered card.
    <Card className="w-full gap-4 py-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] rounded-b-none border-x-0 border-b-0 sm:max-w-md sm:rounded-b-xl sm:border-x sm:border-b sm:pb-5">
      <CardHeader>
        <CardTitle className="text-2xl">One quick thing...</CardTitle>
        <CardDescription>Pick the one that fits you.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-lg font-semibold">I am:</p>
          <div className="grid grid-cols-2 gap-3">
            {OPTIONS.map(({ value, label, Icon }) => (
              <Button
                key={value}
                type="button"
                variant="outline"
                onClick={() => setGender(value)}
                aria-pressed={gender === value}
                disabled={loading}
                className={cn(
                  'h-9 justify-center gap-2 text-base',
                  gender === value && 'border-primary ring-2 ring-primary',
                )}
              >
                <Icon className="size-5" />
                {label}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            *You can&apos;t change your gender later.
          </p>
        </div>

        <Separator />

        <p className="text-sm text-foreground/80">
          I&apos;m <span className="font-semibold text-primary">18 or older</span>{' '}
          and agree to the{' '}
          <Link
            href="/terms"
            className="underline underline-offset-4 hover:text-foreground"
          >
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link
            href="/privacy"
            className="underline underline-offset-4 hover:text-foreground"
          >
            Privacy Policy
          </Link>
          .
        </p>

        {error && (
          <p className="text-center text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <Button
          type="button"
          size="lg"
          className="w-full font-semibold"
          disabled={!gender || loading}
          onClick={handleAgree}
        >
          {loading ? 'Starting your chat…' : "I AGREE, LET'S GO!"}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link
            href="/login"
            className="font-medium text-primary hover:underline"
          >
            Login
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
