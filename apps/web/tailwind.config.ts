import type { Config } from 'tailwindcss';
import preset from '@takeone/design-tokens/tailwind';

// Every theme value comes from packages/design-tokens. Do not add colours, sizes or radii here.
export default { presets: [preset as Config], content: ['./src/**/*.{ts,tsx}'] } satisfies Config;
