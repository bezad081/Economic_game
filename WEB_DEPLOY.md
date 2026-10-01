# MACROSTATE Web deployment

This edition is prepared for **Pygbag + GitHub Pages**.

## Why Pygbag?
The original project is a Pygame game. GitHub Pages cannot run Python directly, so Pygbag packages the Pygame/Python game for the browser through WebAssembly while preserving the existing Python economic engine.

## GitHub Pages
1. Create a public repository and upload the contents of this folder to the repository root.
2. Open **Settings → Pages**.
3. Set **Source** to **GitHub Actions**.
4. The included `.github/workflows/deploy.yml` builds the game and deploys `build/web`.
5. Open the **Actions** tab. A green `Build and Deploy MACROSTATE Web` run means the site is live.

Typical project URL:

`https://<username>.github.io/<repository-name>/`

## Local desktop

```bash
python -m pip install -r requirements.txt
python main.py
```

## Local browser test

```bash
python -m pip install -r requirements-web.txt
python -m pygbag .
```

Then open the local URL shown by Pygbag.

## Browser compatibility notes
- The main loop and all launch/menu loops are async-aware and yield with `await asyncio.sleep(0)`.
- The code uses `pygame-ce`, which is the Pygbag-supported Pygame implementation.
- First browser load can take longer because the Python/Pygame WebAssembly runtime must initialize.
