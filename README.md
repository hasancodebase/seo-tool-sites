# seo-tool-sites

One repository, many tool websites. Each folder is a separate site with its own address.

    technical/   Technical SEO Checker (technicalseochecker.pages.dev)
    (next sites go here: copy a folder and change its build.py)

## Build a site
    cd technical
    python3 build.py https://technicalseochecker.pages.dev
Set CONTACT in build.py first. The build writes the site to technical/dist (commit it).

## Deploy a site (Cloudflare Pages, one project per site)
Workers & Pages > Create > Pages (legacy link) > Import a Git repository > this repo.
  Project name: technicalseochecker      Production branch: main
  Framework preset: None                 Build command: (empty)
  Build output directory: dist           Root directory (advanced): technical
Each new site is a new Cloudflare Pages project on the same repo with its own root directory.

## Push changes
    git add .
    git commit -m "message"
    git push
