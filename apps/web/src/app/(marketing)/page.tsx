import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { MascotCluster } from '@/components/mascot';

export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

export default function Home() {
  return (
    <>
      <section className="relative w-full overflow-hidden">
        <MascotCluster />
        <main className="relative z-10 mx-auto flex min-h-[calc(100svh-var(--header-h))] max-w-6xl flex-col items-center justify-center px-4 text-center sm:px-6">
          <h1 className="text-balance text-5xl font-bold tracking-tight sm:text-7xl">
            Talk to <span className="text-primary">strangers</span>
          </h1>
          <p className="mt-6 max-w-md text-balance text-lg text-foreground/80">
            Free random text chat. Meet new people from around the world — no sign-up
            required.
          </p>
          <Button asChild size="xl" className="mt-10 font-semibold">
            <Link href="/chat">
              <span className="relative flex size-2.5" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-foreground opacity-75" />
                <span className="relative inline-flex size-2.5 items-center justify-center rounded-full bg-primary-foreground">
                  <span className="size-1.5 rounded-full bg-emerald-400" />
                </span>
              </span>
              Start chatting
            </Link>
          </Button>
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <span className="size-1.5 rounded-full bg-primary/70" aria-hidden="true" />
            Video chat — coming soon
          </div>
        </main>
      </section>

      {/* TEMP: lorem placeholder so the mascot's scroll-out animation can be tested — remove once real sections land */}
      <section className="mx-auto max-w-3xl space-y-6 px-6 py-24 text-muted-foreground">
        <p>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Phasellus eget
          metus quis nisi venenatis facilisis. Suspendisse potenti. Curabitur
          finibus, ipsum a fermentum mattis, nibh quam consectetur enim.
        </p>
        <p>
          Mauris a luctus risus. Integer sed sapien sit amet sem hendrerit
          fermentum. Nullam id elit ut justo placerat tincidunt. Sed ac orci
          tincidunt, faucibus mi at, ornare sapien. Pellentesque habitant morbi
          tristique senectus et netus et malesuada.
        </p>
        <p>
          Vestibulum ante ipsum primis in faucibus orci luctus et ultrices
          posuere cubilia curae; Aenean nec gravida tortor. Donec consequat,
          mauris non commodo dictum, lacus nibh tempus eros, in maximus augue
          sem id justo. Cras pretium tristique ipsum.
        </p>
        <p>
          Quisque suscipit, ligula at malesuada vestibulum, nibh tortor consequat
          velit, eget mattis lectus mauris non est. Etiam id arcu non tellus
          convallis tempus. Integer vitae mi at risus tincidunt finibus.
        </p>
        <p>
          Aliquam erat volutpat. Fusce non semper magna. Praesent egestas neque a
          ligula vehicula, eu ornare nibh tempus. Curabitur in justo tempus,
          consectetur turpis a, hendrerit sapien. Sed eget sapien at ligula
          consectetur condimentum.
        </p>
        <p>
          Donec at tellus non risus aliquet finibus. Suspendisse blandit,
          ligula et fermentum tristique, justo enim convallis lorem, in
          ullamcorper urna sapien et sem. Vivamus auctor tellus sed tortor
          dignissim, in luctus nunc volutpat.
        </p>
      </section>
    </>
  );
}
