# How to Sync a Bubble Plugin with GitHub (Cedipayy)

This guide shows the exact steps to link a Bubble plugin to GitHub and synchronize changes (push/pull). Use this when you want your Bubble plugin code to live in a GitHub repo for versioning, code review, CI, or collaboration. This is tailored for Cedipayy and other branded modules you may be building.

Prerequisites
- A Bubble account
- A GitHub account
- Registered as a Bubble plugin developer (seller) — Stripe signup required to enable GitHub sync
- (Optional) Decide whether the repo should be private (default) or public (ensure you use an open-source license if public)

Steps

1. Register as a Plugin Developer
- Open Bubble → Account Settings
- Marketplace → Settings
- Click “Register as a Seller” (complete Stripe onboarding). This unlocks GitHub sync features.

2. Link Your GitHub Account
- In Marketplace → Settings, find the "GitHub Integration" section
- Click "Connect GitHub"
- Authorize Bubble to access your GitHub account (you will see the OAuth flow from GitHub)
- After successful auth, Bubble can create and sync repos on your behalf

3. Create or Open a Plugin
- Go to Bubble → Plugin Editor
- Create a new plugin or open an existing one
- In the plugin editor, open the "Version" tab

4. Sync with GitHub
- In the "Version" tab click "Synchronize with GitHub"
- Bubble will create a new GitHub repository (private by default) named to match your plugin
- The repo contains the plugin source that Bubble manages; you can now push and pull between Bubble and GitHub

Pro Tips for Cedipayy
- If you want the repo public, add an open-source license like MIT
- You can fork other GitHub-synced Bubble plugins and customize them
- Use branches and PRs for contributor workflows and audit traceability
- Keep a local clone for backup and CI/CD integration
- If you delete the GitHub repo, Bubble will reset the connection and create a new one on next sync

Troubleshooting
- Missing "Connect GitHub" option: Ensure you're registered as a seller (Stripe onboarding complete).
- Unauthorized errors: Reconnect GitHub, and verify OAuth scopes you granted to Bubble.
- Conflicts on sync: Use branches and manual merges to resolve conflicts; prefer pulling latest from GitHub into Bubble before large pushes.

Notes
- Repo name will match your Bubble plugin name by default.
- The default visibility is private. Make it public only if your plugin is open source and properly licensed.
