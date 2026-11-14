import { LinkButton } from '@/components/ui';
import { Wordmark } from '@/components/shell';
import { STATIC_PREVIEW } from '@/lib/utils';

export default function Creators() {
  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-5 py-12">
      <Wordmark name="TakeOne" />
      <h1 className="mt-8 text-h1">Creators use the app</h1>
      <p className="mt-4 text-body text-secondary">Find paid campaigns, shoot one take, and let the Variant Engine do the editing. You keep 75% of the campaign fee and of every licence after it.</p>
      <p className="mt-3 text-small text-tertiary">The creator app is being built for iOS and Android.</p>
      <div className="mt-8 flex flex-wrap gap-3">
        {STATIC_PREVIEW && <a className="inline-flex h-control-md items-center rounded-full bg-inverse px-5 text-small font-medium text-on-inverse transition duration-fast hover:bg-inverse-hover active:scale-press" href="/app/">Open the app preview</a>}
        <LinkButton href="/" variant="secondary">Back to home</LinkButton>
      </div>
    </div>
  );
}
