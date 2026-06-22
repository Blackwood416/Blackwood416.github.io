# Cloudflare Pages Deployment

This project is prepared for `https://blog.blackwood.cv` on Cloudflare Pages.

## Build Settings

Use these settings when creating the Cloudflare Pages project:

| Setting | Value |
| :-- | :-- |
| Repository | `Blackwood416/Blackwood416.github.io` |
| Production branch | `master` |
| Framework preset | `Astro` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | `/` |
| Node.js version | `22.12.0` or newer |

The `npm run build` command runs both Astro and Pagefind:

```sh
npm run build:astro && npm run build:search
```

Cloudflare Pages should publish the generated `dist` directory. The Pagefind search assets are generated under `dist/pagefind`.

Official references:

- [Cloudflare Pages build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/)
- [Cloudflare Pages Astro guide](https://developers.cloudflare.com/pages/framework-guides/deploy-an-astro-site/)

## Domain Plan

Use Cloudflare as authoritative DNS for the apex domain:

- Zone: `blackwood.cv`
- Blog hostname: `blog.blackwood.cv`
- Astro `site`: `https://blog.blackwood.cv`

## Cloudflare DNS Takeover

1. In Cloudflare, add the site `blackwood.cv`.
2. Review imported DNS records. Since this blog did not previously rely on custom DNS, only keep records you intentionally need.
3. Copy the two Cloudflare nameservers assigned to the zone.
4. In Spaceship, open `blackwood.cv` and go to Advanced DNS.
5. In the Nameservers section, choose custom nameservers and enter the two Cloudflare nameservers.
6. Return to Cloudflare and wait for the zone to become active.
7. If DNSSEC was enabled at Spaceship before the move, disable it before changing nameservers, then re-enable DNSSEC in Cloudflare after activation if desired.

Official references:

- [Cloudflare full DNS setup](https://developers.cloudflare.com/dns/zone-setups/full-setup/setup/)
- [Spaceship custom nameservers](https://www.spaceship.com/knowledgebase/connect-domain-custom-nameservers/)

## Pages Custom Domain

After the Cloudflare zone is active and the Pages project has a successful production deployment:

1. Open the Pages project in Cloudflare.
2. Go to Custom domains.
3. Add `blog.blackwood.cv`.
4. Let Cloudflare create or verify the DNS record for the Pages project.
5. Wait until the custom domain status is active.
6. Visit `https://blog.blackwood.cv`, `/rss.xml`, `/sitemap-index.xml`, and `/search/`.

Official reference:

- [Cloudflare Pages custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/)

## GitHub Repository Note

This local checkout currently has no `origin` remote configured. Before connecting Cloudflare Pages to GitHub, push the migrated Astro branch or merge it into the repository branch that Cloudflare will deploy.

Example:

```sh
git remote add origin https://github.com/Blackwood416/Blackwood416.github.io.git
git push -u origin codex/astro-migration
```

Then merge or open a pull request so the production branch contains the Astro project.

## Browser-Assisted Steps

Browser automation can help navigate Cloudflare and Spaceship, but these actions should be completed or confirmed by the account owner:

- Logging in and completing MFA.
- Submitting the final nameserver change at Spaceship.
- Authorizing Cloudflare access to the GitHub repository.
- Creating DNS or custom-domain records that affect live traffic.
