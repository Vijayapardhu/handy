# Installing Handy College Sync

Handy ships **unpacked and open source**. There is no store listing, nothing to
pay for, and nothing to sign — you download a folder and point your browser at
it.

The trade is honest: unpacked extensions do not update themselves, and Chrome
will remind you that developer mode is on. Both are covered below.

---

## For students

**You need a laptop.** Browser extensions do not exist on phone Chrome, so this
step happens once on a computer. After it, Handy on your phone stays current on
its own — the syncing happens on the laptop whenever you visit the portal.

1. **Download** `handy-unpacked.zip` from the
   [latest release](https://github.com/Vijayapardhu/handy/releases/latest).
2. **Extract it** somewhere you will not delete by accident. Not Downloads —
   the folder has to stay where it is for as long as you use the extension, and
   Downloads is the folder everybody clears. Somewhere like `Documents\handy`.
3. Open **`chrome://extensions`** (or `edge://extensions` in Edge).
4. Turn on **Developer mode**, top right.
5. Click **Load unpacked** and select the extracted **`handy`** folder — the
   one with `manifest.json` directly inside it.
6. Go to <https://info.aec.edu.in> and sign in as usual. Open your attendance
   page once.

That is it. Click the Handy icon in the toolbar and it will show your roll
number and when it last synced. Your data is now in the Handy app.

### Two things Chrome will do

**"Disable developer mode extensions"** appears every time Chrome starts.
Dismissing it is safe and it does not turn anything off — it is the warning
Chrome shows for any extension not installed from its store, which is every
unpacked extension by definition. Ignore it, or use Edge, which nags less.

**Moving or deleting the folder uninstalls the extension.** Chrome loads it
from that exact path every launch. If it disappears from `chrome://extensions`,
the folder moved — put it back, or Load unpacked again.

### Updating

Unpacked extensions do not auto-update. When a new version is released:

1. Download and extract the new zip **over the same folder**, replacing it.
2. Go to `chrome://extensions` and click **Reload** (⟳) on the Handy card.

Watch the [releases page](https://github.com/Vijayapardhu/handy/releases) for
when that matters — an update is announced in the Handy app too.

### Removing it

`chrome://extensions` → **Remove** on the Handy card. Everything it stored on
your machine goes with it, including the generated Handy password, and no
further data is read. Deleting data already synced to your Handy account is a
separate request — see the [privacy
policy](https://handy.vijayaapardhu.dev/privacy.html).

---

## For maintainers

### Cutting a release

```
node extension/tool/pack.mjs
```

Writes `dist-extension/handy-unpacked.zip` — a clean copy with `test/`,
`tool/`, `build/`, and `scripts/` stripped out, everything under a top-level
`handy/` so it extracts tidily. Attach that file to a GitHub release.

Raise `version` in `extension/manifest.json` first. Nothing enforces it on this
route — no store is checking — but a student comparing their version against
the release notes needs the number to have moved.

`pack.mjs` refuses to build if `manifest.json` has lost its `"key"`, or if
`description` exceeds 132 characters.

### Why the manifest keeps its `"key"`

It pins the extension ID to `ledmfeohpnfmepdbncmcidoaflhijmkn` regardless of
which folder a student extracted to. Without it, Chrome derives the ID from the
install path, every student gets a different one, and the Handy web app cannot
address the extension at all.

The matching *private* key is not needed on this route and is not used by
anything: nothing verifies a signature on an unpacked extension. It was
committed to this repo before the project went public, so treat it as
disclosed — and note that disclosing it costs nothing here, since the ID is
pinned by the *public* half in the manifest, which is public by design.

### Routes that do not work, and why

- **A self-signed `.crx`.** Chrome has refused non-store CRX installs since
  Chrome 33. There is no flag or repack around it.
- **Enterprise policy self-hosting.** Chrome additionally demands a store
  publisher proof, which only Google can add — attempting it yields
  `CRX_REQUIRED_PROOF_MISSING`.
- **Microsoft Edge Add-ons.** Free and workable, but it needs a personal
  Microsoft account (the Edge program rejects work and school accounts) and a
  reviewer needs portal credentials to test against. Not taken; the submission
  guide for it is in git history if that changes.
