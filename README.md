# How to Sync a Bubble Plugin with GitHub (Cedipayy)

This guide explains how to link a Bubble plugin to GitHub and synchronize changes (push/pull). It’s tailored for Cedipayy and other branded modules you may build, to make versioning, code review, CI and collaboration easier.

Prerequisites
- A Bubble account
- A GitHub account
- Registered as a Bubble plugin developer (seller) — Stripe onboarding required to enable GitHub sync
- Decide whether the repo should be private (default) or public (add an open-source license like MIT if public)

Steps

1) Register as a Plugin Developer
- Bubble → Account Settings → Marketplace → Settings
- Click “Register as a Seller” and complete Stripe onboarding. This unlocks GitHub sync features.

2) Link Your GitHub Account
- In Marketplace → Settings, find the "GitHub Integration" section
- Click "Connect GitHub" and authorize Bubble via OAuth
- After auth, Bubble can create and sync repos on your behalf

3) Create or Open a Plugin
- Go to Bubble → Plugin Editor
- Create a new plugin or open an existing one
- Open the "Version" tab in the plugin editor

4) Sync with GitHub
- In the "Version" tab click "Synchronize with GitHub"
- Bubble will create a new GitHub repository (private by default) named to match your plugin
- You can now push/pull between Bubble and GitHub

Pro Tips for Cedipayy
- To make a repo public, add an open-source license (e.g., MIT)
- You can fork other GitHub-synced Bubble plugins and customize them
- Use branches and PRs for contributor workflows and traceability
- Keep a local clone for backup and CI/CD integration
- If you delete the GitHub repo, Bubble will reset the connection; next sync will create a new repo

Troubleshooting
- Missing "Connect GitHub": ensure Stripe onboarding / seller registration is complete
- Unauthorized errors: reconnect GitHub and re-check OAuth scopes
- Sync conflicts: prefer pulling latest from GitHub into Bubble first; resolve merges on branches

Notes
- Repo name will match your Bubble plugin name by default.
- Default visibility is private. Make public only if properly licensed.