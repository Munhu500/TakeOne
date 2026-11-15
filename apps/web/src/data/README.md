# Landing page data

Both files start empty, and the landing page renders nothing for them until they have entries.

`founding-creators.json` — only entries with `"permission": true` are shown.

    [{ "name": "Full Name", "handle": "@handle", "avatar": "/media/creators/full-name.jpg", "permission": true }]

`brand-logos.json` — logos are shown in white at 50% opacity, so supply a single-colour SVG or transparent PNG.

    [{ "name": "Brand", "logo": "/media/logos/brand.svg" }]

Only add a person or a brand that has agreed to be shown.
