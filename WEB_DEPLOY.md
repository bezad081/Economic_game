# MACROSTATE Web deployment

The repository contains two implementations:

- **Web:** React + TypeScript + Vite, deployed to GitHub Pages.
- **Python:** Pygame desktop/browser-oriented implementation under `python/`.

## GitHub Pages

The web application is built and deployed by:

```text
.github/workflows/deploy.yml
```

The workflow runs:

```bash
npm install
npm run build
```

and publishes the generated `dist/` directory to GitHub Pages.

In GitHub:

1. Open **Settings → Pages**.
2. Set the source to **GitHub Actions**.
3. Push to `main` or run the workflow manually from the **Actions** tab.

## Local web development

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```

## Python game

The Python implementation is kept separate from the web application:

```bash
python -m pip install -r python/requirements.txt
python python/main.py
```

For the deterministic economic smoke tests:

```bash
python python/validate_economy.py
```

The Python browser packaging notes and dependencies are kept in `python/requirements-web.txt`.
